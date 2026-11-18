---
name: jobseek-tailor
description: Tailor an industry resume, academic CV, or application answer set to a job description using a selected applicant ledger; produce reviewed PDF and editable DOCX outputs and retain scoped feedback. Use for application materials and their revisions.
---

# Jobseek Tailor — Tailored Documents

Build a tailored resume or CV and cover letter for one verified opening, from ledger evidence only, in one consistent format, and present the whole package together for exact-package approval.

## Purpose in one line

Turn verified posting requirements plus usable ledger evidence into documents that claim nothing the ledger cannot support — and prove it with rendering, text, grammar, and claims checks before anything is called ready.

## Before drafting

1. Resolve the selected applicant and job; load `applicant-profile.yaml` and inspect the current ledger and any prior feedback that actually applies to this job.
2. **Recheck the job description live** on the official careers page. Confirm the posting is still available, and record the official requisition ID, posting date, closing date, location, pay range, and application link. If the JD has changed, update the preserved JD and treat any prior approval as stale.
3. **Record the required application materials from the official posting before scoping the package** — resume / CV, cover letter, writing samples, references, transcripts, or anything else named — so a role needing more than resume plus cover letter is never presented as resume plus cover letter only.
4. Check for an existing application to the same verified opening before tailoring a duplicate (see `jobseek-track`).

## Map requirements to evidence — usable facts only

- Build a concise requirement-to-evidence map: each posting requirement, the usable ledger fact IDs that support the response, and any requirement with no support.
- **Map only to usable ledger evidence** — facts with status user-attested or confirmed. Pending, conflicted, or retired facts support nothing.
- **Never claim a `never_claim` item.** Anything listed under `never_claim` in `applicant-profile.yaml` — a skill, tool, credential, or experience the applicant has ruled out claiming — must not appear as a claim in any document or answer, however the JD is worded. The same applies to skills the ledger records as assisted or indirect rather than independently performed: describe them only as the ledger supports, or omit them.
- Use the JD's terminology only where it accurately describes the applicant's evidence. Do not add hidden keywords, unsupported tools, or exaggerated proficiency to raise a score.
- Ask for missing results rather than fabricating them. A bracketed gap in the ledger stays out of the document until the applicant supplies the value.

## Drafting rules

- Draft from the verified official JD and the ledger only.
- Write accomplishment bullets in **STAR form** — brief situation / task, the applicant's personal action, and the result — **quantified wherever the ledger supplies a number**, with its unit and attribution intact. Distinguish personal actions from team outcomes. Qualitative results are acceptable; invented numbers and invented causality are not.
- Education entries, publication citations, patents, skills, awards, and certificates keep conventional factual formats, and publication / patent status must match the ledger exactly. Do not present planned work as completed, unpublished results as peer-reviewed publications, or a patent application as a granted patent.
- Keep internal evidence notes, fact IDs, placeholders, drafting comments, and review instructions out of submission documents.
- **Cover letter:** keep it scientifically and professionally precise and free of generic phrasing. Every paragraph should be specific to this applicant, this employer, and this posting — its programme, pipeline, lab direction, or mission as mapped from the ledger — or be cut.

## Format — one clean format, judged on the PDF

- **Industry: a 2-page resume. Academic: a full detailed CV with no fixed page cap** — unless the employer specifies otherwise, in which case the employer's specification governs. Check the finished resume page count and the cover letter page count against the applicable rule before presenting.
- Build every CV and resume in **ONE consistent format: the clean style specified in `templates/FORMAT-STANDARD.md`** in the applicant workspace (Times New Roman, right-aligned dates, title-first role lines with italic institutions, hanging-indent publications with italic journals, grouped skills with bold labels, no tagline). Content depth varies by document type; the visual format does not.
- **Judge format on the PDF render**, not on an in-app preview, which may substitute fonts and compress spacing. The downloaded file opened in a real editor, and the PDF, are the ground truth.
- **Never invent a layout** for a build. If the format standard cannot be applied with the available tools, say so and leave the files as drafts.
- **Do not apply the rejected-improvements list.** A set of research-backed content additions — a page-2 footer, an "(n of N)" publication count, a bulleted summary, award selectivity notes, and a folded in-preparation section — was proposed, previewed, adopted, and then dropped by applicant decision. Do not reintroduce any of them unless the applicant explicitly asks again.
- Do not include a scholarly-profile listing or citation metrics on industry resumes unless the applicant's current, explicit instruction for that package says otherwise.
- Generate both a PDF and an editable DOCX from the same content source, in a clean single-column layout with selectable text and a natural reading order. Do not guarantee an ATS score or universal compatibility.

## Two mandatory gates before presenting

### 1. Grammar gate

Every CV, resume, and cover letter must pass a **dedicated proofreading pass** over its final text before it is presented — grammar, punctuation, subject–verb agreement, tense consistency, articles, and spelling. Fix every error found. This pass is **mandatory, not optional**, and a package that has not passed it is not presented. (This gate exists because grammatical mistakes were found in past tailored resumes.)

### 2. Document QA gate

Before a package is called ready:

1. **Render and inspect every page** of the PDF / DOCX output for clipping, overlap, missing characters, awkward breaks, and legibility.
2. **Extract and check the text** — completeness, reading order, names, dates, statuses, and links.
3. **Verify PDF and DOCX agree** with each other and with the intended content.
4. **Check every substantive claim against usable ledger facts.** Any unsupported claim comes out or returns the document to drafting.
5. Record visual review only after actually viewing every page. Generated files and text checks alone do not establish visual QA.

A failed render, a failed check, or an unresolved item leaves the files as **drafts** — never describe them as submission-ready, and state the specific unresolved limitation.

## Versioning and approval

- Save each package under one folder per job, containing the JD, the fit scorecard, the employer background, and the finished documents.
- Use **versioned files** (for example `resume-v3`, `cover-letter-v2`). **Earlier approved versions are preserved, never overwritten** by changed content; a revision is a new version.
- Record feedback by type and scope: a factual correction updates the ledger with provenance (see `jobseek-ledger`); a wording or formatting preference goes to presentation rules, global only when the applicant explicitly makes it general; a job-specific inclusion decision applies to that opening only. Do not infer global preferences from a single rejection or from silence, and never treat approval of wording as evidence for a new fact.
- **Approval is exact-package approval.** Record it in the package record against the exact JD version, document versions, supporting fact revisions, and answer set, with status and date. Silence is not approval; approval for one opening never transfers to another; any change to the JD, documents, facts, or answers returns the package to review. The applicant may revoke an approval explicitly. Only an approved copy may be marked final.

## Present the package together

Present, **together in one review**, for the applicant's decision:

- the exact JD (verified, official version),
- the fit scorecard (evidence coverage, Unknown share, flags),
- the employer background and reviews (already researched at search time),
- the tailored CV / resume, and
- the cover letter — plus any other materials the official posting requires.

Include unresolved questions and known gaps (for example a requirement the ledger cannot evidence) in the presentation, not buried in a file. Log the reviewed job in the ledger / tracker with its fit score, decision, and file location.

This skill prepares materials; it does not send them to employers, contact an employer, or start an application. That happens only through `jobseek-apply`, on the applicant's request, against a current exact-package approval.

Use the answer bank only when its facts and scope remain current; adapt job-specific answers and obtain review. Do not populate sensitive or declarative responses from assumptions.
