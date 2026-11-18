# Adapter: Muse — build the Job Search Dashboard

Copy-ready prompt and the steps behind it. The prompt is the whole
instruction; the steps explain what it sets in motion so the applicant can
check the build as it goes.

## Copy-ready prompt

```text
Clone https://github.com/shanetsao/jobseek-skills (v2). Read README.md, dashboard/SPEC.md, and adapters/muse/BUILD-PROMPT.md. Build me the Job Search Dashboard exactly to spec, using only my data: I will give you my CV and answer your ledger questions. First load the sample dataset in examples/sample-applicant/ and pass every item in dashboard/ACCEPTANCE.md, show me the results, then wipe the sample and build my ledger from my CV. Never invent a fact, a score, or a background. Do not submit any application.
```

## Steps

1. **Read the specification first.** Read `README.md`,
   `dashboard/SPEC.md`, `dashboard/DATA-MODEL.md` and `dashboard/UI-SPEC.md`
   in full before building anything. Where the spec and any prior habit
   disagree, the spec governs.

2. **Use the reference as the starting point.** Start from
   `dashboard/reference/` and adapt it; do not design a new dashboard.
   Build a Space named **"Job Search Dashboard"** exactly to spec:
   - the tables defined in `dashboard/DATA-MODEL.md`;
   - the server actions with the exact names and semantics defined in
     `dashboard/SPEC.md` and `dashboard/UI-SPEC.md` — same names, same
     inputs, same effects;
   - the tabs defined in `dashboard/UI-SPEC.md`;
   - the theme defined in `dashboard/UI-SPEC.md`;
   - the behaviours defined in `dashboard/UI-SPEC.md`, including the
     report dialog behaviour (visible close control, the report scrolls
     while the list behind it stays locked, dialog clear of the app
     function bar), in-place expansion inside cards, the clickable summary
     stat boxes, and the back-to-top button.

   Declare **both** seed actions as the build's post-submit actions, in
   order — `seedFromTracker` first, then `syncDashboardContent`. The
   first populates openings, blockers, and answers; the second populates
   the ledger entries and the package-document index. Declaring only
   `seedFromTracker` leaves the durable database with an empty ledger
   and document index (a client-side first-load seed can mask this in a
   preview while the stored data stays incomplete) — this exact failure
   was observed in the v2 dry-run rebuild (2026-11-18) and corrected
   there by running both actions.

3. **Seed from the applicant-data kit.** The kit described in
   `applicant-data/README.md` is the source of truth; the Space database is
   a cache seeded from it. If no real kit exists yet, proceed to step 4
   with the sample dataset.

4. **Load the sample dataset and prove the build.** Load
   `examples/sample-applicant/` (the fictional Dr. Sam Lee dataset) and run
   `dashboard/ACCEPTANCE.md` item by item. Report the result of **every**
   item to the applicant — pass or fail, with what was checked — and fix
   failures before going further. Do not load real data into a build that
   has not passed acceptance.

   **Sample-document materialisation (the convention).** The seeded
   document index points at relative paths, but seeding does not copy
   any files. To make the sample documents resolve, copy the sample
   package files (`examples/sample-applicant/packages/**`) into an
   **isolated sample data folder** in the workspace (name it after the
   build, e.g. `jobseek-v2-sample/` — never the applicant's real
   job-search folder) and retarget the privileged reader's allowed
   prefix to that folder for the sample phase. This isolated-folder
   approach is the standard: it is what the v2 dry-run rebuild used, and
   it keeps fictional files from ever mixing with real package files.
   When real data is loaded (step 5), the reader is pointed back at the
   applicant's real job-search folder and its seeded paths.

5. **Wipe the sample, then build the real ledger.** Only on the applicant's
   go-ahead: wipe the sample with the **`wipeAllData`** action, passing
   its required confirmation (`confirm: true`) — it empties all six
   tables and returns the per-table removed counts; verify every count
   matches the sample load and that a call without the confirmation is
   rejected. (Expiry cleanup is a different, narrower operation:
   `cleanupClosedExpired` deletes only *untracked* Closed/past-deadline
   openings and always retains tracked ones — never use it as a wipe.)
   Then build the applicant's ledger from
   the CV they attach. Ask STAR questions for every entry that needs them
   (situation/task, what the applicant personally did, measurable result)
   and ask for every missing number instead of estimating one; hold
   missing numbers as bracketed placeholders. Mark each fact's status:
   nothing is usable for matching or drafting unless it is user-attested
   or confirmed. Pending, conflicted and retired facts stay unusable.

6. **Create the goal and link the dashboard.** Create a goal titled
   **"A science career beyond the postdoc"** and link the Job Search
   Dashboard to it, so search, tailoring and tracking work attaches to the
   goal rather than to a new tracked item.

7. **Set the weekly refresh.** Schedule the weekly search refresh using the
   applicant profile's refresh preference (weekday, time and timezone from
   `profile.yaml`), syncing the tracker and the dashboard together, and
   flagging any deadline within 21 days.

8. **Hard limits, always.** Never invent a fact, a score, or a background.
   Never submit an application, and never contact an employer. Application
   assistance, if the applicant later asks for it, is applicant-led: the
   applicant clicks every Next / Continue / Proceed / Submit control.
