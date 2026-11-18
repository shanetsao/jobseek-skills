# Onboarding: build the applicant-data kit

Onboarding creates one applicant's kit (see `records.md`) and nothing
else. It is complete only when the kit validates and the applicant has
reviewed what was recorded about them.

## Steps

1. **Create the kit.** `jobseek_state.py init` with the applicant's
   display name (see `state-commands.md`). One profile ID per
   applicant; never reuse or share a kit between people.
2. **Fill `profile.yaml`** from `templates/applicant-profile.template.yaml`:
   identity, goal statement, tracks and role families, preferred
   regions, salary ideal, earliest start (and whether that date is
   internal-only), constraints and flags (each with its source), the
   never-claim list, and preferences (fit threshold, package style).
   Anything the applicant has not stated stays blank — do not infer a
   constraint, a region, or a start date.
3. **Preserve the sources.** Copy the applicant's existing CV/resume,
   publication list, and any other evidence into `sources/`
   **unmodified**. The ledger is derived from these; they are never
   edited to match it.
4. **Build the ledger.** One entry per `ledger.json` section (identity,
   positioning, education, experience by role, skills, publications,
   awards, presentations, mentoring, references, internal constraints).
   Experience entries carry STAR detail — situation, task, action,
   result — with quantified results where the applicant supplied them.
   Every entry gets a `factStatus`: `user-attested` for what the
   applicant states, `confirmed` only when checked against a source,
   `pending` for anything awaiting confirmation. Numbers the applicant
   has not supplied are left out, not estimated.
5. **Record the never-claim list twice**: in `profile.yaml`
   (`constraints.never_claim`) and in the relevant ledger sections, so
   both the profile-level check and per-opening assessment see it.
   Typical entries: skills the applicant directs tools to use but does
   not independently hold, techniques never performed, domains with no
   experience.
6. **Validate and show.** Run `validate` (must pass) and `show`, then a
   `snapshot` so the starting state is recoverable.
7. **Applicant review.** The applicant reads `LEDGER.md` and the
   profile. Corrections are made in `ledger.json`/`profile.yaml` (or
   reconciled from `LEDGER.md` edits — see `records.md`), statuses
   updated, and the kit re-validated. Onboarding is not done until the
   applicant has seen the record that will be used as evidence.

## What onboarding never does

- It does not import another person's kit, the fictional sample's
  contents, or a previous employer's confidential material.
- It does not search for jobs, score openings, or draft documents —
  those are the search/tailor workflows, and they need a reviewed
  ledger first.
- It does not treat a v1 `state.json` as live data. If the applicant
  has one, convert it once into kit files (facts → ledger entries with
  their statuses, jobs → openings, documents → the index), validate,
  and keep the original under `sources/` as a preserved source.
