# Shared applicant records

Read this contract before any jobseek workflow reads or changes applicant state. Use the companion [state commands](state-commands.md) rather than editing canonical JSON directly.

## Storage and ownership

The applicant chooses a data workspace. Each profile is stored separately at `WORKSPACE/profiles/PROFILE_ID/`:

- `state.json`: authoritative records, schema version 1.
- `dossier.md`: generated readable view, including complete nested fact data and provenance.
- `sources/`: preserved source files, copied without modifying originals.
- `applications/APPLICATION_ID/`: that application's PDF, DOCX, manifests, and review material.
- `history/revision-NNNNNN.json`: immutable snapshots of each committed state revision.
- `reconciliation/`: preserved manual dossier edits before explicit reconciliation.

Each call supplies both workspace and profile ID. There is no global active applicant. Record IDs are unique within a profile; each record also carries the same `profile_id`. Never merge profiles, reuse another applicant's answers, or ship profile data with the reusable skills. Paths stored in records are profile-relative; the helper rejects traversal and symlinks below the workspace.

`state.json` has `schema_version`, `profile_id`, `revision`, `display_name`, `updated_at`, `dossier_sha256`, maps named `facts`, `jobs`, `applications`, `answers`, `sources`, a `preferences` object, and lists named `feedback`, `search_runs`, and `preference_history` (added when needed to older profiles). It is a local record format, not a public network API. Helper changes require the expected current revision and use a profile write lock and atomic file replacement.

## Facts and evidence

Every fact has:

```json
{
  "id": "research-001",
  "profile_id": "example-applicant",
  "category": "research",
  "data": {
    "project": "Applicant-supplied project name",
    "dates": {"start": "2024", "end": null},
    "context": "Recorded context",
    "responsibility": "Applicant's responsibility",
    "individual_contribution": "Actual individual contribution",
    "actions": ["Supported action"],
    "outcomes": [],
    "methods": [],
    "metrics": [],
    "collaborators": [],
    "disclosure": "review_before_application"
  },
  "status": "pending",
  "provenance": [{"kind": "document", "reference": "source-cv-001", "locator": "paragraph 24"}]
}
```

The helper adds `revision`, `created_at`, and `updated_at`. Preserve the precision and uncertainty of source dates. `data` is flexible, so the record can retain detailed descriptions, contribution boundaries, methods, outcomes, exact citations, and status without forcing all categories into a project template.

Use categories such as employment, research, project, education, leadership, teaching, mentoring, service, technical_skill, award, scholarship, grant, publication, patent, presentation, certificate, license, and contact. Match existing categories when extending a profile. Skills should preserve the exact source term, level of experience when stated, context, and last-used date when known. Publication and patent records retain actual status; do not convert a preprint into a published article or an application into a granted patent.

Statuses:

| Status | Meaning | Usable for scoring and drafting |
|---|---|---|
| `user_attested` | Explicit applicant statement, with user provenance | Yes |
| `confirmed` | Imported claim reviewed by the applicant | Yes |
| `pending` | Extracted/imported, awaiting review | No |
| `conflicted` | Contradictory or ambiguous evidence needs resolution | No |
| `retired` | Preserved historical record no longer current | No |

`user_attested` requires provenance `{kind: "user", reference: "specific applicant statement or chat reference"}`. `confirmed` requires `review: {kind: "user_confirmation", reference: "specific review decision"}`. User approval to import a file is not confirmation of all extracted claims. A user correction is a new revision; history preserves the earlier record. Detect semantic contradictions during review and record them as `conflicted`; the helper cannot determine whether arbitrary prose contradicts another claim.

Document provenance references a registered source ID or an HTTP(S) source URL; add an exact locator when available. Source registration copies local documents into the profile and stores their hash, original path, and registration time. Registered sources are immutable: changed documents receive new source IDs.

Store facts separately from presentation preferences and inclusion decisions. Never infer a factual correction from rejection of wording. Never create outcomes or metrics to complete a STAR story. Missing details remain absent and become targeted questions.

## Preferences, answers, and feedback

Preferences include target roles, career interests, seniority, industries, locations, relocation, remote/hybrid/on-site arrangements, compensation preferences, and explicit nonnegotiables. Record only preferences supplied by the applicant; do not infer them from protected traits or source-document metadata. Each preferences update preserves the supplied values, timestamp, and explicit user reference in `preference_history`.

Answers have `id`, `profile_id`, `question`, `text`, `fact_ids`, `scope` (`profile` or `application`), `application_id` when application-scoped, and `status` (`draft` or `approved`). Reusable approved answers also need `approval_reference`. A particular application can approve its exact answer set without promoting those answers to globally approved wording. Work authorization, demographics, salary expectations, declarations, and consent require explicit applicant input; the answer bank never guesses them.

Feedback has `kind` (`fact_correction`, `wording`, `formatting`, or `job_decision`), `text`, `user_reference`, and `scope`. Default to application scope with its application ID. Profile-wide feedback requires `generalize_explicitly: true` and a reference showing that the applicant expressed a general preference. Recording feedback does not change facts automatically; apply explicit corrections separately.

## Jobs and search runs

Jobs require `id`, `profile_id`, `employer`, `title`, `canonical_url` (or null when unavailable), `jd_text`, and `requirements`. Also retain source URLs, source labels, requisition ID when present, location, stated posting/update date, retrieval/verification time, deadline, current availability, constraint flags, company research with dated citations, and interest alignment when established.

Each normalized requirement uses `id`, `text`, optional `group_id`, `importance` (`required`, `preferred`, `unclassified`), `assessment` (`direct`, `transferable`, `unknown`, `gap`), `evidence_fact_ids`, and `rationale`. Preserve exact JD wording alongside normalization. Count OR alternatives as one group; do not double-count umbrella requirements and examples. Matching and research details belong to the search skill and matching helper.

Search runs record an ID, profile ID, `sources_checked` (including inaccessible sources), query/scope details, candidate counts, default batch size 20 unless overridden, qualifying job IDs, incomplete work, and a continuation pointer when needed. A continuation is a new run record linked to the earlier run. Do not imply that one batch covers the whole market.

## Applications, material versions, and approval

An application references an existing job and the applicant's selection. It holds status, events, checkpoint, immutable material versions, approval records, and any `review_required` reasons.

Each material version freezes:

- The job description, requirement set, employer/title, and application destination digest.
- PDF and DOCX file paths and SHA-256 hashes.
- All supporting fact revisions and fact digests, including facts backing application answers.
- The exact selected answer records, their revisions, and digests.
- Actual document quality checks and their reference.

Material registration requires expected fact revisions, fact digests, file hashes, and the job digest from document generation. This prevents old document content from being registered against newly corrected facts and prevents changed files from reusing earlier quality checks. The digest method is SHA-256 of UTF-8 JSON with sorted keys, indent 2, `ensure_ascii=False`, and one trailing newline. The job digest includes only `id`, `profile_id`, `employer`, `title`, `canonical_url`, `jd_text`, and `requirements`.

Approval requires the current material ID, a specific applicant approval reference, successful rendered-page review, text checking, and PDF/DOCX consistency checking. The helper stores approval against the immutable material digest. It cannot verify that someone actually inspected pages or gave approval; the invoking skill must supply truthful evidence of those actions.

Applicant rejection or withdrawal of an approved package uses `revoke-approval`. Record the material ID, actual user reference, and reason; the revocation blocks reuse without deleting facts, documents, or prior approval history. A subsequent explicit approval after review can restore use. Merely changing a tracker status or storing wording feedback is not an approval revocation.

Before uploading documents, filling forms, or resuming, call `check-approval`. Changed document files, job content, supporting facts, answer contents, source files, or unresolved dossier edits block reuse. An unrelated fact update does not invalidate an application. Submitted applications retain their historical status, while affected materials are flagged for review.

States are `drafting`, `awaiting_review`, `approved`, `filling`, `awaiting_applicant_action`, `submitted`, `interview`, `offer`, `rejected`, `withdrawn`, and `closed`. Only the approval operation sets `approved`. `filling` and `awaiting_applicant_action` require current approval. `submitted` requires evidence with kind `observed_confirmation` or `user_report` and a specific reference.

Checkpoints preserve current URL/page label, filled field names, unresolved fields, and the user action needed. Avoid recording credentials or unnecessary sensitive values. The browser skill must leave every progression/submission action, signatures, declarations, and consent to the applicant. The helper rejects recorded assistant progression actions, but it is not a browser permission system.

## Manual edits and recovery

Do not edit canonical state directly. The helper detects manually edited or missing `dossier.md`, stops updates and application approval checks, and requires explicit reconciliation. Review the changes, preserve the edited dossier, apply reviewed fact changes, then regenerate the readable view. It never silently overwrites an edited dossier.

Interrupted writes may leave a source copy or an unused application directory, or a dossier/state mismatch. Preserve those files and inspect the latest state and history; do not delete history or blindly decrement revisions. Reconcile the dossier explicitly when needed. Stored history and source copies are local ordinary files, not an encrypted vault or protection against malicious local tampering.
