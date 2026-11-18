# Data Plan — <build name>

> Template. A builder copies this file into the build's own records
> (never into the public specification repo with real data filled in)
> and completes every section **before** seeding real data. Bracketed
> prompts are instructions to the builder — delete them as you fill
> each section in. The filled plan is the provenance record for the
> dashboard's data: what was asked, what was tested, what changed, and
> how the data behaves over time.

Build: ______________________  Platform (Muse / ChatGPT Sites): __________
Spec version built against: __________  Plan started: __________
Builder / agent: ______________________

---

## 1. Build request provenance

[Paste the applicant's build request **verbatim** — the exact words,
not a summary. If the request arrived in several messages, paste each
one, in order, each under its own date line. This section is the
authority for what the build is for; later sections may not widen it.]

> <verbatim build request, message 1 — date: ______>

> <verbatim build request, message 2 (if any) — date: ______>

Rescope / clarification history, verbatim, in order:

> <verbatim clarification — date: ______>

Derived scope statement (builder's words, must not exceed the verbatim
requests above):

- Goal: <e.g. "a science career beyond the postdoc — any role family
  realistically attainable, not scientist titles only">
- In scope: <…>
- Explicitly out of scope: <e.g. "no application is ever submitted by
  the agent">

---

## 2. Sources tested

[For **every** source the build's data comes from, one subsection.
A source that was not actually opened/read does not get a subsection —
and its data does not get used. Record the test, not an intention.]

### 2.<n> <Source name — e.g. "Local job-search workspace files (read directly)">

- **Used by:** <which actions / seed paths consume it, e.g.
  `seedFromTracker`, `syncDashboardContent`, `getDocumentFile`>
- **Test command:** `<the exact command or tool call used to read it,
  e.g. a file read of the named paths, a directory listing>`
- **Sample output:** <a short verbatim excerpt proving the read worked
  — a few rows/lines, with counts where relevant. Redact nothing the
  build depends on; this plan lives with the private build records.>
- **Processing:** <how the source becomes dashboard data: what is
  copied verbatim, what is left null and why, what is upserted by what
  key, what is backfilled only into still-empty fields, what is never
  overwritten>

### 2.<n> <Source name — e.g. "Workflow suite repository (read via web)">

- **Used by:** <…>
- **Test command:** `<…>`
- **Sample output:** <…>
- **Processing:** <concepts modelled vs code copied — state explicitly
  if no code is copied>

### 2.<n> Web-search sources

[If none: write "None — all content comes from <the sources above>."
Do not leave this blank.]

### 2.<n> Agent-task sources

[Research/tailor tasks whose saved output becomes data. If none yet:
write "None at build time." Otherwise list each task type, the save
action it writes through, and the verification applied to its output
before it was accepted.]

---

## 3. Edit history

[One entry per change to the build's data behaviour after the initial
build, newest last. An entry records what the applicant asked for
(verbatim or tightly quoted), what was found, and what changed —
including rejected alternatives where they were seriously tried.
Never rewrite an earlier entry; corrections are new entries.]

### Edit <YYYY-MM-DD> — <short title>

- **Applicant's points (verbatim or tightly quoted):** <…>
- **Findings:** <what the data or code actually showed,
  with counts — e.g. "of 31 non-screened openings returned, 23 were
  still missing background and/or reviews">
- **Changes made:** <actions added/changed, UI behaviour changed,
  backfills run, post-submit actions declared>
- **Data affected:** <rows/tables touched, and how it was verified —
  e.g. "verified on the sandbox copy: removed 4 rows">
- **Rejected approaches (if any):**
  - **Tried:** <…>
    **Why rejected:** <…>

### Edit <YYYY-MM-DD> (2) — <short title>

- **Applicant's points:** <…>
- **Findings:** <…>
- **Changes made:** <…>
- **Data affected:** <…>

---

## 4. Long-term data behaviour

### Refresh policy

- **Channel:** <how tracked data stays live — e.g. "rows are the
  applicant's own records, seeded once from the tracker via the
  post-submit seed action (idempotent: no-op when rows exist); the
  weekly refresh (Mondays) re-verifies postings and is the live-update
  channel; deadline urgency is computed client-side from stored
  deadline dates, so it is always current at open">
- **New cron/jobs created by this build:** <list, or "none">
- **What a refresh may and may not do:** <e.g. re-verify, score, fill
  research at search time, flag deadlines within 21 days; never
  submit, never tailor unprompted, never promote unconfirmed facts>

### Growth

- **Who adds what:** <e.g. "the applicant adds/edits openings, updates
  statuses and next actions, records approvals and outcomes, and
  manages standing blockers and answers in the UI; agent tasks add
  research and packages only through the save actions">
- **Screened-out handling:** <screened-out roles are kept as a separate
  collapsed list so they are never resurfaced as new>
- **Superseded documents:** <kept as history with `is_current = 0`;
  exactly one current version per package at all times>
- **Status events:** <start empty; grow only from real recorded
  changes, each with its email evidence or an explicit no-email note>

### Ordering

- **Board:** <e.g. "grouped by status in pipeline order; deadlines
  strip nearest-first; data returned by `sort_order`, then `id`">
- **Ledger:** <CV order via `sort_order`, grouped by category>
- **Tracker:** <board order; status events newest-first per opening>

### Time semantics

- **Applicant timezone:** <IANA name from `applicant-profile.yaml`,
  e.g. `America/New_York`>
- **Deadlines:** plain calendar dates (`YYYY-MM-DD`) as recorded in
  the source tracker; rendered and counted (days-left, 21-day flags,
  past-deadline visibility) against the current date **in the
  applicant's timezone** — never UTC, never the server's timezone.
- **Timestamps:** `created_at` / `updated_at` are millisecond
  timestamps; a status event's recording time is its `created_at`,
  exposed as `recordedAt`.
- **last_checked:** a plain date (`YYYY-MM-DD`); a research save stamps
  it to the save date in the applicant's timezone.

---

## 5. Privacy and retention checks

- [ ] Real applicant data lives only in the private applicant-data kit
      / this build's records — nothing real was written into the
      public specification repository.
- [ ] `git status` checked before every commit touching this build.
- [ ] Sample data (fictional applicant) was wiped via `wipeAllData`
      (with its `confirm: true` confirmation) and the wipe verified
      (all six tables empty of sample rows) before real data was loaded.
- [ ] Document bytes exist only as files; the database holds paths and
      metadata only.
- [ ] Email evidence stores sender / subject / date and an optional
      note only — no message bodies.
