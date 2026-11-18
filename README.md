# jobseek-skills v2

Version: 2.0.2 — see `VERSION` and `CHANGELOG.md`.

## What this is

A portable, ledger-driven job-search workflow for a scientist moving beyond a
postdoctoral appointment, plus a buildable specification for a Job Search
Dashboard that runs on top of it.

The workflow is one pipeline, in this order:

**ledger → search → score → tailor → exact approval → apply → track + dashboard**

1. **Ledger** — one master record of the applicant's attested facts: education,
   STAR-form experience, quantified results, publications, awards, skills and
   constraints. Nothing is drafted from anything that is not in the ledger.
2. **Search** — batches of openings across general boards, direct employer
   sites, government portals, universities, institutes, hospitals, nonprofits
   and specialist/society boards, deduplicated, with sources checked and
   omissions recorded.
3. **Score** — every opening is scored by evidence coverage against the ledger
   (see `templates/FIT-SCORECARD.md`). Eligibility, location, start date and
   deadline are flags next to the score, never inside it.
4. **Tailor** — for a chosen opening, a package is built from the verified
   official posting and the ledger only: fit scorecard, employer background
   (with sources and dates), employer reviews, tailored CV/resume and cover
   letter, all in the single format in `templates/FORMAT-STANDARD.md`.
5. **Exact approval** — approval binds the exact JD version, document versions,
   supporting fact revisions and answer set, and is recorded in the package.
   Silence is not approval. Approval for one opening never transfers to
   another. Any change returns the package to review.
6. **Apply** — application assistance is page-by-page and applicant-led: the
   applicant clicks every Next / Continue / Proceed / Submit control and
   handles login, signatures, attestations and consent. A submission is
   recorded only from an observed confirmation or the applicant's explicit
   report — a filled form is not a submission.
7. **Track + dashboard** — every opening, package, approval and outcome is
   tracked (see `templates/TRACKER.template.md`) and surfaced in the Job
   Search Dashboard specified under `dashboard/`.

Employer and position background and employer reviews are filled for **every**
position when it is searched or found, not only when a package is built. For
academic / lab-based positions the background also covers the lab itself: its
publications and major conference abstracts from the past five years and its
lab website, summarised as research goals and potential directions, with
stated goals kept distinct from inferred directions.

## Quickstart

You need exactly one instruction. Paste the block for your platform, verbatim,
then follow its steps: give the agent your CV and answer its ledger questions.

### Muse

```text
Clone https://github.com/shanetsao/jobseek-skills (v2). Read README.md, dashboard/SPEC.md, and adapters/muse/BUILD-PROMPT.md. Build me the Job Search Dashboard exactly to spec, using only my data: I will give you my CV and answer your ledger questions. First load the sample dataset in examples/sample-applicant/ and pass every item in dashboard/ACCEPTANCE.md, show me the results, then wipe the sample and build my ledger from my CV. Never invent a fact, a score, or a background. Do not submit any application.
```

### ChatGPT (Sites)

```text
Use @Sites to build this. Clone https://github.com/shanetsao/jobseek-skills (v2). Read README.md, dashboard/SPEC.md, and adapters/chatgpt-sites/BUILD-PROMPT.md. Build me the Job Search Dashboard exactly to spec, using only my data: I will give you my CV and answer your ledger questions. First load the sample dataset in examples/sample-applicant/ and pass every item in dashboard/ACCEPTANCE.md, show me the results, then wipe the sample and build my ledger from my CV. Never invent a fact, a score, or a background. Do not submit any application. Do not publish the Site.
```

## Repo layout map

```text
README.md                     This file: overview and quickstart
README.zh-CN.md               Chinese version of this file
CHANGELOG.md                  v1 → v2 changes
VERSION                       Current version (2.0.2)
.gitignore                    Keeps real applicant data and build outputs out

skills/                       The workflow skills (ledger, search, score,
                              tailor, apply, track, dashboard)
  jobseek/                    Coordinator skill, plus the shared files
    references/               records, onboarding, search, tailoring,
                              application, state-commands, matching,
                              document-commands (see its SKILL.md)
    scripts/                  jobseek_state.py, jobseek_match.py,
                              jobseek_documents.py (stdlib Python)
    agents/openai.yaml        Codex/ChatGPT interface def (Muse ignores)
templates/                    Reusable blank templates
  LEDGER.template.md          Master ledger structure
  TRACKER.template.md         Openings tracker structure
  PACKAGE.template.md         Exact-package record structure
  FIT-SCORECARD.md            Evidence-coverage scoring method
  FORMAT-STANDARD.md          The one CV/resume format
  applicant-profile.template.yaml   Applicant profile schema
applicant-data/               The interchange kit (see its README.md)
  README.md                   Kit specification — the kit itself is NOT here
dashboard/                    Dashboard specification and reference build
  SPEC.md                     What the dashboard must do
  DATA-MODEL.md               Tables and fields
  UI-SPEC.md                  Tabs, actions and behaviours
  ACCEPTANCE.md               Item-by-item acceptance checklist
  reference/                  Reference implementation to start from
examples/
  sample-applicant/           Fictional sample dataset (Dr. Sam Lee)
adapters/
  muse/BUILD-PROMPT.md        Build prompt and steps for Muse
  chatgpt-sites/BUILD-PROMPT.md     Build prompt and mapping for ChatGPT Sites
```

## Privacy warning

**Real applicant data is never committed to this repository.**

This repo contains the workflow, templates, dashboard specification and a
fictional sample dataset only. A real applicant-data kit — profile, ledger,
openings, packages, documents, answers — lives **outside** this public repo,
or in a separate private repository. The `.gitignore` in this repo is written
to block the common accident paths (real `LEDGER.md`, `TRACKER.md`,
`dossier.md`, `state.json`, databases, `applications/`, DOCX/PDF outputs and
everything under `applicant-data/` except its README), but ignore rules are a
backstop, not a guarantee: check `git status` before every commit.

## Platform parity note

The workflow, data model, dashboard behaviour and acceptance test are the
same on Muse and on ChatGPT Sites. There is **one difference: agent-request
execution**.

- On Muse, dashboard agent requests (for example "build a tailored package"
  or "refresh the search") can be executed by a background agent task.
- On ChatGPT Sites, a Site cannot run an agent in the background. Agent
  requests are saved to a pending-request queue and are executed by ChatGPT
  in chat, with results saved back through the same save actions.

Everything else — tables, actions and their semantics, tabs, theme,
behaviours, the applicant-data kit as source of truth — is identical. See
`adapters/chatgpt-sites/BUILD-PROMPT.md` for the full mapping.
