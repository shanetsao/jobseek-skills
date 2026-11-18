# Search: find, verify, and research openings

A search batch sweeps the sources, deduplicates against the kit,
verifies each posting live, researches the employer **at search time**,
and records everything in `openings.json`. Nothing enters the kit from
a mirror alone.

## Sources

Employer career sites first, then job boards, USAJOBS (government),
university/institute postings, and specialist boards relevant to the
applicant's field. Record per-batch coverage: which sources were
swept, how many postings seen, how many new, how many duplicates, how
many already in the kit. A batch that silently covers half its sources
is worse than a smaller honest one.

## Live-JD verification

Every opening's job description is verified against the **official
posting** before it is recorded or scored: title, employer, location,
requisition ID, deadline, salary band, and the full requirements text.
Mirrors and aggregators conflict with official pages often enough that
the official page always governs; when only a mirror exists, record
the opening as unverified and say so — do not score it as if verified.
A posting not found on the employer's official board is held, not
recorded as live.

## Background + reviews at search time

For **every** opening found — not only ones that later get a package —
record in the same batch:

- **Employer and position background**: what the employer does, the
  team/unit, funding or programme context where public, and anything
  bearing on fit or eligibility.
- **Employer reviews**: rating and review count from a review source,
  with the source named. Label every statement as what it is:
  - **stated reason** — the source says this, in its own terms;
  - **context** — verifiable background fact;
  - **inference** — your reading, marked as inference;
  - **unavailable** — the information could not be obtained; say that
    instead of filling the gap.

## Academic and lab-based positions

For academic/lab openings, research the lab itself as well: its
publications and conference abstracts from the **past five years** and
its lab website. Summarise research goals and potential directions,
keeping **stated** directions (the lab's own words) distinct from
**inferred** ones (your reading of the publication trajectory).

## Recording the opening

Each new opening gets: slug (employer + short title), employer, title,
track, role family, location, source URL, requisition ID when the
posting has one, deadline (official, `YYYY-MM-DD`), salary band as
stated, status `Researched` (or the fitting DATA-MODEL status), the
why-label, eligibility flags with their sources, the background and
reviews above, and gaps as far as known. Run the matching helper's
`duplicates` check before adding; candidate duplicates are reviewed,
never auto-merged.

Per-competency `assessments` (see `matching.md`) are recorded when the
opening is scored — at search time for shortlisted openings, or later
in the tailor workflow. An opening without assessments is unscored,
not 0%.

## Flags and holds

- Eligibility flags (work-authorisation bars, clearance, licence,
  location) are recorded with the governing source and marked as
  **flags to verify**, not verdicts — unless the source is definitive.
- Closed or past-deadline postings are marked `Closed` with the date
  observed; they leave the active board but stay in the record.
- The weekly refresh re-verifies deadlines and statuses, flags
  anything closing within 21 days, and re-runs the batch accounting.

## What search never does

It never invents a posting, a deadline, a salary, or a review; never
records a score it did not compute or receive from the scoring
workflow; and never applies, drafts, or contacts an employer — search
output is a researched, verified list, nothing more.
