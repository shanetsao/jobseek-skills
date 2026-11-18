# State commands: jobseek_state.py

The state helper operates on the applicant-data kit (see `records.md`).
Standard library only; no network; no hard-coded paths. Every command
takes `--workspace` (the folder that contains `profiles/`) and
`--profile` (the profile ID = kit folder name) **before** the
subcommand. Exit code 0 = success, 2 = error or invalid kit; errors are
printed as JSON on stderr, results as JSON on stdout.

```text
python3 skills/jobseek/scripts/jobseek_state.py \
  --workspace <workspace> --profile <profile-id> <command> [options]
```

## init — create a kit

```bash
# empty kit skeleton for a new applicant
python3 ... --profile sam-lee init --display-name "Dr. Sam Lee"

# seed from an existing kit folder (e.g. the sample dataset, or a kit
# exported from another platform)
python3 ... --profile sam-lee init \
  --from examples/sample-applicant
```

Creates `profiles/<profile-id>/` with `profile.yaml`, empty-but-valid
kit files, `packages/`, `sources/`, `history/`, and `reconciliation/`.
With `--from`, the kit files and `packages/` are copied; a source file
named `applicant-profile.yaml` is accepted and stored as
`profile.yaml`. Refuses to overwrite an existing kit. The display name
is taken from `--display-name` or from the source kit's profile.

## show — kit summary

```bash
python3 ... --profile sam-lee show
```

Prints counts: ledger entries by fact status (and how many are usable),
openings by status, indexed documents, answers, status events,
blockers, and whether manual `LEDGER.md` edits are pending.

## validate — full kit check

```bash
python3 ... --profile sam-lee validate
```

Checks, collecting **all** issues before reporting:

- profile: name present; `earliest_start_visibility` is
  `internal`/`shareable` when set.
- ledger: every entry has a unique `section`, a `title`, a `body`, and a
  `factStatus` in `user-attested | confirmed | pending | conflicted |
  retired`.
- openings: required fields (`slug`, `employer`, `title`, `status`,
  `track`, `whyLabel`); `track`, `status`, `roleFamily`, `whyLabel`
  against the DATA-MODEL vocabularies; scores within 0–100; deadline in
  `YYYY-MM-DD` form; `assessments` structure (unique IDs, valid
  importance/assessment values, evidence naming real ledger sections).
- documents-index: required fields; the indexed file **exists** in the
  kit; `filename` matches the path; `openingSlug` names a real opening
  (or `master-cv`); at most one `current` document per
  opening/kind/version/mime.
- answers: a question and an answer; `scope` is `global` or a real
  opening slug.
- status-events: the opening exists; the status is a DATA-MODEL status;
  email evidence is all three of sender/date/subject or none.
- blockers: a title and an owner.

Exit 2 with `"valid": false` and the full issue list when anything
fails; warnings (e.g. a package folder without `PACKAGE.md`) do not
fail validation. Observed on the fictional sample kit: valid, with the
single warning that `packages/master-cv/` has no `PACKAGE.md`.

## render — regenerate LEDGER.md

```bash
python3 ... --profile sam-lee render
```

Regenerates `LEDGER.md` from `ledger.json`. Refuses (exit 2) while
manual `LEDGER.md` edits are pending — reconcile first.

## snapshot / checkpoint — copy the kit into history/

```bash
python3 ... --profile sam-lee snapshot --label "before import"
```

Copies the kit files and `packages/` into
`history/snapshot-<UTC timestamp>/` and writes a `manifest.json` with
SHA-256 hashes. `checkpoint` is an alias.

## reconcile — resolve manual LEDGER.md edits

```bash
python3 ... --profile sam-lee reconcile \
  --resolution reviewed_no_fact_changes
# or, after putting reviewed fact changes into ledger.json:
python3 ... --profile sam-lee reconcile \
  --resolution import_reviewed_changes
```

Preserves the edited `LEDGER.md` as
`reconciliation/LEDGER-before-<timestamp>.md`, regenerates `LEDGER.md`
from `ledger.json`, and resets the edit baseline. It never silently
overwrites a hand edit. If there are no pending edits it says so and
changes nothing.
