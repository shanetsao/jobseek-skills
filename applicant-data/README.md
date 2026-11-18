# Applicant-data kit — interchange specification

The applicant-data kit is the portable, platform-neutral record of one
applicant's job search. Dashboard builders on any platform seed from it and
export back to it.

## Source of truth

**This kit is the source of truth. Platform databases are caches.**

A dashboard database (a Muse Space database, a ChatGPT Site database, or
any other) is seeded from the kit and can be rebuilt from it at any time.
When the kit and a platform database disagree, the kit wins, and the
database is re-seeded or corrected from the kit. Exports run the other way
on demand: changes made in a dashboard are written back to the kit files so
the kit stays complete and portable.

## Where the real kit lives

**A real kit never lives in the public repo.** It lives outside the public
repository entirely, or in a separate private repository. This folder in
the public repo contains only this specification. The repo `.gitignore`
blocks everything under `applicant-data/` except this README — treat that
as a backstop and keep real kits elsewhere by default.

## Files

```text
applicant-data/
  profile.yaml              Applicant profile (see templates/)
  ledger.json               Structured ledger
  LEDGER.md                 Human-readable ledger, rendered from the same facts
  openings.json             Tracked openings
  documents-index.json      Index of generated documents and versions
  answers.json              Answer bank and per-application answer sets
  status-events.json        Append-only status history
  packages/
    <slug>/                 One folder per tailored package
      PACKAGE.md            Exact-package record (see templates/)
      ...                   JD, scorecard, background and document files
```

`<slug>` is a short, stable, lowercase identifier for the opening, chosen
once when the package is created and never renamed afterwards, so links
between files stay valid.

## Field notes per file

### profile.yaml

The applicant profile, following
`templates/applicant-profile.template.yaml`: identity and contact details,
the goal statement and tracks, role families in scope, regions, and the
internal-only constraints and preferences. Internal-only fields (earliest
start, eligibility flags, work authorisation note, never-claim list) are
for screening only and are never rendered onto documents.

### ledger.json

The structured form of the master ledger: identity, education, STAR
experience entries, keyword bank, training, publications (published /
under review / in preparation), awards, presentations, mentoring,
references, and the quantified-results dossier. Every fact carries a
status — user-attested, confirmed, pending, conflicted or retired — and
only user-attested and confirmed facts are usable for matching or
drafting. Missing numbers are held as bracketed placeholders, never
invented values.

### LEDGER.md

The same ledger rendered as readable Markdown, following
`templates/LEDGER.template.md`, including the style-guide section. It is
generated from the same facts as `ledger.json`; if the two ever disagree,
reconcile them from the applicant's attested facts and record the
correction — do not silently prefer one rendering.

### openings.json

One record per tracked opening, with the tracker fields from
`templates/TRACKER.template.md`: title, employer, requisition identifier,
track, status, evidence coverage, unknown share, scorecard reference,
deadline, package version, approval status, next action, flags and last
checked date. Screened-out openings are kept, with their reason, in a
separate list in the same file. Employer background and reviews for each
opening are stored with the opening record, filled when the opening is
found.

### documents-index.json

An index of every generated document: which package it belongs to, document
type (CV, resume, cover letter, other required material), version, page
count, file location inside the package folder, format-standard check
result, and whether it is the applicant-approved copy. The index points at
files; it does not embed document contents.

### answers.json

The answer bank (approved common answers, each with supporting ledger
facts, intended scope and approval date) plus the per-application answer
sets actually used, keyed by package slug. Reuse of a banked answer
requires rechecking that its facts are current and relevant to the
specific posting.

### status-events.json

An append-only log of status events: opening found, scored, shortlisted,
package drafted, approval granted or revoked, application filling started,
submission observed, and outcomes (interview, offer, rejection, withdrawal,
closure). Each event records the opening or package it concerns, the new
status, the date, and its evidence — for recruiter-email-driven changes,
the sender, date and subject of the email. Events are never edited or
deleted; a correction is a new event.

### packages/<slug>/

One folder per tailored package, following
`templates/PACKAGE.template.md`: the JD identity and version, official
link, verified posting facts, fit scorecard, labelled employer background,
reviews, the documents themselves with versions, the QA log, the approval
record, the answer set and the submission checkpoint.
