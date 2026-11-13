#!/usr/bin/env python3
"""Evidence coverage scoring. This is a declared heuristic, not a hiring model."""
import argparse
from datetime import datetime
import json
import re
from pathlib import Path
import sys

USABLE = {"user_attested", "confirmed"}
IMPORTANCE = {"required": 2, "preferred": 1, "unclassified": 1}
CREDIT = {"direct": 1.0, "transferable": 0.5, "unknown": 0.0, "gap": 0.0}
INTEREST = {"aligned": 2, "uncertain": 1, "misaligned": 0}


def _text_key(value):
    # Technical punctuation distinguishes C, C++, C#, .NET, and other skills.
    # Normalize whitespace/case and sentence endings, not meaningful symbols.
    return re.sub(r"\s+", " ", value.casefold()).strip().rstrip("!?.,;:")


def _assess(row, state):
    assessment = row.get("assessment", "unknown")
    if assessment not in CREDIT:
        raise ValueError(f"Invalid assessment for {row['id']}")
    evidence = row.get("evidence_fact_ids", [])
    if not isinstance(evidence, list) or any(not isinstance(x, str) for x in evidence):
        raise ValueError("evidence_fact_ids must be a list of fact identifiers")
    usable, pending = [], []
    for fact_id in evidence:
        if fact_id not in state["facts"]:
            raise ValueError(f"Unknown fact {fact_id}; evidence must belong to this profile")
        fact = state["facts"][fact_id]
        if fact.get("profile_id") != state["profile_id"]:
            raise ValueError(f"Cross-profile fact {fact_id}")
        if fact.get("status") in USABLE:
            usable.append(fact_id)
        else:
            pending.append(fact_id)
    if assessment in {"direct", "transferable"}:
        # Every cited dependency must be usable. Partial unreviewed claims cannot
        # inherit the credibility of a different, reviewed fact in the same row.
        if not usable or pending:
            assessment = "unknown"
        elif not row.get("rationale", "").strip():
            raise ValueError(f"Evidence mapping needs a rationale: {row['id']}")
    if assessment == "gap" and not row.get("rationale", "").strip():
        raise ValueError(f"A confirmed gap needs an explicit reason: {row['id']}")
    return {"assessment": assessment, "credit": CREDIT[assessment],
            "evidence_fact_ids": usable, "pending_fact_ids": pending,
            "rationale": row.get("rationale", "")}


def score_job(state, job, threshold=30.0):
    if not 0 <= threshold <= 100:
        raise ValueError("threshold must be between 0 and 100")
    if job.get("profile_id") != state.get("profile_id"):
        raise ValueError("Job and ledger must belong to the same profile")
    if not isinstance(state.get("facts"), dict):
        raise ValueError("Ledger needs a facts mapping")
    rows = job.get("requirements", [])
    if not isinstance(rows, list):
        raise ValueError("requirements must be a list")
    # Semantic grouping is the extractor's responsibility. Explicit group IDs
    # represent OR alternatives or an umbrella with its examples; exact text
    # duplicates are also collapsed even if assigned different group IDs.
    parents = list(range(len(rows)))
    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    seen_ids, by_group, by_text = set(), {}, {}
    for i, row in enumerate(rows):
        if not isinstance(row, dict) or not row.get("id") or not row.get("text", "").strip():
            raise ValueError("Every requirement needs id and text")
        if row["id"] in seen_ids:
            raise ValueError(f"Duplicate requirement id: {row['id']}")
        seen_ids.add(row["id"])
        if row.get("importance", "unclassified") not in IMPORTANCE:
            raise ValueError(f"Invalid importance for {row['id']}")
        group = row.get("group_id") or row["id"]
        if not isinstance(group, str):
            raise ValueError(f"group_id must be a string for {row['id']}")
        for index, key in ((by_group, group), (by_text, _text_key(row["text"]))):
            if key in index:
                parents[root(i)] = root(index[key])
            else:
                index[key] = i
    groups = {}
    for i, row in enumerate(rows):
        groups.setdefault(root(i), []).append(row)
    normalized = []
    for members in groups.values():
        assessed = [(row, _assess(row, state)) for row in members]
        # A single satisfied alternative satisfies an OR group. If none is
        # satisfied, any unknown alternative keeps the group unknown.
        best_row, best = max(assessed, key=lambda pair:
                            (pair[1]["credit"], pair[1]["assessment"] == "unknown"))
        weight = max(IMPORTANCE[row.get("importance", "unclassified")] for row in members)
        normalized.append({"group_id": members[0].get("group_id") or members[0]["id"],
                           "requirement_ids": [r["id"] for r in members],
                           "texts": list(dict.fromkeys(r["text"] for r in members)),
                           "weight": weight, **best})
    denominator = sum(r["weight"] for r in normalized)
    earned = sum(r["weight"] * r["credit"] for r in normalized)
    unknown = sum(r["weight"] for r in normalized if r["assessment"] == "unknown")
    raw_score = 100 * earned / denominator if denominator else None
    unknown_share = 100 * unknown / denominator if denominator else None
    maximum = 100 * (earned + unknown) / denominator if denominator else None
    return {"profile_id": state["profile_id"], "job_id": job["id"],
            "ledger_revision": state.get("revision"), "method": "evidence-coverage-v1",
            "score": round(raw_score, 2) if raw_score is not None else None,
            "score_unrounded": raw_score, "threshold": threshold,
            "qualifies": raw_score is not None and raw_score >= threshold,
            "unknown_weight_percent": round(unknown_share, 2) if unknown_share is not None else None,
            "unknown_could_cross_threshold": raw_score is not None and raw_score < threshold <= maximum,
            "weighted_earned": earned, "weighted_possible": denominator,
            "requirements": normalized,
            "constraints": job.get("constraints", []),
            "interest_alignment": job.get("interest_alignment", "uncertain"),
            "warning": "Evidence coverage is a heuristic, not a hiring probability. Unknown is not a confirmed gap."}


def _verified_date(job):
    # Retrieval time never substitutes for the posting date.
    value = job.get("posting_date") if job.get("posting_date_verified") else None
    if not value:
        return -1
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().toordinal()
    except (ValueError, TypeError):
        raise ValueError(f"Invalid verified posting date for {job['id']}")


def rank_jobs(state, jobs=None, threshold=30.0):
    jobs = list(state.get("jobs", {}).values()) if jobs is None else jobs
    ranked, below, unscored = [], [], []
    for job in jobs:
        result = score_job(state, job, threshold)
        result.update({"employer": job.get("employer"), "title": job.get("title"),
                       "canonical_url": job.get("canonical_url"),
                       "posting_date": job.get("posting_date"),
                       "posting_date_verified": bool(job.get("posting_date_verified")),
                       "research": job.get("research", {})})
        if result["score"] is None:
            unscored.append(result)
        elif result["qualifies"]:
            ranked.append((result, job))
        else:
            below.append(result)
    ranked.sort(key=lambda pair: (-pair[0]["score_unrounded"],
                                 -INTEREST.get(pair[0]["interest_alignment"], 1),
                                 -_verified_date(pair[1]), pair[0]["job_id"]))
    return {"profile_id": state["profile_id"], "threshold": threshold,
            "ranked": [r for r, _ in ranked], "below_threshold": below,
            "unscored": unscored,
            "coverage_note": "Only jobs recorded in this search scope are represented; this is not an exhaustive market search."}


def duplicate_key(job):
    """Return a review hint, not authority to merge distinct requisitions."""
    employer = _text_key(job.get("employer", ""))
    if not employer:
        return None
    if job.get("requisition_id"):
        return (employer, "requisition", str(job["requisition_id"]).casefold())
    if job.get("canonical_url"):
        # Query parameters may carry requisition IDs; preserve them.
        return (employer, "url", job["canonical_url"].split("#")[0].rstrip("/"))
    if job.get("title") and job.get("location"):
        return (employer, "possible", _text_key(job["title"]), _text_key(job["location"]))
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True, help="Applicant workspace, not the skills directory")
    parser.add_argument("--profile", required=True)
    parser.add_argument("--threshold", type=float, default=30)
    sub = parser.add_subparsers(dest="command", required=True)
    one = sub.add_parser("score")
    one.add_argument("--job", required=True)
    sub.add_parser("rank")
    sub.add_parser("duplicates")
    args = parser.parse_args()
    try:
        from jobseek_state import JobseekStore
        state = JobseekStore(args.workspace, args.profile).load()
        if args.command == "score":
            if args.job not in state["jobs"]:
                raise ValueError(f"Unknown job {args.job}")
            result = score_job(state, state["jobs"][args.job], args.threshold)
        elif args.command == "rank":
            result = rank_jobs(state, threshold=args.threshold)
        else:
            groups = {}
            for job in state["jobs"].values():
                key = duplicate_key(job)
                if key:
                    groups.setdefault(key, []).append(job["id"])
            result = {"possible_duplicates": [v for v in groups.values() if len(v) > 1]}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, KeyError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
