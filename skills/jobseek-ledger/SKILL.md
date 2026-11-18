---
name: jobseek-ledger
description: Create, import, update, or review a detailed local applicant ledger, career preferences, and evidence-backed accomplishment stories for job applications. Use for CV history and applicant fact corrections, not ordinary document editing.
---

# Jobseek Ledger — The Evidence Ledger

Build and maintain the applicant's master career ledger — the single source every search score, tailored document, and application answer must trace back to.

## Purpose in one line

Record what the applicant has actually done, with provenance and review status, so that nothing is ever claimed in a search, a CV, or an application that the ledger cannot support.

## Start from the CV

1. Resolve the selected workspace and applicant profile, and load `applicant-profile.yaml`, before reading or writing applicant data. Inspect current records and revisions rather than relying on remembered history.
2. **Build CV-first.** Build the ledger from the applicant's most recent CV or resume before tailoring anything. Preserve the source file separately and record its location, provenance, and review status.
3. Record in the ledger: contact details; education; every role as a STAR-ready entry; a keyword bank grouped by skill area; publications; patents; awards; presentations; mentoring, teaching, and service; certificates and licences; and references where the applicant supplies them.
4. Treat the ledger as the master source. When a fact changes, edit the ledger first; tailored documents are regenerated from it, never edited into a new version of the truth.

## STAR entries

Write experience entries in STAR form so they can be compressed into bullets later without losing the evidence:

- **Situation / Task** — the context, problem, or responsibility.
- **Action** — what the applicant personally did, separated from what the team did.
- **Result** — the outcome, quantified wherever the applicant supplies a number.

Rules for STAR entries:

- Separate individual contributions from team results, and experience from demonstrated proficiency. Do not convert a technique mention into expertise, or a course into professional experience.
- Capture, where relevant: actual title or degree, institution, location, dates with their real precision, methods and tools with context and last-used date, scale, collaborators, outputs, and supported metrics with units.
- Publications and presentations keep full citation, authorship, venue, date, identifier / link, and current status — distinguish preprint, submitted, accepted, and published. Patents keep inventorship, title, jurisdiction, number if known, filing / grant dates, and application-versus-granted status. Never convert one status into another.
- Awards, scholarships, and grants keep name, granting body, date, role, and amount or selectivity only when supported.

## Fact statuses — who may use what

Every ledger fact carries exactly one review status:

| Status | Meaning | Usable for matching / drafting? |
|---|---|---|
| `user-attested` | The applicant stated it explicitly | Yes |
| `confirmed` | Extracted from a source and reviewed by the applicant | Yes |
| `pending` | Imported or extracted, not yet reviewed | No |
| `conflicted` | Contradictory evidence exists | No |
| `retired` | Historical, no longer current | No |

- **Only `user-attested` and `confirmed` facts are usable** for matching, scoring, drafting, or application answers. A claim that cites a pending, conflicted, or retired fact earns no credit and must not appear in a document.
- Process only the material supplied or identified for the task. Use explicit applicant statements as user-attested facts; keep extracted facts pending until reviewed.
- Surface contradictions in dates, titles, outcomes, attribution, and publication / patent status. Do not silently choose a version — mark the fact conflicted and ask.
- **Corrections preserve history.** A correction keeps the old value in the fact's history with its provenance, records the new value and who supplied it, and **flags every dependent package** (any tailored document, answer, or application built from the old value) for re-review. A changed fact can return an approved package to review.
- Never invent a number, a skill, a patent, a publication, or a leadership claim to fill a gap.

## "Add X to my ledger" — ask first, in STAR form

When the applicant says "add X to my ledger" (or similar), do not file a bare note. Before filing, ask for enough detail to write the entry in STAR form when the item needs it:

1. What was the situation or task?
2. What did you personally do?
3. What was the measurable result?

Then file the entry in that form and confirm back what was recorded, including its status. If the applicant cannot supply a number yet, file the entry with the missing number in **[brackets]** — for example `improved assay throughput by [X]%` — and leave the bracket visible in the ledger as an open question. Bracketed values are never carried into a tailored document.

Ask focused questions that materially improve an active search or a missing accomplishment. Do not require every possible ledger field to be populated before useful work begins.

## Keyword bank

Maintain a keyword bank grouped by skill area, built only from usable facts. Record the exact source term, the context of use, the supported proficiency description, and the last-used date when known. The bank exists so search matching and tailoring reuse the applicant's real terminology instead of rebuilding history for each role — it is never a place to park aspirational keywords the evidence does not support.

## Store different kinds of record separately

Keep these in their own records; never collapse them into one note:

- **Facts** — what happened, with status and provenance (above).
- **Wording and formatting preferences** — how the applicant wants material presented. A preference becomes a general / global rule only when the applicant explicitly makes it general; otherwise it applies to the one occasion stated.
- **Job-specific inclusion decisions** — what the applicant chose to include, emphasise, or omit for one opening. A rejected bullet does not erase the underlying experience, and the reason for a rejection is never inferred.

Record the format rules, fit threshold, and accumulated feedback in a style-guide section of the ledger so later packages improve instead of restarting.

## Internal-only constraints

Keep work authorisation, clearance, start date, salary expectations, and similar constraints in the ledger — and in `applicant-profile.yaml` eligibility flags — as **internal notes only**. Use them for screening and flagging. Never put work authorisation or visa status on a CV or resume unless the posting itself requires it, and never guess these values for an application answer.

## Answer bank

Save the applicant's approved common application answers in the ledger, each with:

- the answer text and its version,
- the supporting fact IDs it rests on, and
- its intended scope (general, track-specific, or one application only).

Reuse requires rechecking that the supporting facts are still current, still usable, and relevant to the new job. Never guess work authorisation, salary expectations, availability, demographics, declarations, or consent.

## Saving and validating

Store applicant records in the selected workspace, never in this skill package. Do not import personal details from unrelated profiles or conversations. Use the state helper (`skills/jobseek/scripts/jobseek_state.py`; see `skills/jobseek/references/state-commands.md`) to validate the kit, and regenerate `LEDGER.md` only after reconciling manual edits. Summarise additions, conflicts, bracketed gaps, and questions that remain.

Example: if fictional applicant Dr. Sam Lee says "add my mentoring to my ledger," ask who was mentored, what Dr. Lee personally did, and what resulted, then file a STAR entry — not the single line "mentored students."
