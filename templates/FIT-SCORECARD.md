# Fit Scorecard — evidence coverage (primary) and /100 (secondary)

Use for every opening, in every package. Score only from the verified
official JD and the ledger, using only usable ledger facts (user-attested
or confirmed). A stated disqualifier in the JD (for example citizenship,
clearance, a sponsorship bar, or a hard requirement the applicant lacks)
screens the role **out** regardless of any total.

## Primary score — evidence coverage

The headline fit number for every opening is the evidence-coverage score.
The /100 scorecard below is secondary context, reported alongside it, not
blended in.

- Group the JD's requirements into distinct competencies. Alternatives such
  as "Python or R" count once; no double-counting.
- Credit per competency:
  - **Direct = 1** — usable ledger evidence directly supports it.
  - **Transferable = 0.5** — related evidence, with the transfer explained.
  - **Unknown = 0** — the records do not establish it.
  - **Gap = 0** — the evidence establishes it is not met.
- Weights: required competencies ×2; preferred / unclassified ×1.
- **Coverage = 100 × Σ(weight × credit) ÷ Σ(weight).**
- Report the weighted share of **Unknown** alongside the score.
- A job with no scorable requirements is unscored.
- The score is evidence coverage, **not a hiring probability**.
- Eligibility, location, start date and deadline are **flags** shown next
  to the score, never inside it.
- Ranking: coverage first, the applicant's recorded interest second,
  verified posting date third.
- Threshold: **≥30%** (unrounded) enters the ranked shortlist; the applicant
  selects which openings to pursue.

## Secondary score — /100 scorecard

| # | Criterion | Max | What earns the points |
|---|---|---|---|
| 1 | Must-have requirements coverage | 35 | Share of the JD's required qualifications matched in the ledger, weighted by how central each is. Missing a headline requirement costs more than missing a minor one. |
| 2 | Desired / preferred skills coverage | 15 | Share of "desired / preferred" items matched. Named gaps score 0 for that item — never assumed. |
| 3 | Domain / program alignment | 15 | How directly the applicant's work maps to the named program, pipeline, lab direction or contract mission — a specific program match scores high; same-field-only scores mid. |
| 4 | Level & experience match | 10 | Title seniority, years, and leadership scope against the applicant's record. Formal direct-report management gaps deduct here. |
| 5 | Evidence strength | 10 | Publications, citations, and — decisively — quantified results available in the ledger to back STAR bullets. Unquantified bullets cap this criterion. |
| 6 | Eligibility & logistics (context only) | 10 | Location / on-site fit, authorisation and clearance risk, start-date fit. Unverified risks deduct; verified disqualifiers screen out (above). In the primary method these are flags, not score inputs — this row is retained only as secondary context in the /100 view. |
| 7 | Deadline & actionability | 5 | Posting verified live on the official site, with workable time to apply. Unverified or stale postings score low until re-checked. |
| | **Total** | **100** | |

## Decision bands (threshold: apply if ≥30)

- **70–100 — Strong apply.** Tailor first.
- **50–69 — Apply.** Note the top gaps explicitly in the package.
- **30–49 — Apply if strategic** (program match, location, or career
  value) — passes the threshold, but say why it is worth it.
- **<30 — Skip,** unless the applicant overrides.
- **Screened out** — stated disqualifier, stale/closed posting, or unnamed
  employer: record the reason in the tracker, do not tailor.

## Worked example (fictional)

Dr. Sam Lee is a fictional postdoctoral researcher in cell biology applying
to a fictional opening: **Scientist, Assay Development** at a fictional
employer. The JD lists these competencies:

| Competency | Class | Ledger evidence | Credit | Weight | Weighted |
|---|---|---|---|---|---|
| Ph.D. in a life-science field | Required | Ph.D. confirmed in ledger | Direct = 1 | 2 | 2.0 |
| Flow cytometry panel design | Required | Ran 12-colour panels, attested with quantified results | Direct = 1 | 2 | 2.0 |
| Primary cell culture | Required | Related mammalian cell-line work only | Transferable = 0.5 | 2 | 1.0 |
| Python for data analysis | Required | No usable ledger evidence either way | Unknown = 0 | 2 | 0 |
| Regulatory submission writing | Preferred | Ledger establishes no such experience | Gap = 0 | 1 | 0 |
| Mentoring junior researchers | Preferred | Mentored two rotation students, attested | Direct = 1 | 1 | 1.0 |

- Σ(weight × credit) = 6.0; Σ(weight) = 10.
- **Coverage = 100 × 6.0 ÷ 10 = 60%.**
- **Unknown share** = weighted Unknown ÷ total weight = 2 ÷ 10 = **20%**.
- Flags (outside the score): on-site role in a preferred region; closing
  date verified on the official posting; earliest start date to discuss.
- Decision: 60% is in the **Apply** band. The package names the Python
  unknown and the regulatory-writing gap explicitly; neither is assumed or
  filled in.
