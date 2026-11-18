# Job Search Dashboard — UI Specification

Normative. Behaviour and copy rules here are part of conformance;
`ACCEPTANCE.md` tests them. Data and vocabulary definitions live in
`DATA-MODEL.md`; purpose, actions, and the agent-request model live in
`SPEC.md`.

The worked example applicant is fictional: Dr. Sam Lee.

---

## 1. Shell

- Page background `var(--bg)`; content column centred, max width ~5xl,
  horizontal padding, bottom padding clear of host chrome.
- **Header area**, in order:
  1. A goal line: the search goal in one or two sentences ("a science
     career beyond the postdoc — any role family realistically
     attainable, not scientist titles only").
  2. A **package-count line**: how many tailored packages exist and are
     awaiting review, their current versions, any external material
     sets awaiting review, and any imminent closing dates named in the
     data. This line is generated from current data, never hard-coded
     counts that can go stale silently — when a build ships sample
     copy here, the acceptance run replaces it with the real line
     during the sample → real-data flow.
  3. A note that the full master CV is under the Master CV tab and every
     tailoring-initiated position is under the Tracker tab.
- **Tabs, in this exact order:** **Board / Master CV (ledger) /
  Tracker / Workflow**. Tabs are buttons with `aria-pressed`; the active
  tab is visually raised (surface background, bordered, bold).
  A fifth surface — **Packages, blockers & answers** — carries the
  all-packages document list, the blocker editor, and the answer-bank
  editor (§9). A build may place those editors there (as the reference
  does) but must not drop them, and must not reorder the four named
  tabs.
- Loading state: a plain "Loading your search…" line. Load error: a
  bordered error panel stating the data failed to load, with a Retry
  button. The server's actual error handling governs; no fake data is
  ever substituted.
- A back-to-top button (§8) overlays every tab.

---

## 2. Theme tokens

Copied from the reference implementation's theme stylesheet. Token
names in a build may differ; the values and the light/dark pairing may
not. Colour scheme follows the OS (`prefers-color-scheme`).

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#f7f5f0` | `#14161c` | Page background |
| `--surface` | `#fffdf9` | `#1e2129` | Card / panel background |
| `--surface-alt` | `#efeadf` | `#262a35` | Lower-emphasis background |
| `--text` | `#1b2436` | `#ece9e0` | Primary text |
| `--dim` | `#5b6472` | `#a3aabb` | Secondary text |
| `--border` | `#ddd6c6` | `#343947` | Borders / dividers |
| `--accent` | `#0f766e` | `#2dd4bf` | Accent (actions, links, positive states) |
| `--accent-soft` | `#e2efec` | `#173b37` | Accent-tinted background |
| `--amber` | `#b45309` | `#f0b35c` | Warning / awaiting states |
| `--amber-soft` | `#f7ead3` | `#3d2f16` | Warning-tinted background |
| `--red` | `#b91c1c` | `#f08a80` | Danger / flags / rejection |
| `--red-soft` | `#f8e3e1` | `#40211f` | Danger-tinted background |
| `--radius` | `10px` | `10px` | Card corner radius |

Typography and interaction tokens:

- **Display font:** Georgia, "Times New Roman", Times, serif — used for
  headings, stat numbers, scores, and card titles (`.font-display`).
  Body text uses the host's default sans.
- **Tabular numerals** for every number that aligns or counts
  (`.tnum`, `font-variant-numeric: tabular-nums`): stat boxes, scores,
  day counts, stage counts.
- Type scale from the reference theme: xs 12/16, sm 14/20, base 16/24,
  lg 18/28, xl 20/28, 2xl 24/32, 3xl 30/36 (px size / line-height).
- **Tap targets ≥32px tall** for buttons, `[role="button"]`, selects,
  summaries, and non-checkbox/radio inputs (2rem minimum height).
- Both themes must be legible; acceptance checks dark mode explicitly.

---

## 3. Board tab

Layout order, top to bottom: stat boxes → coverage banner → deadlines
strip → track pills + search → status groups of cards → add-opening
form → screened-out section. The report dialog (§4) overlays the board.

Visibility first: the board never shows an opening whose status is
`Closed` or whose deadline is before today in the applicant's timezone
(`DATA-MODEL.md` §12), and `Screened out` openings appear only in §3.7.

### 3.1 Stat boxes (four, clickable)

A 2-column grid on phones, 4-column on wider screens. Each box is a
`<button>` showing a large display-font tabular number and an uppercase
label:

| # | Label | Count of |
|---|---|---|
| 1 | openings tracked | all visible, non-screened-out openings |
| 2 | in awaiting-review status | openings with status `Awaiting review` |
| 3 | deadlines within 21 days | openings with a deadline 0–21 days out |
| 4 | on eligibility hold | openings with status `Eligibility hold` |

Click behaviour (all four): **clear the track filter and the search
box, expand the first matching card in place, and smooth-scroll to
it.** "First" means first in board order for boxes 1, 2, and 4, and
the nearest deadline for box 3.

- A box whose count is zero is **disabled** (dimmed, no jump affordance).
- Accessible name: `Go to first <description>: <title> at <employer>`
  when a target exists, e.g. "Go to first opening awaiting review: …";
  otherwise `<count> <label> — none to jump to`.
- A "Jump to post ↓" hint line appears inside a box only when it has a
  target.

### 3.2 JD & background coverage banner

A bordered panel stating the coverage count in words:

> "JD & background coverage: X of Y openings have the JD summary,
> employer & position background, and employer reviews all filled —
> the standard for every position when it is searched. …"

- X = visible non-screened-out openings with all three core fields
  filled; Y = all visible non-screened-out openings.
- When the incomplete count N > 0, the banner carries one button:
  **"Research & fill all N incomplete openings"** (accessible name
  spells out what will be researched), wired to
  `requestAllMissingBackgrounds`. While pending it reads "Starting
  research…"; on success/failure it shows a plain-language note —
  including which platform behaviour is in effect (SPEC §7: background
  task on Muse; queued for execution in chat on ChatGPT Sites).
- When N = 0, no button is shown.

### 3.3 Deadlines strip

Shown only when at least one visible opening has a deadline.

- Heading: "Deadlines — nearest first".
- Rows sorted by deadline ascending; each row is a full-width button
  showing employer — title, the deadline note (if any) beneath, and on
  the right the formatted date plus a day count (`· today`, `· Nd`;
  past dates cannot appear — they are filtered by the visibility rule).
- Clicking a row clears filters, expands that card in place, and
  smooth-scrolls to it (same jump behaviour as §3.1).
- **Tones: red at ≤7 days, amber at ≤21 days, plain beyond 21 days.**
  (This strip tone rule is the board-level summary rule; card-level
  deadline text uses the same red/amber/plain token family.)

### 3.4 Track pills + search

- Pills: `All` plus the four tracks (`Industry`, `Academic`,
  `Contractor`, `External`), in a labelled group (`Filter by track`),
  `aria-pressed` on the active pill; active pill is accent-outlined on
  accent-soft.
- Search input (labelled "Search openings", placeholder "Search title,
  employer, req…") matches case-insensitively against **title,
  employer, and requisition ID** only.
- Filtering applies to the status groups (§3.5), never to the stat
  boxes, banner, or deadlines strip, which always describe the full
  visible board.
- No matches: a single panel, "No openings match this filter."

### 3.5 Status groups and cards

Openings are grouped by status; groups appear in pipeline order
(`DATA-MODEL.md` §7: the 11 pipeline statuses, then `Eligibility hold`,
`Rejection`, `Withdrawal`, then any remaining non-screened status), and
empty groups are omitted. Each group heading is the status in display
font with a tabular count. Cards sit in a 1-column grid (2 columns on
large screens); an expanded card spans the full row.

**Card contents (collapsed):**

- Status pill (coloured by status family: amber for `Awaiting review`;
  accent for `Approved`, `Offer`, `Submitted`, `Responded`,
  `Interview`; red for `Eligibility hold`, `Rejection`; muted for
  `Screened out`, `Closed`, `Withdrawal`; neutral otherwise) and a
  track · req-ID line.
- Title (display font), employer — location.
- Score cell, right-aligned, first applicable form:
  - coverage % (large) labelled "evidence coverage", with
    "· N% unknown" when an unknown share exists, and a secondary line
    "scorecard S/100 · legacy L%" when a scorecard score exists;
  - else scorecard /100 with "legacy L%" and the italic note
    "coverage not yet rescored";
  - else "~L%" labelled "legacy fit (core science)" with the same
    "coverage not yet rescored" note;
  - else the italic word "unscored".
  A null coverage score is never replaced by an invented number.
- Deadline line (formatted date + "· in Nd" / "· today", toned per
  §3.3's family) or the deadline note when there is no date.
- Salary text, when present.
- "Next: <next action>" when present.
- Flags line (⚑, red) when present.
- An amber incomplete-background notice when any core field is missing,
  naming the missing fields ("Background not fully filled: missing …")
  and pointing to the report to research & fill them.
- An action-note area where agent-request results for this card are
  reported in plain language.
- The action row (§3.6) and a Details toggle.

### 3.6 In-place expansion and card actions

**Expansion is in place.** A card is a **single `<article>`**; expanding
it renders the detail **inside the same box, under a top divider** —
role-family line and "expanded in place" explainer, a close (✕) control,
the six detail fields in a two-column grid (The role — verified JD
summary; Employer & position background with its why-label pill;
Matched — ledger evidence; Gaps — not claimed; Employer reviews
(Glassdoor / Indeed); Fit note — an empty field shows an explicit
"Not filled yet — use Research & fill…" placeholder, never a blank),
the posting link, the package documents (§7) when any exist, and a
slim footer holding only the remove-from-board control (with an inline
Yes/Cancel confirmation).

Known defects — a build exhibiting either fails acceptance:

- **Duplicate-box defect:** expansion that renders a second box below
  or above the card, or a detail panel at the top of the page.
- **Repeated-header defect:** the detail repeating the card's
  title/employer header. The header appears once, in the card.

**Deliberate removals (2026-11-18) — do not re-add:**

- There is **no package/approval input form** in the card (no
  "PACKAGE, APPROVAL & NEXT STEP — EXACT-PACKAGE RECORD" form). It was
  removed because it had no use case: approvals happen in chat.
- There is **no "Package & approval" summary block** in the expanded
  card either. It was removed as clutter at that place. Package version
  and the approval record live in the Tracker row detail (§6);
  status, deadline, next step, and flags live on the card face; scores
  live in the score cell.

**Card actions** (in the action row):

1. **"JD & background report"** — always present; opens the report
   dialog (§4).
2. **"Research & fill the background"** — present in the report (and
   implied by the incomplete notice) when the opening is incomplete;
   calls `requestOpeningResearch`. Not a separate card-row button in
   the reference; the card's incomplete notice routes through the
   report.
3. **"Create tailored CV / resume + cover letter"** — present only when
   the opening has **no** indexed package documents and tailoring is
   allowed. Calls `requestTailoredPackage`; an early-stage opening
   (`Researched` / `Verify-first`) moves to `Drafting` server-side.
   **Hidden — and refused server-side — for `Closed` and
   `Screened out`** openings ("do not tailor").
4. **"View tailored package"** — present instead of (3) when a package
   exists; expands the card in place to the package documents.
5. **Details toggle** — expands/collapses in place (§3.6 above).

### 3.7 Screened-out section

After the add-opening form: a collapsed section headed
**"Screened out — do not resurface"** with a count and a Show/Hide
toggle (`aria-expanded`). Expanded, it shows the screened-out cards in
the same card component (so their reasons stay readable), but they are
excluded from every count, strip, group, and agent request elsewhere
on the board, and their tailor action stays hidden/refused.

### 3.8 Add-opening form

A dashed "+ Add an opening" button opens the form inline. Copy at the
top states both rules: check the board (including Screened out) for an
existing application to the same verified opening first — reposts are
investigated, not merged — and **every position is added with its JD
summary, employer & position background, and employer reviews filled at
search time**.

Fields: role title*, employer*, track (select, four tracks), role
family (select, 11 families), status (select, full status vocabulary),
requisition ID, location, deadline (`YYYY-MM-DD`), pay band, evidence
coverage % (if scored), official posting URL, next action, **JD summary
(from the verified official posting)**, **background label** (select of
the four why-labels, shown as `value — display meaning`), **employer &
position background**, and **employer reviews (rating, % recommend,
count, themes, date checked)**. The three research fields may be left
blank only when genuinely not found yet, with the card's
research-&-fill path used afterwards. Errors follow §10.

---

## 4. Report dialog ("JD & background report")

A modal dialog (`role="dialog"`, `aria-modal`, labelled
"JD and background report for <title> at <employer>"), opened from any
card. Clicking the backdrop closes it.

**Structure — three zones, flex column, panel `max-height: 100%`:**

1. **Pinned header** (never scrolls): status pill; track · role family
   · req line; title; employer — location · salary; deadline line with
   day count and note; last-checked line; and a **40px circular ✕
   button, always visible, top-right** (`h-10 w-10`, rounded-full,
   bordered, surface-alt background, accessible name "Close JD and
   background report").
2. **Scrolling body** — the **only** zone that scrolls
   (`overflow-y: auto`, `overscroll-behavior: contain`, so gestures
   stop at its ends):
   - A completeness statement: when incomplete, an amber panel —
     "This report is incomplete: missing … Every position is supposed
     to carry a filled JD, employer & position background, and employer
     reviews from the moment it is searched." — with a
     **"Research & fill the background"** button (`requestOpeningResearch`,
     "Starting research…" while pending, platform-behaviour copy per
     SPEC §7); when complete, an accent panel stating all three are
     filled.
   - Any pending action note for this opening.
   - Sections, in order: Job description — verified JD summary;
     Employer & position background (why-label pill + text); Employer
     reviews (Glassdoor / Indeed); Matched — ledger evidence; Gaps —
     not claimed; Fit note; Flags (when present, red). An empty section
     shows the italic placeholder "Not filled yet."
3. **Pinned footer** (never scrolls): "Open the posting ↗" (when a
   source URL exists); "View tailored package" when a package exists,
   else "Create tailored CV / resume + cover letter" when tailoring is
   allowed (same hidden/refused rule as §3.6); and "Close report"
   right-aligned.

**Chrome and scroll rules:**

- The overlay pads its bottom with
  `max(0.75rem, env(safe-area-inset-bottom))` so the panel and its
  footer clear the host's floating function bar; on larger screens it
  centres with normal padding.
- **Background scroll is locked while the dialog is open:** the app
  scroll container's overflow is set to `hidden` for the duration, its
  scroll offset untouched and therefore exactly restored on close.
  On Muse that container is `[data-generated-space-root]`
  (`position: fixed; overflow: auto`) — **not** the window; locking
  `window`/`body` alone does not lock this app. A build on another host
  locks whatever container actually scrolls its app.
- **Escape closes the dialog.**
- Known defect — fails acceptance: a **single-scroll-panel dialog**
  (header, body, and footer in one scrolling flow). In that shape the
  ✕ scrolls out of view, the footer hides behind host chrome, and
  scroll chaining moves the list behind while the report stays fixed.
  All three symptoms were the original bug this structure fixes.

---

## 5. Master CV tab ("Master CV (ledger)")

Purpose, stated in the tab itself: the **full ledger, 100% displayed**
— contact, education, every position with its full STAR bullets, the
complete skills bank, publications, awards, presentations, mentoring,
references, and any IP record — grouped by category **in CV order**.
It is explicitly a **full master CV, NOT a publications bibliography**;
a build that shows only publications, or any section in summary form,
fails acceptance.

Contents, top to bottom:

1. Intro panel: title "Master CV — the full ledger"; the statement
   above; and the **fact-status explainer** — four boxes:
   *User-attested* (explicitly supplied by the applicant — usable),
   *Confirmed* (extracted from a source and reviewed by the applicant —
   usable), *Pending* (imported, awaiting confirmation — NOT usable),
   *Conflicted / retired* (contradictory or superseded — NOT usable).
2. **"Add to my ledger" STAR guidance panel** (accent-tinted): in chat,
   saying "add … to my ledger" makes the agent ask for the details
   needed to write a full STAR entry (situation/task, action,
   quantified result) before filing — a bare note is never filed when
   the item needs STAR detail. The panel also notes sections can be
   added or edited directly below.
3. **Search** input ("Search the master CV") matching section titles
   and bodies, case-insensitive.
4. **Master CV file section** — shown only when at least one document
   is indexed under the pseudo-slug `master-cv`: title "The master CV
   file — download", a line naming the format standard, the **judge-by-
   PDF caveat** ("Judge the format by this PDF render or the downloaded
   file opened in Word: the in-app DOCX preview substitutes a
   sans-serif font for the document's serif face, so it does not show
   the real format"), and the document list (§7: PDF viewer + download).
5. **All ledger entries**, grouped by category (CV categories first, in
   their defined order; any additional categories present in the data
   follow), every entry as a card: section title (display font), a
   **fact-status badge** (accent for usable statuses, amber for
   `pending`, red for `conflicted`/`retired`) plus the source reference
   when present, and the body rendered with "• "-prefixed lines as
   bullets. Nothing is truncated or collapsed by default.
   Empty states distinguish "ledger not loaded yet — ask the agent to
   sync the ledger" from "no sections match this search".
6. **Direct add / edit / delete:** each entry card offers Edit (section
   title, content, fact-status select over the five fact statuses;
   save errors per §10) and Delete (inline Yes/Cancel confirmation).
   A dashed "+ Add a ledger section" button opens an add form (section
   title*, category select, fact-status select, content*) whose copy
   repeats the STAR-bullet guidance for experience items.

---

## 6. Tracker tab

**Membership (exact):** an opening is listed iff tailoring has been
initiated — it has indexed package documents, **or** a recorded package
version, **or** a status at `Drafting` or beyond (`DATA-MODEL.md` §13).
Positions join automatically when tailoring starts from the Board.
Membership is unaffected by the Board visibility rule: a tracked
opening that is `Closed` or past its deadline stays listed here, with
its package and status history, until a terminal stage (`DATA-MODEL.md`
§12 lifecycle rule) — expiry cleanup never deletes a tracked opening.

Layout:

- Intro paragraph: what the list is, that stages move as things happen,
  and that status changes can rest on recruiter email recorded from the
  applicant's mailbox with the message linked (see Email evidence).
- **Stage pills summary:** one pill per non-empty stage, in stage
  order, "Stage · n" with tabular numerals, coloured by stage family
  (accent for Applied / Responded / Interview scheduled / Offer
  received; red for Rejected; muted for Withdrawn; amber for Initiated).
- Empty state: "No position has tailoring initiated yet. Use 'Create
  tailored CV / resume + cover letter' on a Board card and the position
  will appear here as Initiated."
- **Compact rows:** one article per opening — title; employer · req ID
  · location; deadline (hidden on the narrowest screens; red/semibold
  at ≤21 days); the stage pill; a Details/Hide toggle
  (`aria-expanded`, accessible name naming the opening).

**Expanded row:**

- **Stage changer:** a select over the seven Tracker stages
  (Initiated, Applied, Responded, Interview scheduled, Offer received,
  Rejected, Withdrawn). Changing it writes through
  **`recordStatusEvent` only** — there is no other stage-write path in
  the UI. Selecting the current stage writes nothing. Selecting
  **Initiated** from within the pre-submission pipeline writes nothing
  and notes "Already in progress — the exact pipeline status is
  unchanged" (the no-regression rule, `DATA-MODEL.md` §13). A
  successful change to Applied notes that it should be set only once
  the application has actually been submitted; other changes note
  "Stage updated to …". A failed save shows a plain failure note.
- Beside it, as **plain text**: "Pipeline status: <exact status>",
  plus "· Package <package version>" when present, plus
  "· Approval: <approval record>" when present. (This is where the
  package/approval record lives after its removal from Board cards.)
- A two-column detail list: **Deadline** (formatted date, else the
  deadline note, else "—") and **Last checked** (else "—").
- **Next step** line and **flags** line (⚑, red), when present.
- **Documents:** the tailored package document list (§7), headed
  "Tailored package", when documents exist.
- **Posting link:** "Open the posting ↗" when a source URL exists.
- **Email evidence toggle:** a button "▸/▾ Email evidence" with a count
  when events exist. Expanded:
  - **No events:** an explicit statement that no status change has been
    recorded with email evidence yet, explaining that when a recruiter
    email drives a change it is recorded from the mailbox with the
    email linked here. (No events are ever seeded.)
  - **Events, newest first:** each shows its stage pill, the recorded
    status and recording date, then — when an email is linked — its
    **sender, date, and subject** exactly as recorded; when none is
    linked, the explicit italic line **"No email linked to this
    change"**; then the note, when present. Each status-history entry
    also carries a delete control calling `deleteStatusEvent`, with
    the same inline confirmation pattern as the remove-from-board
    control (§3.6): the first click arms the confirmation, the second
    confirms, and cancel restores the entry unchanged. A hint line
    states that deleting an entry removes the history record only —
    the current stage stays as-is (deleting an event does not change
    the opening's current status).

---

## 7. Documents (all surfaces)

Package documents appear in Board card expansions, Tracker row
expansions, the Master CV file section, and the all-packages surface,
always through the same component behaviour:

- Grouped by package label; each row shows a kind pill (Package notes /
  Resume / Cover letter / Plan / Document), the version label, a
  **"current" pill on the current version**, the document label, the
  filename, and a View/Hide toggle.
- File content is fetched lazily on first open, via `getDocumentFile`:
  - **PDF renders in-page** (embedded PDF viewer) with a download link.
  - **DOCX is download-only**, with copy that the PDF shows the same
    content in place when one exists.
  - **Text files — `PACKAGE.md` — render as text** in a scrollable
    preformatted block.
  - Not-found and load-error states are explicit and name the filename,
    with guidance to have the agent re-check the package folder.
- **Exactly one current version per package** (per package/document version; one version may exist as both PDF and DOCX files);
  superseded versions remain listed as history, unbadged.
- **Bytes never live in the database** — the UI only ever receives a
  file/text payload per open, from the indexed path.

---

## 8. Back-to-top button

- A floating circular ↑ button (44px, accent background), fixed
  bottom-right, `aria-label` / title "Back to top".
- **Appears only after ~600px of scroll** in the app's scroll
  container. On Muse that container is `[data-generated-space-root]`
  — **NOT the window**: a window-scroll listener never fires in this
  shell, which is the known trap. Fall back to the document element
  only when the container is absent.
- Phone offset: bottom = `env(safe-area-inset-bottom) + 5.25rem`, so
  the button clears the host's floating function bar; on larger screens
  it rests at the normal corner offset (1.5rem).
- Click scrolls the same container to the top: **smooth**, except
  **instant (`auto`) under `prefers-reduced-motion`**.

---

## 9. Blockers, answer bank, and all-packages surfaces

These live on the fifth surface ("Packages, blockers & answers") in the
reference build, in this order:

1. **Prepared packages** (when any documents exist): every tailored
   package, read live from the workspace, via §7's component, with the
   note that the same files appear inside each opening's Board
   expansion and that approval covers the exact versions marked
   current. Each document row carries a delete control calling
   `deleteDocument`, with the inline confirmation pattern of the
   remove-from-board control (§3.6): the first click arms the
   confirmation, the second confirms, and cancel restores the row
   unchanged. After deletion the row disappears and the counts update.
2. **Standing blockers & open questions**, with an "<n> open" count:
   open blockers as cards (title — struck through and dimmed when
   resolved — status pill, detail, **Mark resolved / Reopen** toggle
   via `setBlockerStatus`, Delete via `deleteBlocker`); resolved
   blockers in a separate "Resolved" group; an add form (title, detail)
   via `addBlocker`. Fully editable.
3. **Answer bank**: an explainer (saved answers keep their supporting
   facts and intended scope; reuse requires checking current facts and
   job relevance; a job-specific answer never becomes universal on its
   own; authorization, salary, availability, demographics,
   declarations, and consent are never guessed), then answer cards
   (question, scope pill with job label when present, answer text,
   note, Edit — answer + note — and Delete) and an add form (question,
   scope select `universal` / `job-specific`, answer, job label) via
   `addAnswer` / `updateAnswer` / `deleteAnswer`. Fully editable.

---

## 10. Forms and errors

- **Form errors surface the server's actual message**, taken from the
  failed action's error (`error.message`), displayed inline by the
  form. Canned/generic failure text in place of the server's message
  is a defect. (Two exceptions are action-note strings for agent
  requests — research/tailor could-not-start notes — which are status
  copy, not form validation.)
- A failure is reported **once**: forms that show the server message
  inline must not also trigger a duplicate global notice for the same
  failure.
- **Field limits come from the request schemas** (via the platform's
  action-fields mechanism), not from hard-coded HTML attributes:
  in the reference build that covers, at minimum, `addOpening` title /
  employer / coverageScore, `addBlocker` title, `addAnswer` question /
  answer, `updateAnswer` answer, `addLedgerEntry` section / body, and
  `updateLedgerEntry` section / body. Selects and unlimited fields are
  unchanged by this rule; the schemas themselves are not loosened.
- Required fields are marked `*`; selects are populated from the
  closed vocabularies in `DATA-MODEL.md`, never free-typed where a
  vocabulary exists.

---

## 11. Workflow tab

- Title "The integrated workflow" and a one-line provenance note (the
  workflow suite merged with the host platform's setup; the goal is any
  science career beyond the postdoc).
- **The 7 stages** (SPEC §4), numbered, each with its name and a short
  paragraph: 1 Career ledger; 2 Broad discovery; 3 Evidence coverage +
  employer research; 4 Tailored materials; 5 Exact-package approval;
  6 Apply assist, page by page; 7 Tracking & the weekly refresh.
- Stage 4 states the **format standard** (one clean style; serif face,
  right-aligned dates, title-first role lines with italic institutions,
  hanging-indent publications, grouped skills, no tagline; format
  judged on the PDF render) **and the rejected-improvements note**:
  five improvements trialled during the reference build were dropped
  the same day after review and are not part of the standard.
- A two-panel "adopted vs kept" summary is welcome but optional; when
  present it must not name any real applicant data (employers, scores,
  or personal constraints) beyond what the profile marks public —
  sample builds use the fictional applicant's material.
- **Scope panel:** the 11 role families as pills, plus the applicant's
  recorded preferences (level, regions, work modes, salary ideal,
  earliest start, search stage) taken from `applicant-profile.yaml`.
- **Platform note (required):** which agent-request behaviour is in
  effect on this build (SPEC §7) — background task spawn on Muse, or
  the pending-request queue executed in chat on ChatGPT Sites.
- **Spec version (required):** the version of this specification the
  build was made against (SPEC §12), stated in this tab.
- **Data controls (required, final section of this tab):** a section
  carrying the `wipeAllData` control. Before executing, it shows a
  counts preview of all six tables (openings, blockers, answers,
  ledger entries, package documents, status events) taken from the
  current data. Execution is gated by a typed confirmation: the user
  must type exactly `WIPE` into a text field, and the execute button
  is disabled until the field matches exactly; the client passes
  `confirm: true` only after that gate. Copy in the section states
  that the wipe is irreversible and that its purpose is clearing
  sample data before loading real data. On success the returned
  per-table removed counts are shown and the empty state renders;
  a server error is shown inline with the server's message.

---

## 12. Accessibility and motion summary

- Every icon-only or jump control has an accessible name naming its
  target opening (stat boxes §3.1, dialog ✕ §4, toggles §3.6/§6/§7).
- Toggles expose `aria-expanded`; filter pills and tabs expose
  `aria-pressed`; the dialog is `aria-modal` with a descriptive label
  and closes on Escape.
- Tap targets ≥32px (§2); the dialog close target is 40px.
- Smooth scrolling (stat-box jumps, deadline jumps, back-to-top)
  degrades to instant under `prefers-reduced-motion` where the
  platform exposes it; at minimum back-to-top honours it (§8).
- Numbers that count or align use tabular numerals in both themes;
  status meaning is never carried by colour alone — every coloured
  pill also carries its text label.
