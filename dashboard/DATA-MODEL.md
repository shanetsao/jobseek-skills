# Job Search Dashboard — Data Model

Normative. This is the exact table/field contract from the reference
implementation's schema. Types are SQLite storage types as declared in
the reference schema (`text` / `integer`); timestamps are
`integer … timestamp_ms` in the reference implementation — stored as
millisecond timestamps, exposed to the client as ISO strings.

Conventions used in every table below:

- `id` — `integer`, primary key, autoincrement, never null, in every table.
- `created_at` / `updated_at` — `integer (timestamp_ms)`, **not null**,
  default = now (set by the application at insert). Present in every table.
- "Nullable: yes" means the column has no `NOT NULL` constraint and no
  default; an absent value is stored as `NULL`.
- Field names below are given as `column_name` (`camelCase` API name
  where it differs).

The worked example applicant is fictional: Dr. Sam Lee.

---

## 1. `openings`

One row per tracked position. **29 data fields**, plus `id`,
`created_at`, `updated_at` (32 columns total).

| # | Column (API) | Type | Nullable | Default | Unique / notes |
|---|---|---|---|---|---|
| 1 | `slug` | text | no | — | **UNIQUE.** URL/record key, e.g. `<employer>-<title>-<suffix>`; also the join key for `package_documents.opening_slug`. |
| 2 | `title` | text | no | — | Role title as on the official posting. |
| 3 | `employer` | text | no | — | Employer name. |
| 4 | `req_id` (`reqId`) | text | yes | — | Requisition / posting ID, if the employer uses one. |
| 5 | `location` | text | yes | — | Free text, e.g. "City, ST — on-site". |
| 6 | `track` | text | no | — | One of the tracks in §8. |
| 7 | `role_family` (`roleFamily`) | text | yes | — | One of the 11 role families in §9; may carry a free-text specialisation suffix after " · " in seeded data. |
| 8 | `status` | text | no | — | One of the pipeline/outcome statuses in §7. Free-text column; vocabulary enforced by the application, not the database. |
| 9 | `legacy_score` (`legacyScore`) | integer | yes | — | Legacy fit %, superseded scoring. Null until scored. |
| 10 | `scorecard_score` (`scorecardScore`) | integer | yes | — | Scorecard score /100. Null until scored. |
| 11 | `coverage_score` (`coverageScore`) | integer | yes | — | **Headline score:** evidence-coverage %, 0–100. Null = not yet rescored — never fabricated. |
| 12 | `unknown_share` (`unknownShare`) | integer | yes | — | Weighted Unknown share %, 0–100, reported beside coverage. |
| 13 | `deadline` | text | yes | — | Calendar date `YYYY-MM-DD`, or null when the posting shows no closing date. Plain date, interpreted in the applicant's timezone (see §12). |
| 14 | `deadline_note` (`deadlineNote`) | text | yes | — | Free text, e.g. "No closing date shown" or a practical-last-day note. |
| 15 | `salary_text` (`salaryText`) | text | yes | — | Pay band exactly as posted, free text. |
| 16 | `source_url` (`sourceUrl`) | text | yes | — | Official careers-page posting URL. Aggregator URLs are leads, not sources. |
| 17 | `jd_summary` (`jdSummary`) | text | yes | — | **Core field 1.** Verified JD summary from the official posting. |
| 18 | `matched` | text | yes | — | Matched evidence, mapped strictly from usable ledger facts. |
| 19 | `gaps` | text | yes | — | Gaps — requirements not claimed. |
| 20 | `why_label` (`whyLabel`) | text | yes | — | One of the why-labels in §11. |
| 21 | `why_text` (`whyText`) | text | yes | — | **Core field 2.** Employer & position background (why this role is open). |
| 22 | `reviews_text` (`reviewsText`) | text | yes | — | **Core field 3.** Employer reviews summary (Glassdoor / Indeed). |
| 23 | `fit_note` (`fitNote`) | text | yes | — | Fit note: score breakdown / band rationale. |
| 24 | `package_version` (`packageVersion`) | text | yes | — | Recorded tailored-package version string, e.g. "Resume v2 · Cover letter · PACKAGE.md". Non-null is one of the Tracker membership signals (§13). |
| 25 | `approval_status` (`approvalStatus`) | text | yes | — | Exact-package approval record as plain text, e.g. "Not approved — awaiting review of the exact package". Silence is not approval. |
| 26 | `next_action` (`nextAction`) | text | yes | — | Next step for this opening. |
| 27 | `flags` | text | yes | — | Flags that live **outside** the score: eligibility, location, start date, employer-review warnings, unverified aggregator claims, etc. |
| 28 | `last_checked` (`lastChecked`) | text | yes | — | Date (`YYYY-MM-DD`) the posting/research was last verified. `saveOpeningResearch` stamps it to today. |
| 29 | `sort_order` (`sortOrder`) | integer | no | `0` | Board ordering key (then `id`). |
| — | `id` | integer | no | autoincrement | Primary key. |
| — | `created_at` (`createdAt`) | integer (timestamp_ms) | no | now | |
| — | `updated_at` (`updatedAt`) | integer (timestamp_ms) | no | now | Bumped on every update. |

An opening is **research-incomplete** when any core field
(`jd_summary`, `why_text`, `reviews_text`) is null/empty.

---

## 2. `blockers`

Standing blockers and open questions for the search as a whole.

| Column (API) | Type | Nullable | Default | Unique / notes |
|---|---|---|---|---|
| `id` | integer | no | autoincrement | Primary key. |
| `title` | text | no | — | |
| `detail` | text | yes | — | |
| `status` | text | no | `"open"` | `open` / `resolved` (enforced by `setBlockerStatus`'s request schema). |
| `created_at` | integer (timestamp_ms) | no | now | |
| `updated_at` | integer (timestamp_ms) | no | now | |

---

## 3. `answers`

The answer bank: reusable application answers.

| Column (API) | Type | Nullable | Default | Unique / notes |
|---|---|---|---|---|
| `id` | integer | no | autoincrement | Primary key. |
| `question` | text | no | — | |
| `answer` | text | no | — | |
| `scope` | text | no | `"universal"` | `universal` or `job-specific`. A job-specific answer never becomes universal on its own. |
| `job_label` (`jobLabel`) | text | yes | — | Which job a job-specific answer belongs to. |
| `note` | text | yes | — | Scope / evidence note. |
| `created_at` | integer (timestamp_ms) | no | now | |
| `updated_at` | integer (timestamp_ms) | no | now | |

Reuse rule: authorization, salary, availability, demographics,
declarations, and consent answers are never guessed; reuse always
re-checks current facts and job relevance.

---

## 4. `ledger_entries`

The master-CV ledger, one row per section, displayed in full in the
Master CV tab in CV order (`sort_order`, then `id`), grouped by
`category`.

| Column (API) | Type | Nullable | Default | Unique / notes |
|---|---|---|---|---|
| `id` | integer | no | autoincrement | Primary key. |
| `section` | text | no | — | Section title, e.g. a position heading. |
| `category` | text | no | — | CV grouping, e.g. Profile; Experience — STAR inventory; Skills — keyword bank; Publications & scholarly record; Dossier detail; Search rules & status. |
| `body` | text | no | — | Section content. Lines starting with "• " render as bullets. |
| `fact_status` (`factStatus`) | text | no | `"user-attested"` | One of the fact statuses in §10. |
| `source_ref` (`sourceRef`) | text | yes | — | Where the fact came from, e.g. a ledger section reference. |
| `sort_order` (`sortOrder`) | integer | no | `0` | CV order. |
| `created_at` | integer (timestamp_ms) | no | now | |
| `updated_at` | integer (timestamp_ms) | no | now | |

---

## 5. `package_documents`

Index of package files. **Metadata only — file bytes are never stored
in the database.** Files live in the applicant-data kit / job-search
workspace and are read on demand by `getDocumentFile` via a privileged
read restricted to that area.

| Column (API) | Type | Nullable | Default | Unique / notes |
|---|---|---|---|---|
| `id` | integer | no | autoincrement | Primary key. |
| `opening_slug` (`openingSlug`) | text | no | — | Slug of the owning opening, or the pseudo-slug **`master-cv`** for the master CV file(s), which belong to no opening. No foreign-key constraint; matched by string. |
| `package_label` (`packageLabel`) | text | no | — | Grouping label for one package (documents are displayed grouped by it). |
| `kind` | text | no | — | Document kind, e.g. `resume`, `cover`, `package` (PACKAGE.md notes), `plan`. |
| `label` | text | no | — | Display label. |
| `filename` | text | no | — | File name as on disk. |
| `rel_path` (`relPath`) | text | no | — | Path relative to the job-search area. No database unique constraint, but `syncDashboardContent` upserts **by `rel_path`** — treat it as the de-facto key. Not exposed in the `getDashboard` payload. |
| `mime_type` (`mimeType`) | text | no | — | Drives display: PDF renders in-page; DOCX is download; text renders as text. |
| `version_label` (`versionLabel`) | text | yes | — | e.g. "v2". |
| `is_current` (`isCurrent`) | integer | no | `0` | Boolean stored as integer 0/1; exposed to the client as a boolean. **Exactly one current version per package/document version** — a single version may exist as both a PDF and a DOCX file (both rows carry that version's `is_current = 1`); superseded versions are kept as history with `is_current = 0`. |
| `sort_order` (`sortOrder`) | integer | no | `0` | Display order; `syncDashboardContent` normalises it to seed order. |
| `created_at` | integer (timestamp_ms) | no | now | |
| `updated_at` | integer (timestamp_ms) | no | now | |

---

## 6. `status_events`

One row per recorded application-status change, with optional
recruiter-email evidence. **No events are seeded** — the table starts
empty and fills only from real recorded changes.

| Column (API) | Type | Nullable | Default | Unique / notes |
|---|---|---|---|---|
| `id` | integer | no | autoincrement | Primary key. |
| `opening_id` (`openingId`) | integer | no | — | The opening changed. No foreign-key constraint in the reference schema; matched by id. |
| `status` | text | no | — | The suite/pipeline status recorded (see §7), after any Tracker-stage mapping (§13). |
| `email_from` (`emailFrom`) | text | yes | — | Sender exactly as it appears in the message. Null when no email is linked. |
| `email_subject` (`emailSubject`) | text | yes | — | Subject exactly as it appears in the message. |
| `email_date` (`emailDate`) | text | yes | — | Message date exactly as recorded. |
| `note` | text | yes | — | Optional note, e.g. that a Tracker stage change has no email linked. |
| `created_at` | integer (timestamp_ms) | no | now | Exposed to the client as `recordedAt` (ISO string) — the recording time of the change. |
| `updated_at` | integer (timestamp_ms) | no | now | |

All status changes go through the single action `recordStatusEvent`,
which updates `openings.status` and inserts the event in one call, so
the board, the Tracker, and the history can never disagree. Email
fields may be omitted only for a change with no email behind it.

---

## 7. Status vocabulary (closed set)

### Pipeline statuses, in pipeline order

1. `Researched`
2. `Verify-first`
3. `Drafting`
4. `Awaiting review`
5. `Approved`
6. `Filling`
7. `Awaiting applicant action`
8. `Submitted`
9. `Responded`
10. `Interview`
11. `Offer`

### Additional (non-pipeline) statuses

- `Eligibility hold`
- `Rejection`
- `Withdrawal`
- `Closed`
- `Screened out`

That is the whole vocabulary: 11 + 5 = 16 statuses. `status` columns are
free text in the database; the application must not write any other
value. Board grouping follows the pipeline order above, with the
additional statuses after it (`Screened out` is rendered separately —
see §14).

Scoring note: evidence coverage is the headline score. Formula:
`coverage = 100 × Σ(weight × credit) ÷ Σ(weight)`, credit Direct = 1,
Transferable = 0.5, Unknown = 0, Gap = 0; weight required ×2,
preferred ×1. The weighted Unknown share is reported beside it.
Eligibility, location, start date, and deadline are flags, never part
of the number. Unrounded coverage ≥30% enters the ranked shortlist.
Legacy and scorecard scores are retained as secondary context only; a
role keeps its existing scores until it is rescored — scores are never
invented to fill a null.

---

## 8. Tracks (closed set)

- `Industry`
- `Academic`
- `Contractor`
- `External`

(`External` covers materials/openings managed in an external system.)

---

## 9. Role families (closed set, 11)

1. `Industry R&D`
2. `Staff scientist (academic / government)`
3. `Core facilities`
4. `Applications / field scientist`
5. `Program management`
6. `Scientific writing`
7. `Tech transfer`
8. `Regulatory science`
9. `Contractor roles`
10. `Government / fellowship`
11. `Other science role`

Scope rule: the search covers every family above — any science role the
applicant can realistically get — not scientist titles only.

---

## 10. Fact statuses (closed set)

| Value | Meaning | Usable for matching/drafting? |
|---|---|---|
| `user-attested` | Explicitly supplied by the applicant. | **Yes** |
| `confirmed` | Extracted from a source and reviewed by the applicant. | **Yes** |
| `pending` | Imported, awaiting the applicant's confirmation. | No |
| `conflicted` | Contradictory records, unresolved. | No |
| `retired` | Superseded. | No |

Only `user-attested` and `confirmed` facts may be used. Default for a
new ledger entry: `user-attested`.

---

## 11. Why-labels (closed set)

The label on `openings.why_text` — why the role is open:

| Value | Display meaning |
|---|---|
| `stated-reason` | Employer-stated hiring reason. |
| `context` | Relevant context; connection to this opening not established. |
| `inference` | Inference — labelled interpretation. |
| `unavailable` | Unavailable — no supported explanation found. |

A reason is never invented. When no source supports an explanation,
the background is saved as a dated not-found note with label
`unavailable`.

---

## 12. Visibility rule, expiry lifecycle, and time semantics

### Visibility

- The Board never shows an opening with `status = Closed` **or** a
  `deadline` date before today. The Board filters client-side;
  `getDashboard` returns **all** openings, because the Tracker (§13)
  must list tracked Closed/past-deadline openings (see the lifecycle
  rule below) — filtering them out of the payload would drop them from
  the Tracker.
- `Screened out` openings are **not** caught by this rule: they stay,
  in their own collapsed section, so they are never resurfaced as new
  (see §14).

### Expiry lifecycle rule (tracked vs untracked)

An opening is **tracked** when tailoring has been initiated — the
Tracker membership rule of §13 (indexed package documents, **or** a
non-null `package_version`, **or** a status at `Drafting` or beyond,
including `Submitted`, `Responded`, `Interview`, `Offer`, `Rejection`,
`Withdrawal`). When in doubt, an opening with a package or any
post-submission status is tracked.

- `cleanupClosedExpired` permanently deletes only **untracked**
  `Closed` or past-deadline openings, cascading to any package
  documents / status events they have (see cascade rules below).
- **Tracked** `Closed` or past-deadline openings are **retained** in
  the database with package and status history intact. They stay off
  the Board (visibility rule above) and stay on the Tracker, where
  their stage continues to be tracked until a terminal stage
  (`Rejected` / `Withdrawn` / `Offer received`).
- `cleanupClosedExpired` returns `{removed, keptTracked}` — the count
  deleted and the count of tracked openings it retained.

### Cascade rules

- `deleteOpening` cascades: deleting an opening also deletes its
  `package_documents` (matched by `opening_slug`) and its
  `status_events` (matched by `opening_id`). No orphaned document or
  event rows may remain.
- The untracked deletions in `cleanupClosedExpired` cascade the same
  way.
- `deleteDocument` removes exactly one `package_documents` row (by
  id; metadata only — the file itself is untouched).
  `deleteStatusEvent` removes exactly one `status_events` row (by id;
  the opening's current status is unchanged).

### Wipe semantics

- `wipeAllData` is the sanctioned sample → real-data wipe. It empties
  **all six tables** (`openings`, `ledger_entries`,
  `package_documents`, `status_events`, `blockers`, `answers`) and
  returns the per-table removed counts. It requires the explicit
  confirmation input `confirm: true`; a call without it is rejected
  and deletes nothing.

### Time semantics

- Server-side date decisions ("today", expiry, cleanup) are computed
  in the **applicant's profile timezone** (`applicant-profile.yaml`
  key `applicant.timezone`; the reference implementation reads it from
  `APPLICANT_PROFILE.timezone` — never hard-coded, never the server's
  zone, never UTC).
- Deadlines are plain calendar dates (`YYYY-MM-DD`). The client's day
  counts keep browser-local behaviour; the profile timezone governs
  server-side decisions.

---

## 13. Tracker stage ↔ status mapping

The Tracker tab shows plain-language stages derived from the pipeline
status. This mapping is normative and identical client- and server-side.

| Tracker stage | Pipeline status written |
|---|---|
| Initiated | any pre-submission status (see below) |
| Applied | `Submitted` |
| Responded | `Responded` |
| Interview scheduled | `Interview` |
| Offer received | `Offer` |
| Rejected | `Rejection` |
| Withdrawn | `Withdrawal` |

Reading (status → stage): `Submitted` → Applied; `Responded` →
Responded; `Interview` → Interview scheduled; `Offer` → Offer received;
`Rejection` → Rejected; `Withdrawal` → Withdrawn; **every other status
→ Initiated**.

Writing (stage → status): Applied → `Submitted`; Responded →
`Responded`; Interview scheduled → `Interview`; Offer received →
`Offer`; Rejected → `Rejection`; Withdrawn → `Withdrawal`; Initiated →
`Drafting` as the nominal target — subject to the no-regression rule:

> **Initiated no-regression rule.** Moving back to Initiated while the
> opening is still in a pre-submission status (`Drafting`,
> `Awaiting review`, `Approved`, `Filling`,
> `Awaiting applicant action`) keeps the opening's exact status and
> writes nothing — it does **not** regress the opening to `Drafting`.
> Moving back to Initiated from a post-submission stage does write
> `Drafting`.

All stage changes are written through `recordStatusEvent` only
(including changes made in the Tracker UI, which record a note stating
no email is linked).

### Tracker membership rule

Membership is **not** affected by the Board visibility rule: a tracked
opening that is `Closed` or past-deadline remains in the Tracker until
a terminal stage (see §12).

An opening appears in the Tracker when tailoring has been initiated,
defined as **any** of:

- it has one or more indexed `package_documents`, **or**
- `package_version` is non-null/non-empty, **or**
- its status is at `Drafting` or beyond: one of `Drafting`,
  `Awaiting review`, `Approved`, `Filling`,
  `Awaiting applicant action`, `Submitted`, `Responded`, `Interview`,
  `Offer`, `Rejection`, `Withdrawal`.

---

## 14. Screened-out rule

`Screened out` openings are kept as a separate, collapsed list on the
Board ("Screened out — do not resurface"). They are excluded from the
stat boxes, the coverage banner denominator, the deadlines strip, the
status groups, and every research/tailor agent request. They exist so a
later search batch can dedupe against them and never resurface them.

---

## 15. Ordering

- `getDashboard` returns openings by `sort_order`, then `id`;
  blockers and answers by `id`; ledger entries by `sort_order`, then
  `id`; documents by `sort_order`, then `id`; status events by `id`
  (the Tracker reverses per-opening lists to show newest first).
- The Board additionally groups openings by status in the §7 pipeline
  order and sorts the deadlines strip nearest-first.

---

## 16. Additive optional fields — match assessments (Option 2 port)

Added 2026-11-18 with the v1 references/scripts port. These fields are
**optional and additive**: existing records without them remain valid,
and dashboards may ignore them. They exist so the matching helper
(`skills/jobseek/scripts/jobseek_match.py`) has computable input.

On an **opening**:

- `assessments` — a list of per-competency assessment objects:
  - `id` (string, unique within the opening),
  - `text` (the competency, in the posting's terms),
  - `group_id` (optional string; shared IDs, or identical normalised
    text, collapse into one OR/umbrella group),
  - `importance`: `required` | `preferred` | `unclassified`
    (weights ×2 / ×1 / ×1),
  - `assessment`: `direct` | `transferable` | `unknown` | `gap`
    (credit 1 / 0.5 / 0 / 0),
  - `evidence`: a list of **ledger entry `section` names** supporting
    the assessment (empty for Unknown/Gap),
  - `rationale` (required for Direct/Transferable and for Gap).
  The helper downgrades a Direct/Transferable group to Unknown when
  any cited ledger entry is not `user-attested`/`confirmed`. An
  opening with no `assessments` is unscored by the helper (never 0%);
  its recorded `coverageScore`/`unknownShare`, if any, came from
  outside the helper.
- `interestAlignment`: `aligned` | `uncertain` | `misaligned` — the
  recorded interest used as the ranking tiebreak after coverage.
- `postingDate` (ISO date/datetime) and `postingDateVerified`
  (boolean) — the ranking's date tiebreak uses the posting date **only
  when verified**; retrieval time never substitutes.

Worked example: the fictional sample's NovaCell opening carries 18
assessments (total weight 25) computing coverage 68.0 / Unknown 12.0,
agreeing with its recorded scores.
