# Changelog

## 2.0.2

UI controls for the existing destructive actions (2026-11-18). No
action contract changes:

- **UI controls added for `wipeAllData`.** The Workflow tab gains a
  Data controls section: a counts preview of all six tables before
  executing, a typed-WIPE gate (the execute button stays disabled
  until the user types exactly `WIPE`; `confirm: true` is passed only
  after the gate), the returned per-table removed counts shown on
  success with the empty state rendering, server errors shown inline,
  and copy stating the wipe is irreversible and its purpose is
  clearing sample data before loading real data.
- **UI controls added for `deleteDocument`.** Each document row on
  the Packages surface ("Prepared packages" list) carries a delete
  control with the inline confirmation pattern of the
  remove-from-board control.
- **UI controls added for `deleteStatusEvent`.** Each status-history
  entry in a Tracker expanded row carries a delete control with the
  same inline confirmation; a hint line notes deleting an entry does
  not change the opening's current status.
- **UI-SPEC additions.** `UI-SPEC.md` §11 (Data controls section),
  §9 item 1 (per-document-row delete control), and §6 (per-status-event
  delete control and hint line).
- **Acceptance updates.** New items 60 (wipe control) and 61 (per-row
  delete controls) appended in section L — 61 items total.

## 2.0.1

Post-dry-run spec changes (2026-11-18), decided by the applicant after
the v2 dry-run rebuild exposed them:

- **Wipe mechanism added (resolves dry-run item 55 FAIL).** New action
  `wipeAllData`: empties all six tables, returns the per-table removed
  counts, and requires the explicit confirmation input
  `confirm: true` (a call without it is rejected and deletes nothing).
  It is the sanctioned sample → real-data wipe in both adapters.
- **Per-row deletes added.** New actions `deleteDocument` (one
  package-document index row) and `deleteStatusEvent` (one
  status-event history row). Action count: 22 → **25**.
- **`deleteOpening` cascades.** Deleting an opening now also deletes
  its package documents (by opening slug) and its status events (by
  opening id) — no orphaned rows.
- **Expiry lifecycle rule (behaviour change).** `cleanupClosedExpired`
  no longer deletes every Closed/past-deadline opening. It deletes
  only **untracked** ones (with cascade) and **retains tracked**
  openings — tailoring initiated (package documents, a recorded
  package version, or a status at Drafting or beyond, including
  Submitted/Responded/Interview/Offer) — off the Board but on the
  Tracker, with package and status history intact, until a terminal
  stage. It now returns `{removed, keptTracked}`. Consequently
  `getDashboard` returns all openings and the Board's client-side
  visibility filter is the Board gate (filtering the payload
  server-side would have dropped tracked openings from the Tracker).
- **Sample-document materialisation convention documented** (Muse
  adapter step 4; Sites adapter step 4): sample package files are
  copied/uploaded into an isolated sample area and the document reader
  is pointed there for the sample phase — the approach proven in the
  dry run.
- **Timezone parameterised.** Server actions read the timezone from
  `APPLICANT_PROFILE.timezone` (from `applicant-profile.yaml`) instead
  of hard-coding `America/New_York`; the profile timezone governs all
  server-side date decisions (`DATA-MODEL.md` §12).
- **Acceptance updates.** Item 4 reworded to "per package/document
  version" (one version may exist as both PDF and DOCX); item 30
  amended for the lifecycle rule; item 55 rewritten around
  `wipeAllData`; new items 58 (`deleteOpening` cascade) and 59
  (per-row deletes) appended.

## 2.0.0

v2 is a rebuild of the v1 suite around a single workflow, a specified
dashboard, and a portable applicant-data format.

### What v1 was

- Six Codex skills covering the job-search workflow in separate parts.
- Workflow state held in a single `state.json` file.
- No dashboard: tracking lived in files the applicant read directly.
- No sample data, no acceptance test, and no build path for other platforms.

### What changed in v2

- **Workflow rules merged.** The discipline developed in the Muse
  job-application tailoring workflow is merged into the suite as governing
  rules, including:
  - ledger fact statuses (only user-attested and confirmed facts are usable
    for matching or drafting);
  - evidence-coverage as the headline fit score, with eligibility, location,
    start date and deadline as flags outside the number;
  - employer and position background and employer reviews filled for every
    position when it is searched or found, not at package-build time;
  - academic backgrounds that also research the lab itself (publications and
    major conference abstracts from the past five years, lab website, stated
    goals kept distinct from inferred directions);
  - live verification of the official posting before any date, deadline or
    requirement is stated as a decision driver;
  - a mandatory grammar proofreading gate before any package is presented;
  - one consistent CV/resume format for every document
    (`templates/FORMAT-STANDARD.md`), judged on the PDF render;
  - exact-package approval records (silence is not approval; any change
    returns the package to review);
  - applicant-led application assistance (the applicant clicks every
    Next / Continue / Proceed / Submit control; a submission is recorded
    only from an observed confirmation or the applicant's explicit report);
  - tracker status changes driven by recruiter email evidence where an
    application has been submitted.
- **Dashboard spec + reference added.** `dashboard/` now carries a full
  specification (`SPEC.md`, `DATA-MODEL.md`, `UI-SPEC.md`), an item-by-item
  acceptance checklist (`ACCEPTANCE.md`), and a reference implementation
  under `dashboard/reference/` to use as the starting point for a build.
- **7th skill added: `jobseek-dashboard`.** The dashboard is operated as a
  skill in its own right, alongside the six workflow skills.
- **Applicant-data kit added.** `applicant-data/` defines an interchange kit
  (profile, ledger, openings, documents index, answers, status events and
  per-package folders). The kit is the source of truth; platform databases
  are caches seeded from it and exported back to it. Real kits live outside
  this public repo.
- **Sample dataset added.** `examples/sample-applicant/` is a complete
  fictional dataset for Dr. Sam Lee, used to prove a build before any real
  data is loaded.
- **Acceptance test added.** `dashboard/ACCEPTANCE.md` must be passed
  item-by-item against the sample dataset before a build is loaded with
  real applicant data.
- **Adapters added.**
  - `adapters/muse/BUILD-PROMPT.md` — build the dashboard as a Muse Space.
  - `adapters/chatgpt-sites/BUILD-PROMPT.md` — build the same dashboard as a
    ChatGPT Site, with a full mapping from the Muse implementation and the
    one parity difference (agent-request execution) stated plainly.
- **`state.json` retired** as the state format; state now lives in the
  applicant-data kit and the dashboard database seeded from it.
- **Option 2 port (2026-11-18): v1 shared references + scripts ported
  and adapted.** The eight `skills/jobseek/references/` files and the
  three Python helpers from v1 are now part of the family, adapted to
  the applicant-data kit: `records.md` rewritten around the kit as the
  single source of truth (v1 `state.json` survives only as a legacy
  import source); `jobseek_state.py` operates on kit files
  (init/show/validate/render/snapshot/reconcile, enforcing fact
  statuses, DATA-MODEL vocabularies, and document-index integrity);
  `jobseek_match.py` computes evidence coverage from per-competency
  `assessments` recorded on each opening (a new additive field,
  documented in `dashboard/DATA-MODEL.md` §16); `jobseek_documents.py`
  keeps the platform-independent manifest/QA core and replaces v1's
  hard-wired renderer paths with per-platform adapters that degrade
  honestly. `agents/openai.yaml` ported for Codex/ChatGPT. On the
  fictional sample, the helper computes NovaCell coverage 68.0 /
  Unknown 12.0, agreeing with the recorded scores; kit validation
  passes on the sample and fails, naming both problems, on a
  deliberately corrupted copy.

## 1.0.0

- Initial suite: six Codex skills for the job-search workflow.
- Workflow state in `state.json`.
