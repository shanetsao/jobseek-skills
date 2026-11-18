# Job Search Dashboard — Specification (SPEC)

Status: normative. Version: **2.0.2** (see the repository `VERSION` file).
Where this document and `DATA-MODEL.md` / `UI-SPEC.md` disagree, this
document governs purpose and behaviour, `DATA-MODEL.md` governs fields and
vocabularies, and `UI-SPEC.md` governs presentation. A build is conforming
only if it passes every item in `ACCEPTANCE.md`.

The worked example applicant throughout this specification is fictional:
**Dr. Sam Lee**. No real applicant's name, employer, requisition number,
score, address, or immigration detail appears in this specification.

---

## 1. Purpose

The dashboard is the living surface for a ledger-driven job search by a
scientist moving beyond a postdoctoral appointment into any science role
they can realistically get — not scientist titles only.

It must let the applicant, at a glance and on a phone:

1. See every tracked opening with its fit score, pipeline status, deadline,
   and next action.
2. Read, for every opening, a verified job-description (JD) summary, a
   labelled employer & position background, and employer reviews — filled
   when the position is searched/found, not only when a package is built.
3. Review the exact tailored package (JD + tailored CV/resume + cover
   letter + background) before anything is submitted.
4. See the full master CV (the complete ledger) that every tailored
   document is built from.
5. Track every position whose tailoring has been initiated through its
   application stages, with recruiter-email evidence linked to status
   changes.
6. Ask the agent to research an opening or build a tailored package from
   the dashboard itself (see §7, the agent-request model).
7. Manage standing blockers and a reusable answer bank.

The dashboard never submits an application, never contacts anyone, and
never invents a fact, a score, a background, or a review. Missing research
stays visibly missing until real research fills it, or is closed out with
an explicit dated not-found note (see §6).

---

## 2. Four-layer architecture

The system is four layers. Keeping them separate is what makes the same
specification buildable on more than one platform.

| Layer | What it is | What it contains |
|---|---|---|
| 1. Specification | This `dashboard/` folder | `SPEC.md`, `DATA-MODEL.md`, `UI-SPEC.md`, `ACCEPTANCE.md`, `DATA-PLAN.template.md`. Platform-neutral, normative, contains no real applicant data. |
| 2. Reference implementation | `dashboard/reference/` | A working implementation to start from and to diff behaviour against. It is a reference, not a requirement to reuse its stack: a conforming build may use any stack that reproduces the data model, the actions and their semantics, and the UI behaviours. |
| 3. Applicant-data kit | Outside this public repository (or in a separate private repository) | The applicant's own profile (`applicant-profile.yaml`), ledger, tracker/openings, packages and their documents, answer bank, blockers. The kit is the source of truth for content; the dashboard database is an index and working copy seeded/synced from it. See `applicant-data/README.md`. |
| 4. Adapters | `adapters/<platform>/` | One build prompt / mapping per platform (Muse; ChatGPT Sites). An adapter translates the spec into that platform's build and runtime idioms. Adapters may differ only where §7 says they may. |

Rules that follow from the layering:

- No layer may smuggle real applicant data into a lower-numbered layer.
  The spec and the reference implementation ship with fictional sample
  data only (Dr. Sam Lee).
- Content flows kit → dashboard (seed/sync actions), and dashboard →
  kit only through the save actions in §5, never by direct database
  edits from chat.
- Document bytes never live in the database (see `DATA-MODEL.md`):
  `package_documents` is an index of paths; files live in the kit /
  workspace and are read on demand.

---

## 3. Data model — summary

Six tables. Full field-by-field definitions, types, nullability,
defaults, and uniqueness are in `DATA-MODEL.md`.

| Table | Holds |
|---|---|
| `openings` | One row per tracked position: identity (slug, title, employer, requisition ID, location), track, role family, pipeline status, three score fields (legacy, scorecard, evidence-coverage + unknown share), deadline, salary text, source URL, the research fields (JD summary, matched, gaps, why-label/text, reviews, fit note), the package/approval record (package version, approval status), next action, flags, last-checked, sort order. |
| `blockers` | Standing blockers / open questions for the search as a whole (title, detail, status `open` by default). |
| `answers` | The answer bank: reusable application answers (question, answer, scope `universal` by default, optional job label, note). |
| `ledger_entries` | The master-CV ledger, one row per section (section, category, body, fact status `user-attested` by default, source reference, sort order). Displayed in full in the Master CV tab. |
| `package_documents` | Index of package files (opening slug — including the pseudo-slug `master-cv` — package label, kind, label, filename, relative path, MIME type, version label, exactly-one-current flag, sort order). Metadata only; bytes stay in files. |
| `status_events` | One row per recorded application-status change for an opening, with optional recruiter-email evidence (sender, subject, date, exactly as they appear in the message) and an optional note. Starts empty; never seeded. |

Vocabularies (pipeline statuses, tracks, role families, fact statuses,
why-labels, Tracker stages) are closed sets defined in `DATA-MODEL.md`.
Visibility rule: an opening whose status is `Closed`, or whose deadline
is before today in the applicant's timezone, is excluded from the board
(see `DATA-MODEL.md` §12). Lifecycle rule: expiry cleanup deletes only
**untracked** Closed/past-deadline openings; a **tracked**
(tailoring-initiated) opening is retained — off the Board, on the
Tracker, with its package and status history — until a terminal stage
(see `DATA-MODEL.md` §12).

---

## 4. Workflow integration — the 7 stages

The dashboard is stage 7's surface for a seven-stage workflow. The
Workflow tab presents these stages (see `UI-SPEC.md`), and every other
tab exists to serve one of them:

1. **Career ledger.** One evidence-backed ledger is the master source.
   Only `user-attested` or `confirmed` facts are usable for matching and
   drafting; `pending`, `conflicted`, and `retired` facts are not.
   Nothing enters a tailored document unless it is in the ledger or the
   applicant confirms it.
2. **Broad discovery.** Search batches span job boards, employer career
   sites, government portals (including USAJOBS-style portals),
   universities and institutes, and specialist boards — deduplicated,
   with sources checked and coverage gaps/omissions recorded. Scope is
   any science role family the applicant can realistically get.
3. **Evidence coverage + employer research.** Each JD's requirements are
   grouped into competencies and credited Direct (1), Transferable (0.5),
   Unknown (0), or Gap (0); required ×2, preferred ×1. Coverage % is the
   headline score, with the weighted Unknown share beside it.
   Eligibility, location, start date, and deadline are flags — never
   inside the number. Unrounded coverage ≥30% enters the ranked
   shortlist; the applicant selects what to pursue. At search time every
   position also gets its verified JD summary, labelled employer &
   position background, and employer reviews filled (see §6).
4. **Tailored materials.** Industry = 2-page resume; academic = full CV;
   bullets in STAR form with quantified results from the ledger; cover
   letters science-precise, no generic phrasing. Every document uses the
   one format standard (see §8). A mandatory grammar-proof pass and page
   checks gate every package.
5. **Exact-package approval.** The applicant reviews the exact JD +
   tailored CV/resume + cover letter + employer background together.
   Approval is recorded per package (JD version, document versions, fact
   revisions, answer set). Silence is not approval, and approval for one
   opening never transfers to another. Any change returns the package to
   review.
6. **Apply assist, page by page.** Forms are filled and verified page by
   page with checkpoints. The applicant clicks every Next / Continue /
   Submit and handles authentication, signatures, and consent. A
   submission is recorded only from an observed confirmation or the
   applicant's own report — a filled form is not a submission.
7. **Tracking & the weekly refresh.** Statuses follow the suite states in
   `DATA-MODEL.md`; interview / offer / rejection / withdrawal / closure
   are recorded only from actual events or the applicant's reports.
   Status changes driven by recruiter email are recorded with that email
   as evidence via `recordStatusEvent`. The weekly refresh is specified
   in §9.

---

## 5. Actions — summary

The dashboard exposes **25 actions**. This count is verified against
the reference implementation's action module. (The v2.0.0 list had 22;
2.0.1 added `wipeAllData`, `deleteDocument`, and `deleteStatusEvent`,
and gave `cleanupClosedExpired` the tracked-opening lifecycle rule.)
Spec 2.0.2 gives `wipeAllData`, `deleteDocument`, and
`deleteStatusEvent` UI controls (see `UI-SPEC.md`) with no change to
their contracts.

Each action below is one line; request/response schemas and field limits
come from the reference implementation, and form inputs take their limits
from the request schemas (see `UI-SPEC.md` §Forms and errors).

| # | Action | Semantics |
|---|---|---|
| 1 | `getDashboard` | Returns all openings (including tracked Closed/past-deadline ones — the Board applies the visibility rule client-side, and the Tracker needs them), blockers, answers, full ledger entries, the package-document index, and all status events (with linked email evidence) in one payload. |
| 2 | `seedFromTracker` | One-time populate of openings, blockers, and answers from the kit's tracker/ledger when those tables are empty; no-op when rows exist; never overwrites edits. |
| 3 | `addOpening` | Adds one opening to the board (including JD/background/reviews fields filled at search time); generates its unique slug. |
| 4 | `updateOpening` | Updates one opening's status, scores, deadline, package/approval record, next action, flags, and research fields. |
| 5 | `deleteOpening` | Deletes one opening, cascading to its package documents (by opening slug) and its status events (by opening id) — no orphans. |
| 6 | `cleanupClosedExpired` | Expiry cleanup under the lifecycle rule: permanently deletes every **untracked** `Closed` or past-deadline opening (cascading to its documents/events), and **retains** every tracked one (package + status history intact, off the Board, on the Tracker until a terminal stage). Dates are judged in the applicant's profile timezone. Returns `{removed, keptTracked}`. |
| 7 | `saveOpeningResearch` | Saves researched JD summary, background (label + text), reviews, and verified matched/gaps/fit/source/salary/deadline fields onto one opening; stamps `last_checked` to today. |
| 8 | `requestOpeningResearch` | Requests background research for one opening still missing any of the three core fields; returns whether it started and which fields are missing; no-op (nothing missing) when complete. |
| 9 | `requestAllMissingBackgrounds` | Requests background research covering every non-screened-out, non-closed, non-expired opening still missing any core field; returns whether it started and the incomplete count. |
| 10 | `requestTailoredPackage` | Requests a tailored CV/resume + cover letter for one opening; moves an early-stage (`Researched` / `Verify-first`) opening to `Drafting`; hidden in the UI and refused server-side for `Closed` and `Screened out`. |
| 11 | `recordStatusEvent` | Records one status change (suite status or Tracker stage label, mapped server-side), updates the opening's status to match, and stores the event with its optional email evidence — the single write path for all stage changes. |
| 12 | `addBlocker` | Adds a standing blocker / open question (status `open`). |
| 13 | `setBlockerStatus` | Marks one blocker `open` or `resolved`. |
| 14 | `deleteBlocker` | Deletes one blocker. |
| 15 | `addAnswer` | Adds one reusable answer to the answer bank (scope defaults to `universal`). |
| 16 | `updateAnswer` | Updates one answer-bank entry's answer, scope, job label, or note. |
| 17 | `deleteAnswer` | Deletes one answer-bank entry. |
| 18 | `addLedgerEntry` | Adds one section to the master-CV ledger (fact status defaults to `user-attested`). |
| 19 | `updateLedgerEntry` | Updates one ledger section's title, category, body, fact status, or source reference. |
| 20 | `deleteLedgerEntry` | Deletes one ledger section. |
| 21 | `syncDashboardContent` | Idempotent content sync: seeds ledger entries when empty, upserts the package-document index by path (current flags and version labels track the package folders), refreshes known superseded package-version strings, backfills still-empty detail fields, and inserts a known-missing opening if absent; never overwrites existing content or edits. |
| 22 | `getDocumentFile` | Reads one indexed package document from the kit/workspace and returns it for display: PDF as a viewable/downloadable file, other binaries as a download, text (e.g. `PACKAGE.md`) as text; reports not-found distinctly. Privileged file read, restricted to the job-search area. |
| 23 | `deleteDocument` | Deletes one package-document index row by id (metadata only; the file in the kit/workspace is untouched). |
| 24 | `deleteStatusEvent` | Deletes one status-event history row by id; the opening's current status is unchanged. |
| 25 | `wipeAllData` | The sanctioned sample → real-data wipe: empties **all six tables** and returns the per-table removed counts. Requires the explicit confirmation input `confirm: true` — a call without it is rejected and deletes nothing. |

Idempotency rule: `seedFromTracker` and `syncDashboardContent` are safe
to re-run — a second run over unchanged source data changes nothing
(see `ACCEPTANCE.md`).

---

## 6. Research completeness rule

The three **core fields** of an opening are `jd_summary`, `why_text`
(employer & position background, with `why_label`), and `reviews_text`.
An opening is **incomplete** when any core field is empty
(`backgroundMissing` in the reference implementation).

- Every position is added with all three filled at search time.
- No field may be left blank by a research pass: a field that genuinely
  cannot be found after a real search is saved as an explicit dated
  not-found note — for the background, with `why_label = unavailable` —
  never fabricated and never silently empty.
- The Board shows the coverage count and offers one action to research
  and fill all incomplete openings (`requestAllMissingBackgrounds`);
  each card and each report offers the per-opening action
  (`requestOpeningResearch`).
- Matched evidence and gaps are mapped strictly from usable ledger
  facts. Employer background claims carry a why-label:
  `stated-reason`, `context`, `inference`, or `unavailable`
  (definitions in `DATA-MODEL.md`).

---

## 7. Agent-request model — and the ONE parity difference

Three actions are **agent requests**, not ordinary CRUD:
`requestOpeningResearch`, `requestAllMissingBackgrounds`, and
`requestTailoredPackage`. An agent request asks the platform's agent to
do research or drafting work outside the request/response cycle and to
save the result back through the ordinary save actions
(`saveOpeningResearch` for research; `updateOpening` plus the document
index for a finished package).

Everything about these requests — which openings qualify, what the agent
is instructed to do (the prompt templates in §10), what it saves, and
what the UI shows while work is pending — is identical on every
platform, **except the execution mechanism, which is the one and only
parity difference between platforms:**

- **Muse:** the action spawns a background agent task
  (`ctx.agent.spawnTask`), deduplicated per opening (one in-flight
  research task per opening; one in-flight tailor task per opening; one
  in-flight fill-all task). The task runs unattended and saves through
  the save actions when done.
- **ChatGPT Sites:** a Site cannot run an agent in the background. The
  action instead writes a **pending-request queue row**; ChatGPT then
  executes the request **in chat**, in the open conversation, and saves
  the results through the same save actions. Nothing runs until the
  applicant is present in chat.

**UI copy must state which behaviour is in effect.** Wherever an
agent-request button or its confirmation note appears, the copy names
the platform behaviour: on Muse, that a background task has started and
results will appear when saved; on ChatGPT Sites, that the request has
been queued and will be executed in chat. A build that shows the other
platform's copy is non-conforming.

No other difference is permitted. Tables, actions and their semantics,
tabs, theme, behaviours, vocabularies, and the acceptance checklist are
identical across platforms.

---

## 8. UI — summary

Full presentation rules are in `UI-SPEC.md`. In brief:

- **Shell:** a header area with the goal line and a package-count line
  (how many tailored packages exist, their current versions, and any
  imminent closing dates), then four tabs in this exact order:
  **Board / Master CV (ledger) / Tracker / Workflow**. (The reference
  implementation also carries a fifth surface — Packages, blockers &
  answers — for the blocker and answer-bank editors and the all-packages
  document list; those surfaces must exist and be editable wherever a
  build places them.)
- **Board:** four clickable stat boxes, the JD & background coverage
  banner, a nearest-first deadlines strip, track pills + search,
  openings grouped by status in pipeline order, in-place card expansion,
  a report dialog, an add-opening form, and a collapsed screened-out
  section. See `UI-SPEC.md` for the full detail, including two
  deliberate removals (no package/approval input form; no
  "Package & approval" summary block in cards).
- **Master CV:** the full ledger, 100% displayed, grouped by category in
  CV order, with fact-status badges and an explainer, search, direct
  add/edit/delete, the "add to my ledger" STAR guidance panel, and —
  when a master-CV document is indexed under the pseudo-slug
  `master-cv` — a Master CV file section (PDF viewer + download, with
  the judge-by-PDF caveat). It is a full master CV, explicitly **not** a
  publications bibliography.
- **Tracker:** the initiated-positions list with stage pills, compact
  rows, and expanded rows whose stage changes all write through
  `recordStatusEvent` only, with the Email evidence toggle.
- **Workflow:** the 7 stages of §4, the format standard, the
  rejected-improvements note (§11), the platform note (§7), the
  spec version the build was made against (§12), and the Data
  controls section carrying the `wipeAllData` control (counts
  preview, typed-WIPE gate; see `UI-SPEC.md` §11).
- **Documents everywhere:** PDF renders in-page; DOCX is download-only;
  `PACKAGE.md` renders as text; exactly one current version per package,
  superseded versions kept as history; bytes never in the database.
- **Back-to-top:** appears after ~600px of scroll in the app's scroll
  container (see `UI-SPEC.md` for the container rule — this is a known
  platform trap).

---

## 9. Weekly refresh

A scheduled weekly refresh (in the reference setup: Mondays) is the
live-update channel for tracked data. Each run:

1. Re-verifies every tracked posting on the employer's official careers
   page (aggregators are leads only); records closures and deadline
   changes; closed/past-deadline openings leave the board per the
   visibility rule, and expiry cleanup (`cleanupClosedExpired`) deletes
   only untracked ones — tracked openings are retained off-Board /
   on-Tracker per the lifecycle rule (`DATA-MODEL.md` §12).
2. Searches for new openings across all tracks and role families, with
   dedupe against the board **including the screened-out list** (a
   screened-out role is never resurfaced) and coverage accounting for
   the sources searched.
3. Scores each new opening by evidence coverage (§4 stage 3) and fills
   its JD summary, labelled background, and reviews at search time (§6).
4. Flags every deadline within 21 days.
5. Syncs the tracker record and the dashboard together, so the two never
   disagree.

The refresh never submits anything, never tailors a package unprompted,
and never promotes a pending/conflicted ledger fact.

 Separately, status changes between refreshes are driven from chat:
when a recruiter email arrives (reply, interview invitation, rejection),
the change is recorded through `recordStatusEvent` with the email's
sender, date, and subject as evidence, and the Tracker shows it under
Email evidence.

---

## 10. Agent-request prompt templates

These two templates are normative. `{{…}}` placeholders are filled from
the applicant's `applicant-profile.yaml` (applicant-data kit) and from
the opening's row. A build must not hard-code one applicant's values —
in particular the never-claim list and the format-standard path always
come from the profile.

### 10.1 Research prompt (used by `requestOpeningResearch` and, per opening, by `requestAllMissingBackgrounds`)

```text
Fill the JD & background report for one tracked opening in the Job Search
Dashboard (slug: {{opening_slug}}, opening id: {{opening_id}}).
Role: {{title}} at {{employer}}{{ (req {{req_id}})}}{{ — {{location}}}}.
{{Recorded posting URL: {{source_url}} | No official posting URL is
recorded yet — find and verify the official careers-page posting first;
aggregators are leads only.}}
Currently missing: {{missing_fields}}. Fill every missing field; also
refresh any of the other report fields that are empty.

Research rules:
- Verify the JD on the official posting and summarise the role from it.
- Research why this role is open, in this order: press releases /
  employer news; pipeline announcements; M&A; new site / expansion;
  restructuring; new funding / grant; new program / IND / trial; stated
  departure / backfill. Label the background with exactly one of
  stated-reason, context, inference, unavailable. Never invent a reason;
  if no source is found, say so with label unavailable.
- Academic / lab-based positions: the background must also cover the lab
  itself — its publications and major conference abstracts from the past
  five years and its lab website — summarised as research goals and
  potential directions, with stated goals kept distinct from inferred
  directions.
- Pull employer reviews from Glassdoor and Indeed: overall rating,
  % who would recommend, review count, category scores where shown,
  recurring pros and cons, and the date checked, with the caveat that
  reviews are anonymous and self-selected — signal, not verdict.
- Map matched evidence and gaps strictly from usable ledger facts
  (fact status user-attested or confirmed only). Never claim:
  {{never_claim}}.
- No field may be left blank: if a JD, background, or reviews genuinely
  cannot be found after a real search, save an explicit note saying so,
  with the date checked, instead of leaving the field empty — for the
  background use whyLabel unavailable.

When the research is done, save it by calling the saveOpeningResearch
action for this opening id with the filled fields (jdSummary, whyLabel,
whyText, reviewsText, and matched / gaps / fitNote / sourceUrl /
salaryText / deadline / deadlineNote where you verified them).
Do not apply, submit anything, or contact anyone.
```

### 10.2 Tailor prompt (used by `requestTailoredPackage`)

```text
Create the tailored application package for one tracked opening in the
Job Search Dashboard (slug: {{opening_slug}}, opening id: {{opening_id}}).
Role: {{title}} at {{employer}}{{ (req {{req_id}})}}{{ — {{location}}}}.
Track: {{track}}.
{{Official posting: {{source_url}} — re-verify it is still live before
tailoring. | No official posting URL is recorded — verify the posting on
the employer's official careers page before tailoring; if it cannot be
verified live, stop and record that on the opening instead of drafting.}}

Follow the tailoring workflow:
- First make sure the opening's JD summary, employer & position
  background (labelled), and employer reviews are filled — research and
  save them via saveOpeningResearch if any are missing (research prompt,
  §10.1).
- Use only usable ledger facts (user-attested / confirmed; never pending
  or conflicted items). Never claim: {{never_claim}}.
- Bullets in STAR form, with quantified results from the ledger.
- Industry roles get a 2-page resume; academic roles get a full detailed
  CV; the cover letter is 1 page, science-precise, no generic phrasing.
- Build every document in the one clean style specified in
  {{format_standard_path}} and verify the format on the PDF render,
  never on an in-app DOCX preview (which may substitute fonts).
- Run the mandatory grammar-proof pass (grammar, punctuation, agreement,
  tense, spelling) before finishing, and page-check the output (resume
  exactly 2 pages / full CV as appropriate; cover letter 1 page).
- Save the package (DOCX + PDF + PACKAGE.md, the PACKAGE.md carrying the
  employer background and the exact-package approval record) under
  packages/{{opening_slug}}/ in the applicant-data kit / job-search
  workspace, and index every file in package_documents with exactly one
  current version per package/document version (one version may exist as both PDF and DOCX files).

When the package is ready, call updateOpening for this opening id: set
status to Awaiting review, packageVersion to the new document versions,
approvalStatus to "Not approved — awaiting {{applicant_name}}'s review
of the exact package", and nextAction to reviewing the exact package
(JD + resume/CV + cover letter together).
Approval is NOT APPROVED until the applicant approves the exact package
in chat. Do not submit the application or contact anyone.
```

---

## 11. Format standard (summary)

One format for every CV, resume, and cover letter, defined in full in
`templates/FORMAT-STANDARD.md` (profile key `{{format_standard_path}}`):
a clean, Harvard/UPenn-benchmarked style — serif display type for the
document itself, right-aligned dates, title-first role lines with italic
institutions, hanging-indent publications with italic journals, grouped
skills with bold labels, no tagline. The PDF render is the reference
render; an in-app DOCX preview is not faithful and must never be used to
judge format.

Five content/format improvements trialled during the reference build
(a page-2 footer, "(n of N)" pagination, a bulleted summary, award
selectivity notes, and a folded in-preparation publications section)
were adopted and then **dropped the same day after careful review**.
They are not part of the standard and must not be re-applied. The
Workflow tab records both the standard and this rejection.

---

## 12. Versioning

- This specification is versioned with the repository (`VERSION`,
  currently 2.0.2). Any change to the data model, the action list or
  semantics, a vocabulary, or a normative UI behaviour increments the
  version and is recorded in `CHANGELOG.md`.
- **Every build records the spec version it was built against in its
  Workflow tab.** A build whose Workflow tab does not state its spec
  version is non-conforming.
- Seed/sync content carries its own version labels per document
  (`package_documents.version_label`, `openings.package_version`); the
  dashboard spec version and package versions are different axes and
  must not be conflated.
- Acceptance is run against the version recorded in the build; when the
  spec version moves, `ACCEPTANCE.md` is re-run in full.

---

## 13. Privacy rules

1. **Real applicant data is never committed to this repository.** The
   repo contains the workflow, templates, this specification, and a
   fictional sample dataset only (Dr. Sam Lee).
2. A real applicant-data kit lives outside the public repo, or in a
   separate private repository. Ignore rules blocking real ledgers,
   trackers, databases, package outputs, and kit contents are a
   backstop, not a guarantee — `git status` is checked before every
   commit.
3. Document bytes never enter the database; the database holds an index
   of paths, and files are read on demand through a privileged read
   restricted to the job-search area of the kit/workspace.
4. The dashboard displays the applicant's own data to the applicant.
   It sends nothing externally: no application is submitted, no employer
   or recruiter is contacted, and no data is shared with third parties
   by any action in §5.
5. Recruiter-email evidence is stored as sender, subject, and date
   exactly as they appear in the message, plus an optional note — not
   as full message bodies.
6. Sample data must be visibly fictional and must be wiped before real
   data is loaded, via the `wipeAllData` action with its confirmation
   (the sample → wipe → real-data flow in `ACCEPTANCE.md`).
7. Applicant-specific constraints (eligibility flags, earliest start,
   location preferences, the never-claim list) live in
   `applicant-profile.yaml` in the kit — never in this specification.

---

## 14. Non-goals

- No auto-apply, no form submission, no messaging of employers.
- No invented scores: an unscored opening shows as unscored / "not yet
  rescored", never with a fabricated coverage number.
- No generic kanban with free-text statuses: the vocabularies in
  `DATA-MODEL.md` are the whole vocabulary.
- No second format: §11's standard is the only document format.
