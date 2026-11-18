---
name: jobseek-dashboard
description: Build, seed, sync, verify, and export the applicant's job-search dashboard from the tracker and ledger, using the platform adapter for Muse or ChatGPT. Use for any dashboard build, content sync, agent-request action, status display, or applicant-data export/import request.
---

# Jobseek Dashboard — The Visual Dashboard

Build and maintain the applicant's dashboard: a browsable view over the ledger, the openings, the documents, and the tracker, with agent-request actions that hand work back to the skills.

## Purpose in one line

The dashboard displays and requests; the ledger and tracker remain the records of truth, and every status shown on the dashboard was written through the single status-event record.

## Build from the spec, through the platform adapter

- Build the dashboard **from `dashboard/SPEC.md`** in this repository. The spec defines the pages, tabs, fields, and behaviours; do not invent a different layout, page set, or field set to suit a build.
- Build it **via the platform adapter** for the platform in use, identified at session start (see `jobseek`):
  - **Muse:** build a Claude Space from the reference implementation in `dashboard/reference/`, following the Muse adapter under `adapters/Muse/`.
  - **ChatGPT:** build a ChatGPT Site following the mapping in `adapters/chatgpt-sites/` — the adapter maps each spec element to its Sites equivalent; where an element has no equivalent, follow the adapter's stated fallback and record the difference.
- Keep the two builds behaviourally equivalent: same data, same tabs, same actions, same acceptance checks. A platform difference is an adapter fact to record, not a licence to diverge silently.

## Data model: seed, then sync

The dashboard's content functions have fixed semantics. Implement and use them exactly as named here, whatever the platform's underlying calls are called.

### `seedFromTracker`

- Populates a new or empty dashboard from the tracker and ledger: openings, tracker rows, ledger view, and the document index.
- **Idempotent, and a no-op when rows already exist for the seed.** Running it twice changes nothing the second time; running it against a dashboard that already has seeded rows leaves those rows untouched. It is a first-fill operation, never a reset.
- Seeding is per applicant. **Never seed one applicant's data into another applicant's dashboard** — resolve the applicant and workspace first, and verify the dashboard being seeded belongs to that same applicant before writing anything.

### `syncDashboardContent`

- Keeps an existing dashboard in step with the records: **upserts** the ledger view and the document index from the current ledger and package folders.
- **Never overwrites user edits.** Fields, notes, ordering, or other content the applicant has edited on the dashboard itself are preserved; sync updates the record-derived fields around them. If a record-derived value and an applicant edit genuinely conflict, surface the conflict rather than choosing a winner silently.
- Sync is idempotent: syncing twice with unchanged records produces no visible change the second time.

### Documents: metadata only, read through the validated reader

- The dashboard **indexes documents by metadata only** — title, opening, kind, version, approval status, dates, and workspace location. Document **bytes stay in the workspace** (or in the Site's own storage on the ChatGPT build); they are never copied into dashboard content records.
- Opening a document from the dashboard goes through the **validated reader**: it checks the requested document belongs to the same applicant and opening, resolves the workspace-relative location, and refuses path traversal or another applicant's files. A document that fails validation is shown as unavailable, with the reason — never fetched by a guessed path.

## Views the dashboard provides

At minimum, per `dashboard/SPEC.md`:

- **Openings board** — the ranked shortlist and tracked openings, filterable so closed and past-deadline rows can be hidden while remaining in the underlying tracker; each card expands in place to show the verified JD, the evidence-coverage scorecard, the employer background and reviews, and a read-only package and approval summary. Approvals and status changes happen in chat or the tracker, not by editing the card.
- **Ledger view** — the full master record for the applicant: every section fully displayed, with STAR detail in bullets, built from the ledger. This is a view of the ledger, not a second copy to edit independently.
- **Tracker tab** — application stages **Initiated / Applied / Responded / Interview scheduled / Offer received / Rejected / Withdrawn**, mapped from the internal states exactly as specified in `jobseek-track`, with email evidence (sender, date, subject) shown for any status change that rests on a recruiter email.
- **Document index** — every package document by metadata, with version and approval status, openable through the validated reader.

## Agent-request actions

Dashboard buttons request agent work; they do not do the work themselves. Two request kinds exist — **research** (JD and background report for an opening) and **tailor** (build the tailored CV / resume and cover letter package). How a request is executed depends on the platform:

- **Muse:** the dashboard action spawns the work in the background, in chat, under the relevant skill (`jobseek-search` for research, `jobseek-tailor` for tailor). Requests are **deduplicated per opening**: a second request for the same opening and kind while one is already queued or running does not create a second job; it reports the existing one. Nothing is submitted and no package is approved by a dashboard action — packages are built in chat and presented for the applicant's exact-package decision there.
- **ChatGPT:** the dashboard action writes to a **pending-request queue**. The queue is executed **in chat**: at the start of a session, check the queue for the selected applicant, present what is pending, and carry out confirmed requests under the relevant skill in that conversation. A queued request is a request, not an instruction to bypass any stage boundary or approval rule.

On either platform, a completed research request fills the opening's background and reviews in the records first, and the dashboard reflects them on the next sync — the dashboard is never the only place research lives.

## Status changes: one door only

**`recordStatusEvent` is the ONLY way status changes are written from the Tracker or from chat** — and the dashboard is bound by the same rule. The dashboard displays statuses and can originate a status-event request (for example the applicant reporting an outcome), but it never writes a status field directly, and a sync never invents or repairs a status. Every displayed status traces to a status-event record with its date and evidence, as defined in `jobseek-track`.

## Verification against acceptance

- Verify every build **against `dashboard/ACCEPTANCE.md`, item by item, with evidence** for each item — a rendered view, a record, or a check output the reviewer can inspect. A build that has not been checked item by item is not verified, however good it looks.
- **Use the sample dataset first.** Build and verify against the fictional sample applicant under `examples/sample-applicant/` (Dr. Sam Lee) before touching a real applicant's dashboard. Run the full acceptance list on the sample build.
- **Then wipe.** After sample verification, remove the sample data completely with the dashboard's **`wipeAllData`** action — it requires the explicit confirmation input (`confirm: true`), empties all six tables, and returns the per-table removed counts — and confirm the dashboard is empty before seeding the real applicant. The dashboard UI exposes this as a control — the Workflow tab's Data controls section (typed-WIPE gate) — which calls the same action; the action remains the only mechanism. Sample rows must never survive into a real dashboard, and a real applicant's rows must never be used as the test set.

## Data management: deletes, cascade, and the expiry lifecycle

- **`wipeAllData`** is the only full wipe (see above). Per-row deletes exist for single rows: `deleteDocument` (one document index row) and `deleteStatusEvent` (one status-event history row). The dashboard UI exposes them as controls — the Workflow tab's Data controls section (typed-WIPE gate) for `wipeAllData` and per-row delete controls for `deleteDocument` / `deleteStatusEvent` — which call the same actions; the actions remain the only mechanism.
- **`deleteOpening` cascades**: deleting an opening also deletes its package documents and its status events. No orphaned rows.
- **Expiry lifecycle:** `cleanupClosedExpired` deletes only **untracked** Closed or past-deadline openings (with cascade). A **tracked** opening — tailoring initiated: package documents, a recorded package version, or a status at Drafting or beyond, including any post-submission status — is **retained**: off the Board, on the Tracker, package and status history intact, until a terminal stage (Rejected / Withdrawn / Offer received). Cleanup reports `{removed, keptTracked}`. Never use cleanup as a wipe, and never delete a tracked opening by hand to "tidy up" — its package and history are the record.

## Weekly refresh sync

The weekly refresh (see `jobseek-track`) **syncs the dashboard alongside `TRACKER.md` in the same pass**: re-verified postings, closed postings, deadline flags, and email-evidenced status changes all land in the tracker and are reflected on the dashboard before the refresh is reported complete. A refresh that updates the tracker but leaves the dashboard stale is unfinished work, and the report says so.

## Export and import: the applicant-data kit

- Export and import go through the **applicant-data kit**: a single portable bundle of one applicant's profile, ledger, tracker, document index (metadata, with documents referenced by workspace location), and dashboard content.
- An export is labelled with the applicant it belongs to. An import creates or restores **that applicant's** workspace and dashboard only, after the same identity checks as seeding.
- Verify an import by spot-checking records against the export and re-running the relevant acceptance items; report any item that did not survive the round trip.

## Privacy

- One applicant per dashboard, always. Resolve applicant and workspace before building, seeding, syncing, exporting, or importing, and stop if the dashboard in front of you belongs to someone else.
- **Never seed one applicant's data into another applicant's dashboard**, never copy document bytes into dashboard records, and never include applicant records in the reusable skill package or in a sample dataset.
- The sample applicant (Dr. Sam Lee) is fictional; keep it fictional — do not enrich it with real applicant facts to make a demo look better.
