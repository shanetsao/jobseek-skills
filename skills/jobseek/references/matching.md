# Matching: evidence coverage with jobseek_match.py

Evidence coverage is the headline fit score. It is a declared heuristic
for ordering a search — **not** a hiring probability, and never a
substitute for reading the posting.

## Inputs: per-competency assessments

The helper reads `assessments` recorded on each opening in
`openings.json` (an additive field; see `dashboard/DATA-MODEL.md`).
Each assessment is one competency from the posting:

```json
{
  "id": "req-flow",
  "text": "Multiparameter flow cytometry panel design and analysis",
  "group_id": "optional — alternatives/umbrella grouping",
  "importance": "required | preferred | unclassified",
  "assessment": "direct | transferable | unknown | gap",
  "evidence": ["ledger section names"],
  "rationale": "why this assessment, in one or two sentences"
}
```

Rules (carried from v1, re-based on the kit):

- **Credit:** Direct 1.0, Transferable 0.5, Unknown 0, Gap 0.
  **Weight:** required ×2, preferred ×1, unclassified ×1.
  Coverage = 100 × Σ(weight × credit) / Σ(weight). The Unknown share is
  the same denominator over Unknown-weighted groups.
- Evidence cites ledger entries **by section name**. A Direct or
  Transferable assessment whose cited evidence is missing, or includes
  **any** entry that is not `user-attested`/`confirmed`, is
  **downgraded to Unknown** by the helper — partial unreviewed claims
  cannot borrow a reviewed fact's credibility. The downgrade is
  reported, with its reason, in the output.
- Direct/Transferable needs a rationale; a Gap needs an explicit reason
  (e.g. the requirement is on the applicant's never-claim list). An
  Unknown is an absence of evidence, not a weakness — never record a
  Gap without evidence for the gap itself.
- Grouping: assessments sharing a `group_id`, or with identical
  normalised text, collapse into one group (OR alternatives, or an
  umbrella requirement with examples). The group's weight is the
  maximum member weight; one satisfied alternative satisfies the group;
  if none is satisfied, any Unknown member keeps the group Unknown.
- An opening with **no** `assessments` is *unscored* (score `null`),
  never 0%. Its recorded scores, if any, came from outside this helper
  and are reported alongside, not replaced.

## Commands

Global options (`--workspace`, `--profile`, `--threshold`) come before
the subcommand. Default threshold 30 (the workflow's apply-if-≥30%
rule); comparison uses the unrounded score.

```bash
# score one opening
python3 skills/jobseek/scripts/jobseek_match.py \
  --workspace <ws> --profile <id> score --opening <slug>

# rank the whole kit
python3 skills/jobseek/scripts/jobseek_match.py \
  --workspace <ws> --profile <id> rank

# candidate duplicate openings
python3 skills/jobseek/scripts/jobseek_match.py \
  --workspace <ws> --profile <id> duplicates
```

Ranking order: coverage (descending, unrounded), then recorded
interest alignment (`interestAlignment`: aligned > uncertain >
misaligned), then **verified** posting date (newest first; an
unverified date never counts — retrieval time is not a posting date),
then slug. Below-threshold and unscored openings are returned in their
own lists, not dropped.

Duplicates are review hints only: same employer + requisition ID, same
employer + canonical URL, or same employer + title + location. Distinct
requisitions stay distinct; never merge on this output alone.

## Worked check (fictional sample)

On `examples/sample-applicant/`, the NovaCell opening carries 18
assessments (7 required, 11 preferred; total weight 25). The helper
computes **coverage 68.0, Unknown share 12.0** (earned weight 17:
5 required Direct, 6 preferred Direct, 2 preferred Transferable; one
preferred recorded Direct is downgraded to Unknown because its only
evidence is a `pending` ledger entry). This agrees exactly with the
coverage 68 / Unknown 12 recorded on the opening and in its
`PACKAGE.md`. The other three sample openings carry no assessments and
report as unscored.
