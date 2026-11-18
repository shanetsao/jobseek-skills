# Adapter: ChatGPT Sites — build the Job Search Dashboard

Builds the same Job Search Dashboard as the Muse adapter, on ChatGPT
Sites. The specification (`dashboard/SPEC.md`, `dashboard/DATA-MODEL.md`,
`dashboard/UI-SPEC.md`, `dashboard/ACCEPTANCE.md`) is identical; only the
platform plumbing differs, as mapped below.

## Platform facts

- Sites requires a **Plus, Pro, Business or Enterprise** plan.
- Building a Site counts toward **Codex usage**.
- Each Site database can hold up to **10 GB**, and Sites also provides
  file storage for uploaded files.
- New Sites are **private by default — keep it private.** The dashboard
  holds personal job-search data; do not publish the Site or change its
  sharing settings.

## Mapping: Muse implementation → ChatGPT Site

| Muse | ChatGPT Sites equivalent |
|---|---|
| Muse server actions (the dashboard's named actions, with their semantics) | Site backend functions with the **same names, inputs and semantics**. The action contract in `dashboard/SPEC.md` / `dashboard/UI-SPEC.md` does not change; only the implementation host does. |
| Drizzle / SQLite database accessed via `ctx.db` | The Site's own database. Same tables and fields as `dashboard/DATA-MODEL.md`; the database is a cache seeded from the applicant-data kit, exactly as on Muse. |
| Privileged workspace file read, restricted to the job-search folder | Site file storage: package files (JD, scorecard, background, CV/resume, cover letter) are uploaded to the Site's file storage and referenced from the documents index. Reads are scoped to those uploaded package files — there is no general workspace access. |
| `ctx.agent.spawnTask` background tasks (dashboard agent requests executed by a background agent) | **Pending-request queue.** The Site saves an agent request (for example "build a tailored package" or "refresh the search") to a queue table. ChatGPT executes the request **in chat**, and saves the results back through the same save actions the dashboard itself uses. See "The one parity difference" below. |
| Muse cron weekly refresh | A Sites automation / scheduled chat check, where available on the applicant's plan. Where no scheduling is available, the refresh is a manual weekly prompt the applicant pastes into chat; the refresh work itself (search batch, rescoring, tracker + dashboard sync, 21-day deadline flags) is unchanged. |

## The one parity difference

**Agent-request execution is the one difference between the platforms**,
and it is stated plainly so nobody designs around a capability that is
not there:

- On Muse, a dashboard agent request can be handed to a background agent
  task and completed without a chat session.
- On ChatGPT Sites, a Site **cannot** run an agent in the background. An
  agent request sits in the pending-request queue until ChatGPT picks it
  up in a chat session, does the work there, and saves the results back
  via the same save actions.

Everything else — tables, action names and semantics, tabs, theme,
behaviours, the applicant-data kit as source of truth, the acceptance
test — is identical.

## Copy-ready @Sites prompt

Paste the specification files (`dashboard/SPEC.md`,
`dashboard/DATA-MODEL.md`, `dashboard/UI-SPEC.md` and
`dashboard/ACCEPTANCE.md`) into the conversation with this prompt:

```text
Use @Sites to build this. Clone https://github.com/shanetsao/jobseek-skills (v2). Read README.md, dashboard/SPEC.md, and adapters/chatgpt-sites/BUILD-PROMPT.md. Build me the Job Search Dashboard exactly to spec, using only my data: I will give you my CV and answer your ledger questions. First load the sample dataset in examples/sample-applicant/ and pass every item in dashboard/ACCEPTANCE.md, show me the results, then wipe the sample and build my ledger from my CV. Never invent a fact, a score, or a background. Do not submit any application. Do not publish the Site.
```

## Build steps

1. Read `README.md`, `dashboard/SPEC.md`, `dashboard/DATA-MODEL.md` and
   `dashboard/UI-SPEC.md` in full. Build the Site exactly to spec — same
   tables, same action names and semantics (as Site backend functions),
   same tabs, same theme, same behaviours, including the report dialog,
   in-place card expansion, clickable summary stat boxes and back-to-top
   button — using the mapping above for the platform plumbing.
2. Keep the Site **private**. Do not publish it.
3. Seed the Site database from the applicant-data kit (see
   `applicant-data/README.md`); the kit is the source of truth and the
   Site database is a cache. Upload package files to Site file storage.
4. Load `examples/sample-applicant/` (the fictional Dr. Sam Lee dataset),
   run `dashboard/ACCEPTANCE.md` item by item, and show the applicant the
   result of every item. Fix failures before loading real data.
   **Sample-document materialisation (the convention):** seeding indexes
   documents but copies no files — upload the sample package files
   (`examples/sample-applicant/packages/**`) to the Site's file storage
   under the seeded filenames/paths, in a clearly sample-only area, so
   the document index resolves; remove them when the sample is wiped.
5. Only on the applicant's go-ahead: wipe the sample with the Site's
   **`wipeAllData`** backend function, passing its required confirmation
   (`confirm: true`) — the same name, inputs and semantics as on Muse:
   it empties all six tables and returns the per-table removed counts,
   and a call without the confirmation must be rejected. The
   pending-request queue cannot substitute for it — the Site itself must
   expose `wipeAllData`, `deleteDocument`, and `deleteStatusEvent`, and
   `deleteOpening` must cascade to the opening's documents and status
   events, exactly as specified. Expiry cleanup
   (`cleanupClosedExpired`) is narrower: it deletes only *untracked*
   Closed/past-deadline openings and retains tracked ones (off the
   board, on the Tracker, package and history intact) — never use it as
   a wipe. Then build the
   applicant's ledger from the CV they provide, asking STAR questions and
   asking for missing numbers rather than estimating them. Nothing is
   usable for matching or drafting unless it is user-attested or
   confirmed.
6. Implement agent requests as the pending-request queue described above,
   and set up the weekly refresh as a Sites automation / scheduled chat
   check where available, otherwise as the manual weekly prompt.
7. Never invent a fact, a score, or a background. Never submit an
   application, and never contact an employer.
