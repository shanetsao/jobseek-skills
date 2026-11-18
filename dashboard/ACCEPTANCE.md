# Job Search Dashboard — Acceptance Checklist

Run in full against the build's recorded spec version (SPEC §12), first
on the fictional sample dataset (Dr. Sam Lee, `examples/sample-applicant/`),
then again after the sample → wipe → real-data flow (section J).

Every item is **pass/fail**, and every pass requires **evidence**:
a screenshot, a screen recording, an action log, a database row count,
or a quoted UI string — recorded next to the item. "Looks right" is not
evidence. Any fail blocks acceptance until fixed and re-run; a re-run
re-runs the whole list, not only the failed item.

Build under test: ______________________  Spec version: __________
Platform (Muse / ChatGPT Sites): __________  Date: __________
Tester: ______________________

---

## A. Seed, sync, and data integrity

1. **Seed idempotency.** Run the seed/sync path (`seedFromTracker`,
   then `syncDashboardContent`) twice over the same source data. The
   second run changes nothing: row counts in all six tables are
   identical before and after, and no opening, ledger entry, document,
   blocker, or answer is duplicated or overwritten.
   Evidence: table row counts from both runs. ☐ Pass ☐ Fail
2. **No invented scores.** Every sample opening that ships unscored
   shows null coverage in the data and "not yet rescored" / "unscored"
   in the UI — no coverage number appears that is not in the source
   data. Evidence: data export + card screenshot. ☐ Pass ☐ Fail
3. **No seeded status events.** On a fresh build, `status_events` is
   empty and every Tracker row's Email evidence states that none has
   been recorded. Evidence: row count + screenshot. ☐ Pass ☐ Fail
4. **Document index integrity.** Exactly one `is_current = 1` version
   per package/document version (a single version may exist as both a
   PDF and a DOCX file — both rows carry that version's
   `is_current = 1`); superseded versions remain present with
   `is_current = 0`; no document row contains file bytes (paths and
   metadata only). Evidence: index listing. ☐ Pass ☐ Fail

## B. Shell and tabs

5. **Four tabs render.** Board, Master CV (ledger), Tracker, and
   Workflow render in that order, each with its real content, plus the
   Packages/blockers/answers surface. Evidence: one screenshot per
   tab. ☐ Pass ☐ Fail
6. **No console errors.** Loading the app and visiting every tab
   produces zero browser console errors. Evidence: console capture.
   ☐ Pass ☐ Fail
7. **No mobile overflow.** At a phone viewport (~390px wide), no tab
   scrolls horizontally and no card, dialog, or button is clipped.
   Evidence: screenshots at phone width for all tabs. ☐ Pass ☐ Fail
8. **Header truthfulness.** The header package-count line matches the
   data actually loaded (package count, current versions, imminent
   deadlines). Evidence: line quoted + data counts. ☐ Pass ☐ Fail
9. **Workflow tab completeness.** The Workflow tab shows all 7 stages,
   the format standard, the rejected-improvements note, the platform
   note naming the agent-request behaviour in effect, and the spec
   version this build was made against. Evidence: screenshot + quoted
   version string. ☐ Pass ☐ Fail

## C. Board — stat boxes, banner, deadlines

10. **Stat-box counts.** All four counts (openings tracked / awaiting
    review / deadlines within 21 days / eligibility hold) equal a
    hand count from the loaded data, excluding screened-out, closed,
    and past-deadline openings. Evidence: hand count + screenshot.
    ☐ Pass ☐ Fail
11. **Stat-box jump — awaiting review.** Clicking the awaiting-review
    box clears any active track filter and search text, expands the
    first awaiting-review card **in place**, and smooth-scrolls to it.
    Evidence: screen recording. ☐ Pass ☐ Fail
12. **Stat-box jump — deadlines and holds.** Items 11's behaviour
    verified for the deadlines box (target = nearest deadline within
    21 days) and the eligibility-hold box (target = first hold).
    Evidence: screen recordings. ☐ Pass ☐ Fail
13. **Stat-box jump — tracked, and zero-count.** The openings-tracked
    box jumps to the first tracked opening; any box at zero is disabled
    and cannot be clicked. Evidence: recording + screenshot of the
    disabled box. ☐ Pass ☐ Fail
14. **Coverage banner count.** The banner's "X of Y" equals the hand
    count of openings with all three core fields filled over all
    visible non-screened-out openings, and the button reads
    "Research & fill all N incomplete openings" with N = Y − X (button
    absent when N = 0). Evidence: hand count + screenshot.
    ☐ Pass ☐ Fail
15. **Deadlines strip ordering and day counts.** Rows are nearest-first;
    every day count equals the calendar difference in the applicant's
    timezone (check a deadline today = "today", one tomorrow = 1d);
    tones are red ≤7d, amber ≤21d, plain beyond. Clicking a row jumps
    and expands like item 11. Evidence: computed table + recording.
    ☐ Pass ☐ Fail
16. **Track pills and search.** Each track pill filters to exactly that
    track; search matches title, employer, and requisition ID
    (case-insensitive) and nothing else; clearing both restores the
    full board; a no-match filter shows "No openings match this
    filter." Evidence: screenshots per case. ☐ Pass ☐ Fail
17. **Grouping order.** Status groups appear in pipeline order with
    correct per-group counts, and cards show status pill, track · req,
    title, employer — location, the correct score-cell form, deadline
    or deadline note, salary, next action, and flags. Evidence:
    annotated screenshot. ☐ Pass ☐ Fail

## D. Board — expansion, cards, and the report dialog

18. **In-place expansion, no repeated header.** Expanding any card
    renders its detail inside the same article under a divider; the
    title/employer header appears exactly once on the card; no second
    box appears below/above and no detail panel appears at the top of
    the page. Evidence: before/after screenshots with the single
    article outlined (devtools). ☐ Pass ☐ Fail
19. **No package form, no package summary block.** The expanded card
    contains no package/approval input form and no "Package & approval"
    summary block; its footer holds only the remove-from-board control
    (with inline confirmation). Evidence: screenshot of a fully
    expanded card for an opening that has a package. ☐ Pass ☐ Fail
20. **Card actions — tailor gating.** The tailor button is **absent**
    on a screened-out card and **present** on every other packageless
    card; invoking the tailor action directly for a `Closed` opening
    is refused server-side (no task/queue row, no status change); on a
    card with a package, "View tailored package" replaces the tailor
    button. Evidence: screenshots + action log for the refused call.
    ☐ Pass ☐ Fail
21. **Card actions — tailor side effect.** Requesting tailoring for a
    `Researched` (or `Verify-first`) opening moves it to `Drafting`;
    requesting it for a later-stage opening does not change its status.
    Evidence: status before/after in data. ☐ Pass ☐ Fail
22. **Report dialog — structure.** The dialog is a flex column: pinned
    header, only the body scrolls, pinned footer with Open the posting
    / package action / Close report. Evidence: screenshot with a long
    report loaded. ☐ Pass ☐ Fail
23. **Report dialog — ✕ always visible.** Scroll the report body to its
    bottom: the 40px circular ✕ is still visible at the top-right and
    closes the dialog. Evidence: screen recording. ☐ Pass ☐ Fail
24. **Report dialog — background locked, offset restored.** With the
    dialog open, attempting to scroll the background (including a
    gesture starting on the backdrop, and scroll-chaining past the
    body's end) does not move the list behind; on close, the list is
    at exactly the scroll offset it had before opening. Evidence:
    screen recording with a scroll marker. ☐ Pass ☐ Fail
25. **Report dialog — footer above host chrome, Escape.** On a phone,
    the pinned footer sits fully above the host's floating function
    bar (overlay bottom padding = safe-area rule); pressing Escape
    closes the dialog. Evidence: phone screenshot + recording.
    ☐ Pass ☐ Fail
26. **Report dialog — completeness and research action.** An incomplete
    opening's report shows the incomplete panel naming the missing
    fields and a working "Research & fill the background" action; a
    complete opening's report shows the all-filled statement and no
    research button. Evidence: screenshots of both cases.
    ☐ Pass ☐ Fail
27. **Research request end state.** After a research request completes
    (background task on Muse; executed in chat from the queue on
    ChatGPT Sites — UI copy must state which behaviour is in effect),
    the opening's three core fields are filled with sourced content, or
    each unfindable field holds a dated not-found note (background
    labelled `unavailable`); no field is blank and no reason, rating,
    or review is fabricated. Evidence: saved field values + sources.
    ☐ Pass ☐ Fail
28. **Add-opening form.** The form includes the JD summary, background
    label + background, and reviews fields with the filled-at-search-
    time copy; adding an opening through it creates exactly one row
    with a unique slug. Evidence: form screenshot + new row.
    ☐ Pass ☐ Fail
29. **Screened-out section.** Screened-out openings appear only in the
    collapsed "Screened out — do not resurface" section, are excluded
    from items 10/14/15's counts, and a later refresh/search does not
    resurface one as new. Evidence: screenshots + counts.
    ☐ Pass ☐ Fail

## E. Visibility

30. **Closed / past-deadline — Board absence and lifecycle.** An
    **untracked** opening with status `Closed` and an untracked opening
    whose deadline is yesterday (applicant timezone) appear nowhere on
    the Board (groups, strip, counts, search), while a deadline of
    today still appears. A **tracked** past-deadline opening (package
    version/documents, or a post-submission status) is likewise absent
    from the Board but **present in the Tracker** with its documents
    intact. `cleanupClosedExpired` then deletes the untracked rows
    (with cascade) and retains the tracked one, reporting
    `{removed ≥ 1, keptTracked ≥ 1}`. Evidence: test rows +
    before/after counts + Tracker listing. ☐ Pass ☐ Fail

## F. Tracker

31. **Tracker membership exact.** The Tracker lists an opening iff it
    has indexed documents, or a package version, or a status at
    `Drafting` or beyond — verified against a hand-built truth table
    over the sample data, including one opening that meets only the
    package-version condition and one `Researched` opening with no
    package (must be absent). Evidence: truth table. ☐ Pass ☐ Fail
32. **Stage pills and compact rows.** The stage summary pills match
    hand counts per stage; each compact row shows title, employer ·
    req · location, deadline, and the correct stage pill for its
    status (per the DATA-MODEL mapping). Evidence: screenshot + hand
    count. ☐ Pass ☐ Fail
33. **Stage change writes exactly one status event.** Changing one
    row's stage creates exactly one new `status_events` row with the
    mapped status, updates the opening's status to match, and the
    Board agrees immediately. Evidence: event table before/after.
    ☐ Pass ☐ Fail
34. **Initiated no-regression.** For an opening at `Awaiting review`,
    selecting stage Initiated writes no event and leaves the status
    exactly `Awaiting review`, with the "already in progress" note.
    Evidence: event count unchanged + status quoted. ☐ Pass ☐ Fail
35. **Expanded row contents.** An expanded row shows the stage changer,
    the exact pipeline status, package version and approval record as
    plain text, deadline, last checked, next step, flags, documents,
    and the posting link. Evidence: screenshot. ☐ Pass ☐ Fail
36. **Email evidence — both cases.** A row whose change was recorded
    with an email shows sender, date, and subject exactly as recorded,
    newest first; a change recorded without an email shows the explicit
    "No email linked to this change"; a row with no events shows the
    explicit no-events statement. Evidence: screenshots of all three.
    ☐ Pass ☐ Fail
37. **Email-driven status change.** Recording a status change from chat
    with recruiter-email evidence (`recordStatusEvent` with sender /
    subject / date) updates the opening and appears under that row's
    Email evidence with the values exactly as supplied. Evidence:
    action log + screenshot. ☐ Pass ☐ Fail

## G. Master CV

38. **All entries shown, with badges.** The Master CV tab displays
    100% of the ledger entries in the data (count them), grouped by
    category in CV order, each with its fact-status badge and source
    reference where present; the fact-status explainer is present and
    correct (only user-attested/confirmed marked usable). Evidence:
    entry count + screenshots. ☐ Pass ☐ Fail
39. **Not a bibliography.** The tab shows every ledger section —
    profile, experience with full STAR bullets, skills, publications,
    awards, and the rest — not a publications-only list. Evidence:
    full-tab screenshot set. ☐ Pass ☐ Fail
40. **Master CV search.** Searching a term that appears in one entry's
    body shows that entry and hides non-matching entries; clearing the
    search restores all; a term in no entry shows the no-match state.
    Evidence: screenshots. ☐ Pass ☐ Fail
41. **Ledger add/edit/delete.** Adding a section (with the STAR
    guidance visible), editing a section's body and fact status, and
    deleting a section (with confirmation) each persist and render
    correctly after reload. Evidence: recordings + reload screenshots.
    ☐ Pass ☐ Fail
42. **"Add to my ledger" guidance.** The STAR guidance panel is present
    and states that a chat "add … to my ledger" request triggers
    STAR-detail questions before filing, never a bare note. Evidence:
    quoted panel text. ☐ Pass ☐ Fail
43. **Master CV file section.** When a master-CV document is indexed
    under `master-cv`, the file section appears with the PDF viewer,
    a working download, and the judge-by-PDF caveat; when none is
    indexed, the section is absent. Evidence: screenshots of both
    states. ☐ Pass ☐ Fail

## H. Documents

44. **PDF in-page.** Opening a PDF document renders it inside the page
    (embedded viewer) and offers a download that saves the real file.
    Evidence: screenshot + downloaded file hash/name. ☐ Pass ☐ Fail
45. **DOCX download.** Opening a DOCX document offers a download (no
    in-page render claim) and the downloaded file opens as the correct
    document. Evidence: download + file check. ☐ Pass ☐ Fail
46. **PACKAGE.md as text.** Opening a package-notes document renders
    its full text in-page. Evidence: screenshot. ☐ Pass ☐ Fail
47. **Missing file state.** A document row whose file has been moved
    shows the explicit not-found state naming the filename — not a
    blank panel or a generic error. Evidence: screenshot.
    ☐ Pass ☐ Fail

## I. Platform behaviours

48. **Back-to-top.** Scrolling ~600px in the app's scroll container
    (not the window) reveals the button; below that threshold it is
    hidden; on a phone it sits above the host function bar (safe-area
    + 5.25rem); clicking it returns to the top smoothly — and
    instantly with `prefers-reduced-motion` enabled. Evidence: screen
    recordings, both motion settings. ☐ Pass ☐ Fail
49. **Agent-request parity copy.** Research and tailor confirmations
    state the behaviour actually in effect on this platform
    (background task, Muse / queued for execution in chat, ChatGPT
    Sites), and repeated clicks do not create duplicate work (Muse:
    deduped per opening; ChatGPT Sites: one queue row per request).
    Evidence: quoted copy + task/queue listing. ☐ Pass ☐ Fail
50. **Form errors are the server's.** Submitting a form with an invalid
    value (e.g. coverage >100, or an over-limit field) shows the
    server's actual error message inline, once — not canned text and
    not a duplicate global notice. Evidence: screenshot with the
    message quoted. ☐ Pass ☐ Fail
51. **Blockers and answers editable.** Adding a blocker, toggling it
    resolved/reopened, and deleting it all persist; adding, editing,
    and deleting an answer (including a job-specific one with its job
    label) all persist. Evidence: recordings + reload. ☐ Pass ☐ Fail
52. **Dark mode legible.** In dark mode every tab is legible: text,
    pills, badges, dialog, and buttons meet the theme tokens of
    UI-SPEC §2 with no light-only surfaces. Evidence: screenshots of
    all tabs in dark mode. ☐ Pass ☐ Fail
53. **Remove from board.** Removing an opening from its expanded card
    (with confirmation) deletes exactly that opening and its card
    disappears; cancelling the confirmation deletes nothing.
    Evidence: counts before/after both paths. ☐ Pass ☐ Fail

## J. Sample → wipe → real-data flow

54. **Sample load.** The fictional sample dataset (Dr. Sam Lee) loads
    through the normal seed/sync path and items 1–53 pass against it.
    Evidence: this checklist, sample run. ☐ Pass ☐ Fail
55. **Wipe completeness (via `wipeAllData`).** Calling `wipeAllData`
    **without** the confirmation input (`confirm: true`) fails and
    deletes nothing. Calling it **with** the confirmation empties all
    six tables, returns the per-table removed counts, and leaves no
    sample name, employer, or score anywhere in the UI or data; the
    empty state renders and the sample can be re-seeded through the
    normal path. Evidence: the rejected unconfirmed call, the returned
    counts, row counts (all zero) after, counts after re-seed.
    ☐ Pass ☐ Fail
56. **Real-data load.** The real applicant's kit loads through the same
    seed/sync path (no hand-edited database), the ledger is built from
    the applicant's own CV and answers, and items 1–53 pass again —
    in particular items 10, 14, 31, and 38 with hand counts from the
    real data. Evidence: this checklist, real-data run.
    ☐ Pass ☐ Fail
57. **Nothing submitted.** At no point in the acceptance run was any
    application submitted, form sent, or employer contacted.
    Evidence: tester attestation. ☐ Pass ☐ Fail

## K. Data management (added in spec 2.0.1)

58. **`deleteOpening` cascade.** Create a test opening with indexed
    package documents and at least one recorded status event, then
    delete it via `deleteOpening`: the opening row, its document rows,
    and its event rows are all gone — zero orphaned rows reference the
    deleted opening's slug or id. Evidence: before/after counts per
    table. ☐ Pass ☐ Fail
59. **Per-row deletes.** `deleteDocument` removes exactly the targeted
    document row and no other; `deleteStatusEvent` removes exactly the
    targeted event row and no other, and the opening's current status
    is unchanged afterwards. Evidence: before/after counts + the
    opening's status. ☐ Pass ☐ Fail

## L. UI data controls (added in spec 2.0.2)

60. **Wipe control.** The Data controls section is present in the
    Workflow tab; its counts preview equals a hand count of all six
    tables; the execute button is disabled with an empty field and
    with any text other than exactly "WIPE" (including lowercase and
    partial text); typing "WIPE" enables it; executing calls
    `wipeAllData`, shows the returned per-table removed counts, all
    six tables are empty afterwards and the empty state renders; a
    server failure shows the server's message inline. Evidence:
    screenshots/recordings of the gate states (empty, non-matching,
    and exact "WIPE"), the action log for the `wipeAllData` call, and
    row counts of all six tables before and after. ☐ Pass ☐ Fail
61. **Per-row delete controls.** Each document row on the Packages
    surface and each status-history entry in a Tracker expanded row
    carries a delete control; the first click arms the inline
    confirmation and Cancel deletes nothing; confirming deletes
    exactly that row (the document row is gone and the counts update;
    the event row is gone and the opening's current status is
    unchanged). Evidence: screenshots/recordings of the armed and
    cancelled states, before/after row counts, and the opening's
    current status after an event deletion. ☐ Pass ☐ Fail

---

Result: ☐ Accepted  ☐ Not accepted — failing items: ______________
