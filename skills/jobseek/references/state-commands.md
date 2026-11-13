# State helper commands

Use `scripts/jobseek_state.py` from the `jobseek` skill directory with the host's available Python 3 runtime. It requires only the standard library. Resolve all paths for the selected installation and data workspace; do not hardcode another user's paths.

```text
python jobseek_state.py --workspace WORKSPACE --profile PROFILE_ID init --display-name NAME
python jobseek_state.py --workspace WORKSPACE --profile PROFILE_ID show
python jobseek_state.py --workspace WORKSPACE --profile PROFILE_ID validate
python jobseek_state.py --workspace WORKSPACE --profile PROFILE_ID check-approval --application APP_ID
python jobseek_state.py --workspace WORKSPACE --profile PROFILE_ID change OPERATION --input PAYLOAD.json --expected-revision N
```

Read `show` before changing state. Use its exact `revision` as `N`. A revision mismatch means reload and reconcile; never force an overwrite. `--input -` reads JSON from stdin, which avoids shell-escaping user text. A successful change returns only profile ID, revision, and operation. `show` contains personal information; avoid exposing it unnecessarily in tool logs.

Python interface:

```python
from jobseek_state import JobseekStore

store = JobseekStore(workspace, profile_id)
state = store.load()
updated = store.change("facts", {"records": reviewed_records}, state["revision"])
result = store.check_approval(application_id)
```

The helper cannot independently authenticate user statements or approvals. Supply actual user references; never manufacture them to satisfy validation.

## Operations and payloads

| Operation | Required payload | Result |
|---|---|---|
| `source` | `id`, `profile_id`, `kind: document`, `path` to original local file; or kind `web`/`user` plus `reference` | Immutable source registration; local file copied into profile |
| `fact` | Complete fact object from [records](records.md) | Insert or replace one fact, preserving earlier state in history |
| `facts` | `records: [complete fact objects]` | Validate the entire batch and commit one revision |
| `batch-facts` | `facts: [complete fact objects]` | Alias for the same batch behavior |
| `job` | `id`, `profile_id`, `employer`, `title`, `canonical_url`, `jd_text`, `requirements` | Insert/update job; additional research fields are preserved |
| `preferences` | `profile_id`, `values: {...}`, `user_reference` | Merge supplied preferences |
| `answer` | `id`, `profile_id`, `question`, `text`, `fact_ids`, `scope`, `status`; `application_id` for application scope; `approval_reference` for approved bank answers | Insert/update versioned answer |
| `application` | `id`, `profile_id`, `job_id`, `selection_reference` | Create application and its document directory with `drafting` status |
| `materials` | See handoff below | Register a new immutable document/answer version; status becomes `awaiting_review` |
| `approve` | `application_id`, `material_id`, `user_reference` | Bind actual applicant approval to current checked material version |
| `revoke-approval` | `application_id`, `material_id`, `user_reference`, `reason` | Withdraw approval without deleting the material or underlying facts |
| `status` | `application_id`, `status`; optional `checkpoint`, `evidence` | Record progress/outcome, subject to approval/submission checks |
| `feedback` | `id`, `profile_id`, `kind`, `text`, `user_reference`, `scope`; `application_id` for application scope; `generalize_explicitly: true` for profile scope | Store scoped feedback; does not rewrite facts |
| `search-run` | `id`, `profile_id`, `sources_checked: [...]`, plus actual scope/results/continuation fields | Append search history |
| `reconcile-dossier` | `user_reference`, `resolution`, optional `facts: [...]` | Preserve manual dossier edits and regenerate after review |

Every record insert/update supplies its own `profile_id`, matching the CLI-selected profile. Fact/job/answer updates replace that record rather than merging individual fields: load the old record, apply the intended changes, and pass the complete result. Helper-managed revision and timestamp fields are regenerated.

## Document generation handoff

Create the application before generating documents. Put application outputs inside its directory. When generation and actual visual review are complete, use the build manifest to assemble:

```json
{
  "application_id": "application-001",
  "id": "materials-v1",
  "documents": [
    {"path": "applications/application-001/resume.docx", "expected_sha256": "DOCX_HASH_FROM_BUILD"},
    {"path": "applications/application-001/resume.pdf", "expected_sha256": "PDF_HASH_FROM_BUILD"}
  ],
  "fact_ids": ["employment-001", "achievement-001"],
  "expected_fact_revisions": {"employment-001": 1, "achievement-001": 2},
  "expected_fact_digests": {"employment-001": "DIGEST_FROM_BUILD", "achievement-001": "DIGEST_FROM_BUILD"},
  "expected_job_digest": "JOB_DIGEST_FROM_BUILD",
  "answer_ids": [],
  "qa": {
    "rendered_pages_reviewed": true,
    "text_checked": true,
    "docx_pdf_consistent": true,
    "reference": "Actual page inspection and extraction check reference"
  }
}
```

The example's digest labels must be replaced with exact manifest values. All expected digests and revisions are required. Take `expected_fact_revisions` from manifest `fact_revisions`, `expected_fact_digests` from `fact_digests`, and `expected_job_digest` from `job_digest`. List all document fact IDs. The helper separately adds facts referenced by selected answers. Expected fact revision/digest maps describe document facts, not newly selected answer-only facts.

Convert manifest file paths to paths relative to this profile. Set each `expected_sha256` from the manifest's corresponding file hash. The helper verifies the actual current files still match the generated/reviewed versions and requires both PDF and DOCX. Do not move files outside the application directory or register another application's output. A new version gets a new ID and should use new filenames so earlier approved files remain intact.

Set quality flags from actual results only. Text consistency maps to `text_checked` and `docx_pdf_consistent`; a passed visual review covering all pages maps to `rendered_pages_reviewed`. Draft registration with false/missing QA is allowed, but approval is blocked. Finish QA and register a new material version before asking for approval.

Only after the applicant reviews the JD, files, and exact answers, record:

```json
{"application_id":"application-001","material_id":"materials-v1","user_reference":"Applicant's actual approval of this job and material version"}
```

`check-approval` returns `approved`, reasons, material ID, and the stored approval. A nonapproved result exits with code 2. Run it immediately before form work and on every resumption. `validate` also reports approval results but a draft application is not by itself an invalid profile.

If the applicant rejects the current package or withdraws prior approval, use `revoke-approval` with the material ID, actual user reference, and reason. Changing a tracker label alone is not a substitute for revocation. Revocation blocks the old approval even when all files remain unchanged. A later explicit `approve` operation can restore approval after review. Ordinary wording feedback does not erase facts; apply the feedback and revoke the current package when the applicant's decision requires it.

## Page checkpoint and submission

After filling and checking one visible page:

```json
{
  "application_id": "application-001",
  "status": "awaiting_applicant_action",
  "checkpoint": {
    "page_url": "https://employer.example/application",
    "page_label": "Work experience",
    "filled_fields": ["employer", "title", "start_date"],
    "unresolved_fields": [],
    "user_action_required": "Review this page and click Next"
  }
}
```

Do not click Next, Proceed, Continue, Submit, or use keyboard shortcuts to trigger those actions. After the user advances, inspect the new page and recheck approval before filling. Do not store password/verification-code contents in checkpoints.

An application becomes submitted only with an actual observation or applicant report:

```json
{"application_id":"application-001","status":"submitted","evidence":{"kind":"user_report","reference":"Applicant reported submission and supplied the confirmation reference"}}
```

For a directly inspected confirmation use `kind: observed_confirmation` with the real confirmation page/receipt reference. Completing fields, attaching files, an unanswered handoff, or a browser interruption is not evidence of submission.

## Reconciliation

If the dossier changed manually, inspect it before taking further action. Use `resolution: import_reviewed_changes` with complete corrected facts and the applicant's actual confirmation, or `resolution: reviewed_no_fact_changes` after reviewing and deciding no record changes are needed. The helper preserves the edited dossier first. Do not use reconciliation merely to silence a warning without reading the changes.
