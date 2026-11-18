# Records: the applicant-data kit is the single source of truth

v2 stores everything about one applicant in one **applicant-data kit**.
There is no second store. (v1 used a `state.json` schema-v1 file with a
change-operation API; in v2 a `state.json` may only ever appear as a
**legacy import source** — read it once, convert it into kit files, and
never treat it as a competing authority afterwards.)

## Kit layout

```text
profiles/<profile-id>/
├── profile.yaml            # applicant-profile.yaml filled in: identity,
│                           # goal, tracks, regions, constraints, flags,
│                           # never-claim list, preferences
├── ledger.json             # the ledger: structured evidence entries
├── LEDGER.md               # the readable render of ledger.json
├── openings.json           # one object per opening (DATA-MODEL vocab)
├── documents-index.json    # every produced document, by opening
├── answers.json            # reusable application answers (with scope)
├── status-events.json      # dated outcome events, incl. email evidence
├── blockers.json           # applicant action items
├── packages/<opening-slug>/  # PACKAGE.md + resume/cover files
├── sources/                # preserved source material, unmodified
├── history/                # snapshot folders (checkpoint copies)
└── reconciliation/         # preserved LEDGER.md copies from reconcile
```

The dashboard (Muse Space or ChatGPT Site) reads and writes these same
files — or a database seeded from them — never a parallel copy. The kit
is the interchange format between platforms: it is what the applicant
hands from one agent to another.

## Per-profile isolation

Every command and every read is scoped to one profile ID. Never read,
merge, copy, or summarise another applicant's kit — including a spouse's
or a sample's — into this one. The fictional sample dataset
(`examples/sample-applicant/`) is a format example only; its contents
must never enter a real kit.

## The ledger and fact statuses

`ledger.json` is a list of entries. Each entry has a unique `section`
(the evidence identifier used everywhere else), `title`, `factStatus`,
and `body` (markdown, STAR detail for experience entries). Only two
statuses are usable as evidence:

| Status | Meaning | Usable |
|---|---|---|
| `user-attested` | The applicant stated it | Yes |
| `confirmed` | Verified against a source | Yes |
| `pending` | Recorded, not yet confirmed | No |
| `conflicted` | Sources disagree; needs resolution | No |
| `retired` | Superseded; kept for history | No |

Rules carried over from v1, unchanged in spirit:

- Evidence-based claims cite ledger entries **by section name**. A claim
  with no usable entry behind it is an Unknown or a Gap, never a
  strength.
- Never upgrade a status silently. A status changes only on the
  applicant's word or a cited source, and the change is recorded.
- Internal-visibility material (constraints, earliest start, salary)
  never appears in application-facing documents.
- Sources the applicant provides (CVs, papers, letters) are preserved
  **unmodified** under `sources/`; the ledger is derived from them, and
  any conflict is surfaced, not smoothed over.

## LEDGER.md and manual edits

`LEDGER.md` is generated from `ledger.json` by the state helper's
`render` command. If the applicant edits `LEDGER.md` by hand, the helper
detects the divergence (it hashes the file against the last accepted
baseline). Recovery is explicit, never silent:

1. `reconcile --resolution reviewed_no_fact_changes` — the edits were
   presentational; the edited file is preserved under
   `reconciliation/`, and `LEDGER.md` is regenerated.
2. The edits contain fact changes — first put the reviewed changes into
   `ledger.json`, then `reconcile --resolution
   import_reviewed_changes`.

`render` refuses to run while manual edits are pending, so a hand edit
can never be overwritten by accident.

## Openings, documents, approvals

- `openings.json` uses the DATA-MODEL vocabularies for `track`,
  `status`, `roleFamily`, and `whyLabel`. Scores recorded on an opening
  (`coverageScore`, `unknownShare`, `scorecardScore`) come from the
  workflow that produced them; the matching helper computes coverage
  from the opening's `assessments` (see `matching.md`) and reports both
  side by side — it never overwrites the recorded values.
- `documents-index.json` points at real files under `packages/`. Every
  index entry must name an existing file; the validator enforces this.
  At most one document per opening/kind/version/mime is `current`.
- A package is approved only by an **exact-package approval record**:
  the applicant approves the exact files (by name and version) in
  `PACKAGE.md`. Silence is not approval, approval of one package is not
  approval of another, and any change after approval returns the package
  to not-approved. The documents helper's manifest records file hashes
  so "the exact files approved" is checkable, not a memory.
- `status-events.json` records outcome changes (responded, interview,
  rejected, …). After submission, an event may cite the recruiter email
  that evidences it (sender, date, subject) — all three fields or none.

## Snapshots

`snapshot` (alias `checkpoint`) copies the whole kit, packages included,
into `history/snapshot-<UTC timestamp>/` with a hash manifest. Take one
before bulk edits, imports, or a platform migration. Snapshots are
history, not a second live copy: never edit inside one.

## Validation

Run the state helper's `validate` after any bulk change and before
handing the kit to another platform. It checks profile fields, ledger
statuses and unique sections, opening vocabularies and score ranges,
assessment structure, document-index file existence, answer scoping,
status-event references, and blocker fields — and reports **all**
problems, not just the first. See `state-commands.md`.
