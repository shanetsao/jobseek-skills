# Matching helper

Use `scripts/jobseek_match.py` from the main jobseek skill. It reads a profile through the shared state helper; it does not write scores or search the web. Persist the resulting search decisions through the state helper when needed.

```sh
python /path/to/skills/jobseek/scripts/jobseek_match.py --workspace /applicant/workspace --profile alex score --job job-001
python /path/to/skills/jobseek/scripts/jobseek_match.py --workspace /applicant/workspace --profile alex rank
python /path/to/skills/jobseek/scripts/jobseek_match.py --workspace /applicant/workspace --profile alex duplicates
```

Use the available Python runtime. `--threshold` defaults to 30 and precedes the subcommand. This chosen heuristic is not a validated hiring predictor.

## Requirement contract

Each job has `requirements`, a list of objects with unique `id`, `text`, `importance` (`required`, `preferred`, `unclassified`), `assessment` (`direct`, `transferable`, `unknown`, `gap`), `evidence_fact_ids`, and `rationale`. `group_id` is optional but essential for alternatives and examples of the same competency.

Normalize the actual JD before scoring. An OR statement such as “Python or R” is one group. An umbrella competency and its examples belong in one group, rather than generating additional points. Truly independent requirements remain separate. The helper collapses matching group IDs and normalized identical text; it cannot recognize semantic duplication without your annotations. Preserve the original JD and requirement locators.

Required groups weigh 2; preferred and unclassified groups weigh 1. A group earns 1 for direct evidence or 0.5 for justified transferable evidence. Unknown and confirmed gaps earn 0. Every cited fact must belong to this profile and have `user_attested` or `confirmed` status. A claim citing pending/conflicted/retired facts becomes unknown, even if it also cites usable facts. Evidence classification and relevance still require careful human/agent judgment; record a rationale. A gap requires explicit supporting rationale and must not be inferred from silence.

For OR groups, use the strongest supported alternative. If no alternative is supported and any is unknown, the group remains unknown. Keep constraints such as work authorization and applicant nonnegotiables in `constraints`, outside the numeric score. Job `interest_alignment` is `aligned`, `uncertain`, or `misaligned`, based on recorded preferences.

## Output and ranking

The score is 100 × weighted evidence / total requirement weight. Eligibility uses the unrounded score. A JD with no scorable requirements is unscored, never 0% fit. Show `unknown_weight_percent` beside every score and act on `unknown_could_cross_threshold` with targeted ledger questions. Keep below-threshold/unscored candidates in the search record, not the main qualifying list.

One ranked list includes every found job at or above the threshold in the recorded batch, including visible constraint-conflict flags. Sort by unrounded score descending, then interest alignment (aligned, uncertain, misaligned), then verified posting date newest first; missing/unverified dates last, job ID breaks remaining ties. Populate `posting_date` with an ISO date and `posting_date_verified: true` only after verifying it. Retrieval time is not posting time.

The duplicate helper returns candidate groups; review them before merging. Distinct requisitions remain distinct. A canonical URL query can contain an actual requisition ID and is therefore preserved.

Research every qualifying match before calling the shortlist complete. The numeric helper carries through `research` but does not validate research claims; follow [search workflow](search.md). Report actual search scope, inaccessible sources, excluded duplicates, and remaining batches. Never claim exhaustive market coverage.
