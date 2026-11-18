# Dashboard reference implementation (sanitised)

This is the sanitised Muse Space reference implementation of the job-search
dashboard: a TypeScript Space with a React client (`client/`), server actions
(`server/src/`), and Drizzle migrations (`drizzle/`). It is a reference to
build from, not a live app — the live dashboard is maintained separately and
is not part of this kit.

## Platform note

`package.json` depends on `@hatch/space-sdk` via a `file:` path. That package
is provided by the Muse platform and the path will not resolve outside
Muse — that is expected. Inside a Muse Space the platform supplies it at
build time.

## Seed data

The seed data in `server/src/actions.ts` is the fictional sample applicant
(Dr. Sam Lee, cell biologist, Boston, MA) and matches the sample data kit in
`examples/sample-applicant/`: four openings (industry, academic, contractor,
and one screened out), one tailored package with its document index, a master
CV entry, two blockers (one open, one resolved), two answer-bank entries, and
a ledger seed demonstrating every fact status (user-attested, confirmed,
pending, conflicted, retired).

No real applicant's data appears anywhere in this tree.

## How a builder adapts it

- A builder replaces the `APPLICANT_PROFILE` constants block and the seed
  constants in `server/src/actions.ts` via seed/sync from the applicant's
  real data kit (their tracker and ledger). Spawned-task prompts read
  constraints — the never-claim list, eligibility rules, and the format
  standard path — from `APPLICANT_PROFILE`, never from hard-coded strings.
- `server/src/privileged.ts` reads files only under the applicant's
  job-search data folder (`job-search/` — the folder name is configurable
  per applicant, and the validation prefix must match it). It rejects
  absolute paths and `..` traversal.
- `server/src/schema.ts` is generic and needs no per-applicant changes.
