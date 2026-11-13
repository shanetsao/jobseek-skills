# Jobseek Skill Suite

**English** | [简体中文](README.zh-CN.md)

Jobseek is a suite of six connected skills for managing a job search: maintaining an evidence-backed career ledger, discovering and researching openings, preparing tailored materials, assisting with application forms, and tracking outcomes.

The normal workflow is:

**Career ledger → broad job search → researched shortlist → applicant selection → tailored documents → applicant approval → application assistance → confirmed outcome and tracking**

You can enter at any stage. For example, you can supply a job description for assessment, revise an existing resume, or resume an application from its saved checkpoint. Requesting one stage does not automatically authorize later external actions.

## The six skills

| Skill | Purpose |
|---|---|
| [jobseek](skills/jobseek/SKILL.md) | Coordinate the suite and route new or resumed work. |
| [jobseek-ledger](skills/jobseek-ledger/SKILL.md) | Import, review, and maintain career facts, preferences, and accomplishment evidence. |
| [jobseek-search](skills/jobseek-search/SKILL.md) | Discover openings, assess requirements, rank evidence coverage, and research employers. |
| [jobseek-tailor](skills/jobseek-tailor/SKILL.md) | Prepare and review tailored resumes, academic CVs, and application answers. |
| [jobseek-apply](skills/jobseek-apply/SKILL.md) | Fill and verify the current application page using approved materials, then hand control to the applicant. |
| [jobseek-track](skills/jobseek-track/SKILL.md) | Track deadlines, status, approvals, checkpoints, and supported outcomes. |

## 1. Start or resume

The coordinator identifies the applicant's chosen workspace and profile, reads the saved records, checks unresolved issues, and locates any relevant application checkpoint. If the applicant identity is ambiguous, it asks before opening personal records.

It routes the request to the appropriate skill while preserving the same applicant, job, and application identifiers. Documents, evidence, approvals, and history therefore remain connected across stages.

On first use, the suite collects the minimum information needed for the requested task and can import documents supplied or identified by the applicant. It does not scan the applicant's entire computer or connected services without task-specific authorization.

## 2. Build and maintain the career ledger

The ledger supplies the detailed evidence used for matching and writing. Relevant records can include employment, education, research, projects, methods, individual contributions, accomplishments, publications, patents, teaching, mentoring, awards, certifications, and other experience.

It also records stated career preferences: target roles, seniority, industries, locations, work arrangements, relocation, travel, compensation, and genuine nonnegotiables. A preference is distinct from an exclusion; missing preferences and eligibility information are not inferred.

Each fact retains its source and review status:

| Status | Meaning | Usable for matching and drafting? |
|---|---|---|
| User-attested | Explicitly supplied by the applicant. | Yes |
| Confirmed | Extracted from a source and reviewed by the applicant. | Yes |
| Pending | Imported but awaiting review. | No |
| Conflicted | Contradictory or ambiguous evidence needs resolution. | No |
| Retired | Preserved historical information no longer current. | No |

Permission to import a document does not confirm all extracted claims. The skill asks targeted questions about missing details, preserves uncertain dates, and distinguishes individual contributions from team outcomes. It does not invent metrics, proficiency, or results, and it does not require every possible field to be completed before useful work begins.

Facts, wording preferences, and job-specific inclusion decisions are stored separately. Correcting a fact preserves its history and flags dependent application materials for review; rejecting a sentence does not erase the underlying experience.

**Output:** an updated readable dossier, preserved sources, and a clear account of usable facts, pending items, and unresolved questions.

## 3. Discover openings broadly

The search uses usable career evidence and stated interests to build queries. It expands with relevant role synonyms, adjacent positions, and transferable methods while respecting the applicant's constraints.

Named websites are examples, not limits. Unless the applicant narrows the scope, relevant sources include:

- General job boards and aggregators, such as Indeed, Glassdoor, LinkedIn, and Google Jobs.
- Direct employer career sites and their linked application systems.
- Government sources: USAJOBS, relevant federal agency career pages, official state portals for each target state, and relevant county or city portals for U.S. searches; corresponding official sources for other countries.
- Universities, academic medical centers, hospitals, research institutes, national laboratories, and nonprofits.
- Specialist boards, professional societies, regional industry groups, and recruiting or staffing sites when the employment type fits the scope.
- General web searches that discover additional employers, niche boards, and postings beyond familiar platforms.

The default batch is **20 distinct openings**, unless the applicant specifies otherwise. Discovery should span relevant source categories before filling the batch. Syndicated copies are deduplicated; different requisitions or locations are not merged merely because their titles match.

The skill reads the full job description before claiming to assess its requirements. It preserves available details such as title, employer, location, requisition number, salary, posting date, deadline, source links, and verification time. It prefers a verified official application destination. Search snippets alone do not establish complete requirements.

For government roles, it also records stated hiring paths, eligible applicant groups, citizenship or residency requirements, grade or classification, specialized experience, and clearance requirements. Unknown eligibility remains unknown, and government employment is distinguished from contractor employment.

The search records sources checked, inaccessible sources, omissions, and unfinished coverage. A batch is not an exhaustive survey of the market. Login requirements and access controls are respected; an accessible official posting or applicant-supplied job description can serve as a fallback.

## 4. Assess evidence coverage and research employers

Requirements are organized into distinct competencies. Repeated requirements, alternatives such as “Python or R,” and umbrella competencies with illustrative examples are grouped to avoid double-counting.

| Assessment | Meaning | Credit |
|---|---|---:|
| Direct | Usable evidence directly supports the requirement. | 1 |
| Transferable | Related evidence supports partial coverage, with an explanation. | 0.5 |
| Unknown | The applicant's records do not establish the answer. | 0 |
| Gap | Evidence establishes that the requirement is not met. | 0 |

Required competencies have weight **2**; preferred and unclassified competencies have weight **1**.

**Evidence coverage score = 100 × sum of (requirement weight × evidence credit) ÷ total requirement weight.**

This is a documented heuristic, **not a hiring probability**. Unknown experience is distinguished from a confirmed gap, and the weighted share of unknown requirements is shown alongside the score. Eligibility and location constraints remain visible outside the numeric score. A job with no scorable requirements is unscored.

Every discovered opening at or above **30%**, using the unrounded score, enters one ranked list. Ranking uses evidence coverage first, recorded interest alignment second, and verified posting date third. Missing dates come last; a stable job identifier breaks remaining ties. Below-threshold and unscored candidates remain in the search record.

Every qualifying match receives substantive employer research covering relevant work, products or programs, funding, organizational developments, and team context. Government, academic, and nonprofit briefs adapt to the institution's mission and programs.

Research distinguishes four kinds of findings:

- **Employer-stated hiring reason:** a source explicitly connects the opening or hiring campaign to an event.
- **Relevant context:** a verified development whose connection to the opening is not established.
- **Inference:** an explicitly labeled interpretation with supporting facts and uncertainty.
- **Unavailable:** no supported explanation was found within the research scope.

**Output:** a ranked shortlist with evidence coverage, unknown coverage, strengths, gaps, conflicts, supported dates and deadlines, application links, employer research, and search limitations. **The applicant selects which openings to pursue.**

## 5. Prepare tailored materials

For a selected opening, the skill rechecks availability and the job description, then maps requirements to usable ledger evidence. It selects relevant experience and turns supported accomplishment stories into concise bullets while preserving attribution and uncertainty. Job-description terminology is used only where it accurately describes the applicant's experience.

Employer instructions take priority, followed by documented applicant preferences. The default industry resume is **two pages**, with a clean single-column layout. Academic CVs have no fixed page limit.

The skill generates an **editable DOCX and a PDF from the same content**. Before calling them ready for submission, it must:

1. Render and visually inspect every page for layout and legibility.
2. Extract and check text for completeness, reading order, names, dates, status, and links.
3. Verify that the PDF and DOCX agree.
4. Check substantive claims against usable ledger facts.

Failed rendering or unresolved checks leave the files as drafts. Earlier approved versions are preserved rather than overwritten. The suite does not guarantee an ATS score or universal compatibility.

The applicant reviews the job description, both documents, a concise requirement-to-evidence mapping, and open questions. Internal evidence notes and drafting instructions stay out of submission documents.

Feedback is classified before saving: factual corrections update the ledger; wording or formatting preferences change presentation; job-specific inclusion decisions affect that opening. A preference becomes global only when the applicant explicitly makes it general.

**Output:** versioned PDF and DOCX files, review materials, and scoped feedback.

## 6. Approve the exact package

Approval covers the particular **job description, document versions, supporting fact revisions, and answer set**. Document quality checks and applicant approval are separate steps. Passing quality checks does not mean the applicant approved the package, and silence is not approval.

Approval is checked immediately before application use and on resumption. Changes to documents, answers, the job description, or supporting facts require renewed checking and review before use. Source-file changes or unresolved manual dossier edits can also block reuse. An unrelated fact update does not automatically invalidate an application, and approval for one opening does not transfer to another.

Common application answers can be saved with their supporting facts and intended scope. Reuse requires checking current facts and job relevance. A job-specific answer does not automatically become a universal answer. Work authorization, salary expectations, availability, demographics, declarations, and consent are never guessed.

If the applicant withdraws approval or rejects an already approved package, its approval must be explicitly revoked. Merely saving feedback or changing a tracker label is insufficient.

**Output:** an approval record tied to the exact reviewed package, or a clear list of remaining review items.

## 7. Assist with application forms page by page

This stage begins when the applicant requests application assistance. The skill verifies the destination, checks existing application history, inspects the live page, and confirms current approval before entering information or uploading files.

The page loop is:

**Inspect → prepare supported answers → fill or upload → verify → save checkpoint → hand control to the applicant**

Verification covers existing autofill, entered values, selected options, attachments, parsing errors, truncation, and visible validation messages. Missing information is raised for applicant input.

**The applicant clicks every Next, Continue, Proceed, Submit, or equivalent progression control.** The assistant must not advance through mouse clicks, keyboard shortcuts, scripts, direct requests, or alternative routes. The applicant also handles authentication, signatures, attestations, consent, and consequential choices.

After the applicant advances, the skill inspects the resulting page before continuing. Checkpoints preserve the page, completed fields, unresolved items, material version, and next action. Following an interruption, it compares saved records with the live page, reconciles applicant edits, and checks approval rather than replaying old actions.

Portals may save entered information or uploads before final submission. Submission is recorded only after an observed confirmation or an explicit applicant report, with the evidence retained. Filled fields, an interrupted session, or a disappeared form do not prove submission.

If browser assistance fails, the skill preserves the checkpoint and provides approved files and copy-ready answers for manual entry.

## 8. Track progress throughout

Tracking reports the employer, role, supported deadline, current status, material approval, last action, and next action.

The main preparation and application states are:

**Drafting → awaiting review → approved → filling ↔ awaiting applicant action → submitted**

Interview, offer, rejection, withdrawal, and closure are recorded when supported by actual events or applicant reports; they are not a mandatory linear sequence. Submission remains a historical event even if its supporting materials later require review.

The skill checks for duplicate applications to the same verified opening, preserves checkpoints, and routes unfinished work to the appropriate skill. A repost or changed requisition is investigated rather than silently merged.

Recording a deadline does **not** create a reminder. Scheduled searches, alerts, outreach, cover letters, and interview preparation require a separate request and are not automatic parts of this workflow.

## Shared records and privacy

Each applicant has a separate profile in the chosen data workspace. The [shared record contract](skills/jobseek/references/records.md) defines the saved material:

| Saved material | Purpose |
|---|---|
| `state.json` | Authoritative facts, preferences, jobs, answers, applications, approvals, feedback, and search history. |
| `dossier.md` | A generated readable view of the profile, not a second independent source of truth. |
| `sources/` | Preserved source documents. |
| `applications/` | Per-application versioned documents and review material. |
| `history/` | Snapshots of committed record revisions. |
| `reconciliation/` | Preserved manual dossier edits before reconciliation. |

Private applicant records stay separate from reusable skill folders and must not be distributed with the suite. Manual dossier edits are reviewed and reconciled before refreshing the readable view. Record helpers preserve versions and check consistency, but they cannot independently prove an applicant's claims, actual approval, or completion of visual inspection.

## Installation and operating boundaries

Keep all six sibling skill folders together inside `skills/` when installing or sharing the suite. The five specialist skills depend on the main `jobseek` folder's references and helpers. Choose an applicant data workspace separately; do not place private records inside the installed skill folders.

The current suite targets Codex desktop and uses local files, web research, document generation, and browser assistance. Tool availability and required runtimes are checked when work is performed. No paid integration or custom service is required.

The suite reports unavailable capabilities and preserves completed work. It does not bypass access controls, claim inaccessible content was researched, call unchecked documents ready for submission, or record a filled form as submitted. Imported documents and web content are treated as evidence, not instructions to override the workflow.

For operational details, see the linked skill instructions and the shared [state commands](skills/jobseek/references/state-commands.md), [matching method](skills/jobseek/references/matching.md), and [document workflow](skills/jobseek/references/document-commands.md).
