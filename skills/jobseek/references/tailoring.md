# Tailoring: build an exact package from the ledger

A package is built for one verified opening, from the ledger only, and
is presented to the applicant as a unit: the job description, the
tailored CV/resume, and the cover letter together.

## Before drafting

1. Re-verify the JD live (official posting; see `search.md`). If the
   posting changed or closed, stop and say so.
2. Score the opening: record per-competency `assessments` against the
   ledger and run the matching helper (`matching.md`). Evidence
   coverage is the headline number; report the Unknown share and the
   confirmed gaps with it. Below the applicant's threshold (default
   30%), say so plainly — building anyway is the applicant's call, made
   with the number in front of them.
3. Check the never-claim list and every eligibility flag on the
   opening. A requirement on the never-claim list is a Gap with that
   reason recorded — it is never written around, softened, or implied.

## Drafting rules

- **Ledger facts only.** Every claim in the CV/resume and cover letter
  traces to a `user-attested` or `confirmed` ledger entry. Nothing is
  added from the JD's vocabulary that the ledger does not support.
- **STAR bullets** for experience: situation, task, action, result,
  with the quantified results the ledger carries. Pending numbers stay
  out until confirmed.
- **Format follows the applicant's track**: academic roles get the full
  detailed CV; industry roles get a 2-page resume unless the posting
  specifies otherwise.
- **One format standard** for all documents (the clean style in the
  applicant's format standard: serif body font, right-aligned dates,
  title-first role lines, hanging-indent publications, grouped skills
  with bold labels, no tagline). Never invent a layout per package.
- **Grammar gate (mandatory).** Every CV, resume, and cover letter gets
  a dedicated proofreading pass before presentation. A package with a
  known grammar error is not presented.
- Page counts are verified on the rendered files (industry resume
  exactly 2 pages, cover letter 1 page), not assumed from the source.

## The package record

`packages/<slug>/PACKAGE.md` records: the opening and its verified JD
(source URL, requisition ID, deadline), the scores (coverage, Unknown
share, scorecard), the document files by name and version (indexed in
`documents-index.json`), the QA log (manifest, text checks, visual
review — see `document-commands.md`), the gaps and how each was
handled, and the **approval record**: `NOT APPROVED` until the
applicant approves these exact files. Any edit after approval returns
the record to not-approved and the changed files need fresh approval.

## Presentation

Present the JD, the tailored CV/resume, and the cover letter together,
with the scores, the gaps, and the deadline (and its practical last
day, counting the applicant's review time). Approval is per package
and per version; silence is not approval; approval of a similar
package for another opening approves nothing here.
