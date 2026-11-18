#!/usr/bin/env python3
"""Evidence-coverage scoring for the jobseek v2 applicant-data kit.

This is a declared heuristic, not a hiring model. It reads the kit
through jobseek_state.py, computes coverage from the per-competency
`assessments` recorded on each opening in openings.json, and never
writes scores back — persist accepted scores through the kit/dashboard
workflow, not by editing this script's output into the record silently.

Assessment contract (see dashboard/DATA-MODEL.md, additive fields):
each opening may carry `assessments`, a list of objects with `id`,
`text`, optional `group_id`, `importance` (required / preferred /
unclassified), `assessment` (direct / transferable / unknown / gap),
`evidence` (a list of ledger entry `section` names), and `rationale`.
"""
import argparse
from datetime import datetime
import json
import re
import sys

USABLE = {"user-attested", "confirmed"}
IMPORTANCE = {"required": 2, "preferred": 1, "unclassified": 1}
CREDIT = {"direct": 1.0, "transferable": 0.5, "unknown": 0.0, "gap": 0.0}
INTEREST = {"aligned": 2, "uncertain": 1, "misaligned": 0}


def _text_key(value):
    # Technical punctuation distinguishes C, C++, C#, .NET, and other
    # skills. Normalize whitespace/case and sentence endings, not
    # meaningful symbols. (Carried over from the v1 helper.)
    return re.sub(r"\s+", " ", value.casefold()).strip().rstrip("!?.,;:")


def _assess(row, facts):
    assessment = row.get("assessment", "unknown")
    if assessment not in CREDIT:
        raise ValueError(f"Invalid assessment for {row['id']}")
    evidence = row.get("evidence", [])
    if not isinstance(evidence, list) or any(
            not isinstance(x, str) for x in evidence):
        raise ValueError(
            "evidence must be a list of ledger section names")
    usable, pending = [], []
    for section in evidence:
        if section not in facts:
            raise ValueError(
                f"Unknown ledger section {section}; evidence must "
                "belong to this applicant's ledger")
        fact = facts[section]
        if fact.get("factStatus") in USABLE:
            usable.append(section)
        else:
            pending.append(section)
    downgraded_from = None
    if assessment in {"direct", "transferable"}:
        # Every cited dependency must be usable. Partial unreviewed
        # claims cannot inherit the credibility of a different,
        # reviewed fact in the same row. (v1 rule, kept.)
        if not usable or pending:
            downgraded_from = assessment
            assessment = "unknown"
        elif not row.get("rationale", "").strip():
            raise ValueError(
                f"Evidence mapping needs a rationale: {row['id']}")
    if assessment == "gap" and not row.get("rationale", "").strip():
        raise ValueError(
            f"A confirmed gap needs an explicit reason: {row['id']}")
    result = {"assessment": assessment, "credit": CREDIT[assessment],
              "evidence_sections": usable,
              "nonusable_evidence_sections": pending,
              "rationale": row.get("rationale", "")}
    if downgraded_from:
        result["downgraded_from"] = downgraded_from
        result["downgrade_reason"] = (
            "Cited evidence is missing or not usable (pending, "
            "conflicted, or retired ledger entries earn no credit).")
    return result


def score_opening(kit, opening, threshold=30.0):
    if not 0 <= threshold <= 100:
        raise ValueError("threshold must be between 0 and 100")
    facts = {entry["section"]: entry for entry in kit["ledger"]}
    rows = opening.get("assessments")
    slug = opening.get("slug")
    if rows is None:
        return {"opening_slug": slug, "method": "evidence-coverage-v2",
                "score": None, "score_unrounded": None,
                "threshold": threshold, "qualifies": False,
                "unknown_weight_percent": None,
                "note": "No assessments recorded on this opening; it "
                        "is unscored by this helper, never 0%. Any "
                        "coverage recorded on the opening was produced "
                        "outside this helper."}
    if not isinstance(rows, list):
        raise ValueError(f"{slug}: assessments must be a list")
    # Semantic grouping is the extractor's responsibility. Explicit
    # group IDs represent OR alternatives or an umbrella with its
    # examples; exact text duplicates are also collapsed even if
    # assigned different group IDs. (v1 union-find, kept.)
    parents = list(range(len(rows)))

    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    seen_ids, by_group, by_text = set(), {}, {}
    for i, row in enumerate(rows):
        if not isinstance(row, dict) or not row.get("id") \
                or not row.get("text", "").strip():
            raise ValueError(
                f"{slug}: every assessment needs id and text")
        if row["id"] in seen_ids:
            raise ValueError(
                f"{slug}: duplicate assessment id: {row['id']}")
        seen_ids.add(row["id"])
        if row.get("importance", "unclassified") not in IMPORTANCE:
            raise ValueError(
                f"{slug}: invalid importance for {row['id']}")
        group = row.get("group_id") or row["id"]
        if not isinstance(group, str):
            raise ValueError(
                f"{slug}: group_id must be a string for {row['id']}")
        for index, key in ((by_group, group), (by_text,
                                              _text_key(row["text"]))):
            if key in index:
                parents[root(i)] = root(index[key])
            else:
                index[key] = i
    groups = {}
    for i, row in enumerate(rows):
        groups.setdefault(root(i), []).append(row)
    normalized = []
    for members in groups.values():
        assessed = [(row, _assess(row, facts)) for row in members]
        # A single satisfied alternative satisfies an OR group. If none
        # is satisfied, any unknown alternative keeps the group unknown.
        best_row, best = max(
            assessed,
            key=lambda pair: (pair[1]["credit"],
                              pair[1]["assessment"] == "unknown"))
        weight = max(IMPORTANCE[row.get("importance", "unclassified")]
                     for row in members)
        normalized.append({
            "group_id": members[0].get("group_id") or members[0]["id"],
            "assessment_ids": [r["id"] for r in members],
            "texts": list(dict.fromkeys(r["text"] for r in members)),
            "weight": weight, **best})
    denominator = sum(r["weight"] for r in normalized)
    earned = sum(r["weight"] * r["credit"] for r in normalized)
    unknown = sum(r["weight"] for r in normalized
                  if r["assessment"] == "unknown")
    raw_score = 100 * earned / denominator if denominator else None
    unknown_share = 100 * unknown / denominator if denominator else None
    maximum = (100 * (earned + unknown) / denominator
               if denominator else None)
    return {"opening_slug": slug, "employer": opening.get("employer"),
            "title": opening.get("title"),
            "method": "evidence-coverage-v2",
            "score": round(raw_score, 2) if raw_score is not None
                     else None,
            "score_unrounded": raw_score, "threshold": threshold,
            "qualifies": raw_score is not None
                         and raw_score >= threshold,
            "unknown_weight_percent": round(unknown_share, 2)
                                      if unknown_share is not None
                                      else None,
            "unknown_could_cross_threshold": (
                raw_score is not None and raw_score < threshold <= maximum),
            "weighted_earned": earned, "weighted_possible": denominator,
            "assessments": normalized,
            "interest_alignment": opening.get("interestAlignment",
                                              "uncertain"),
            "recorded_coverage_score": opening.get("coverageScore"),
            "recorded_unknown_share": opening.get("unknownShare"),
            "warning": "Evidence coverage is a heuristic, not a hiring "
                       "probability. Unknown is not a confirmed gap."}


def _verified_date(opening):
    # Retrieval time never substitutes for the posting date.
    value = opening.get("postingDate") \
        if opening.get("postingDateVerified") else None
    if not value:
        return -1
    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")).date().toordinal()
    except (ValueError, TypeError):
        raise ValueError(
            f"Invalid verified posting date for {opening['slug']}")


def rank_openings(kit, threshold=30.0):
    ranked, below, unscored = [], [], []
    for opening in kit["openings"]:
        result = score_opening(kit, opening, threshold)
        result.update({
            "posting_date": opening.get("postingDate"),
            "posting_date_verified": bool(
                opening.get("postingDateVerified")),
            "source_url": opening.get("sourceUrl")})
        if result["score"] is None:
            unscored.append(result)
        elif result["qualifies"]:
            ranked.append((result, opening))
        else:
            below.append(result)
    ranked.sort(key=lambda pair: (
        -pair[0]["score_unrounded"],
        -INTEREST.get(pair[0]["interest_alignment"], 1),
        -_verified_date(pair[1]), pair[0]["opening_slug"]))
    return {"profile_id": kit["profile_id"], "threshold": threshold,
            "ranked": [r for r, _ in ranked],
            "below_threshold": below, "unscored": unscored,
            "coverage_note": "Only openings recorded in this kit are "
                             "represented; this is not an exhaustive "
                             "market search."}


def duplicate_key(opening):
    """Return a review hint, not authority to merge distinct requisitions."""
    employer = _text_key(opening.get("employer", ""))
    if not employer:
        return None
    if opening.get("reqId"):
        return (employer, "requisition",
                str(opening["reqId"]).casefold())
    if opening.get("sourceUrl"):
        # Query parameters may carry requisition IDs; preserve them.
        return (employer, "url",
                opening["sourceUrl"].split("#")[0].rstrip("/"))
    if opening.get("title") and opening.get("location"):
        return (employer, "possible", _text_key(opening["title"]),
                _text_key(opening["location"]))
    return None


def find_duplicates(kit):
    groups = {}
    for opening in kit["openings"]:
        key = duplicate_key(opening)
        if key:
            groups.setdefault(key, []).append(opening["slug"])
    return {"profile_id": kit["profile_id"],
            "possible_duplicates": [v for v in groups.values()
                                    if len(v) > 1],
            "note": "Candidate groups for review; distinct requisitions "
                    "remain distinct. Never merge on this output alone."}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True,
                        help="Applicant workspace, not the skills "
                             "directory")
    parser.add_argument("--profile", required=True,
                        help="Applicant profile ID (kit folder)")
    parser.add_argument("--threshold", type=float, default=30,
                        help="Shortlist threshold, unrounded (default "
                             "30; must precede the subcommand)")
    sub = parser.add_subparsers(dest="command", required=True)
    one = sub.add_parser("score", help="Score one opening by slug")
    one.add_argument("--opening", required=True)
    sub.add_parser("rank", help="Rank all openings in the kit")
    sub.add_parser("duplicates",
                   help="List candidate duplicate opening groups")
    args = parser.parse_args(argv)
    try:
        from jobseek_state import KitStore
        store = KitStore(args.workspace, args.profile)
        raw = store.load_kit()
        kit = {"profile_id": args.profile,
               "ledger": raw["ledger"], "openings": raw["openings"]}
        if args.command == "score":
            opening = next((o for o in kit["openings"]
                            if o.get("slug") == args.opening), None)
            if opening is None:
                raise ValueError(f"Unknown opening {args.opening}")
            result = score_opening(kit, opening, args.threshold)
        elif args.command == "rank":
            result = rank_openings(kit, args.threshold)
        else:
            result = find_duplicates(kit)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, KeyError, OSError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
