# Application: assisted submission and tracking

Submission is applicant-driven. The agent prepares, navigates, and
fills; **the applicant clicks every Next / Continue / Submit** and
makes every attestation. A submission exists only when a confirmation
was observed — never because a form "should have" gone through.

## Preconditions

- The package for this opening is approved — the exact files, recorded
  in `PACKAGE.md` (see `tailoring.md`). Unapproved or changed-since-
  approval files are not submitted.
- The posting is still live (re-checked this session) and the deadline
  has not passed.
- Eligibility flags on the opening have been resolved or explicitly
  accepted by the applicant with the flag in front of them.

## Filling the application

- Use the approved documents and the kit's `answers.json` for reusable
  questions. An answer scoped to another opening is not reused.
- Every answer must be truthful against the ledger. Where a form field
  forces a choice the ledger does not support (a skill the applicant
  does not claim, a date they cannot meet), stop and surface it — do
  not pick the convenient option.
- Work-authorisation and eligibility questions are answered from the
  profile's recorded facts, exactly as recorded. If the truthful answer
  ends the application, that is the outcome; record it.
- Keep a per-application log: portal, account, date, documents uploaded
  (file names + versions), and any confirmation number or page text —
  observed, copied exactly, never reconstructed.

## Confirmation and status

On observed confirmation, record a status event (`Submitted`, with
date) and set the opening's status. If the outcome of a submission
attempt is unknown (timeout, ambiguous page), say so and verify before
any retry — a duplicate submission is worse than a slow one.

After submission, the tracker follows the outcome:

- Recruiter or portal emails are evidence. A status change driven by an
  email is recorded as a status event citing the email's **sender,
  date, and subject** (all three) in `status-events.json`.
- Interviews, rejections, and offers are recorded the same way, with
  dates as observed.
- The applicant's own `blockers.json` items (references to request,
  samples to prepare, forms to sign) are tracked until done.

## What application never does

It never clicks Submit for the applicant, never submits an unapproved
package, never answers an attestation the applicant has not seen, and
never reports a status — submitted, responded, rejected — without an
observed source behind it.
