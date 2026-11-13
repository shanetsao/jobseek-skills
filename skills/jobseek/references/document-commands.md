# Document generation and verification

The helper renders supplied content. It does not decide which claims are true, write STAR outcomes, or guarantee that a linked fact supports every word. Perform that evidence audit before rendering.

## Input and dependencies

Resolve the bundled Python and Node runtimes with `load_workspace_dependencies`. Read the currently available documents and PDF skills. Find `render_docx.py` and `container_tools/mark_artifact_operation_started.mjs` in that documents skill. Do not hard-code a user's home directory or use their installed desktop LibreOffice. If the tools are unavailable, report the missing dependency rather than claiming a finished PDF.

The content JSON has `profile_id`, `job_id`, `kind` (`resume` or `academic_cv`), optional `paper` (`letter` default or `a4`), optional `max_pages`, `applicant`, and `sections`.

- `applicant.name` is a text object; `applicant.contact` is a list of text objects.
- Each section has a plain `title` and an `entries` list.
- Every text object requires `text` and a nonempty `fact_ids` list. Entries may set `type` to `paragraph` (default), `heading`, or `bullet`. Optional `url` supports HTTP, HTTPS, or mailto links.
- Each referenced fact must belong to the selected applicant, have a revision, and be `user_attested` or `confirmed`. The selected job must also belong to that applicant.
- Section headings are organizational labels, not a place to introduce unsupported applicant claims.

The defaults are Arial 11-point, black text, a single column, conventional paragraph/list formatting, and an industry page budget of two. Academic CVs have no default limit. Employer requirements and explicit applicant preferences control paper and page budget. For a different requested design, use the document skill directly and preserve the same review and approval requirements.

## Build

Use a new empty version directory inside the selected profile's `applications/APP_ID` directory. Invoke the script using the resolved bundled Python:

```text
jobseek_documents.py build --input CONTENT_JSON --state PROFILE_STATE_JSON --output-dir NEW_VERSION_DIRECTORY --renderer CURRENT_RENDER_DOCX_PY --node BUNDLED_NODE --marker CURRENT_DOCUMENT_MARKER_MJS
```

The helper marks the two-output authoring operation immediately before creation, produces DOCX, renders its PDF and page images through the bundled renderer, and checks intended text in reading order in both formats. It never overwrites a populated output directory. The manifest records document hashes, evidence revisions, page budget, text checks, and a **pending** visual review. A failed rendering or check is not a submission-ready result.

## Visual review

Open every `qa/page-N.png` at readable resolution. Check page breaks, clipping, spacing, legibility, links, and the intended text. Correct any issue in a new version and render again. Only after actual inspection:

```text
jobseek_documents.py review --manifest MANIFEST_JSON --pages 1,2 --reviewer REVIEWER_NAME --notes "Actual inspection findings"
```

Supply exactly the pages that exist, all of them. The command checks file/image hashes and rejects failed text or page-budget checks. Recording visual inspection is separate from applicant approval; it never sets application approval.

```text
jobseek_documents.py check --manifest MANIFEST_JSON
```

This checks the recorded artifact and page-image hashes. It does not re-inspect images, approve the content, or verify the facts against current state. The application state helper must still verify current fact revisions, selected answers, job, and artifact hashes.

## Manifest and application handoff

The manifest includes `schema_version`, `profile_id`, `job_id`, `kind`, `content_sha256`, `job_digest`, `fact_revisions`, `fact_digests`, `files.docx` and `files.pdf` (`path`, `sha256`), and `qa` (`text_consistent`, `pages`, `page_budget_pass`, `page_images`, `visual_review`). `application_approved` remains false: the separate application review is authoritative.

Register these exact files and fact dependencies through the actual material-registration operation documented in [state commands](state-commands.md). Present the JD, both documents, requirement-to-evidence map, and unresolved issues. Obtain applicant approval for the registered version and selected answer set. Deliver PDF and DOCX, not internal page images or evidence manifests unless requested.

The `materials` state operation takes `application_id`, a unique version `id`, `documents` as a list of `{ "path": "applications/APP_ID/VERSION/resume.docx", "expected_sha256": "HASH_FROM_MANIFEST" }` and PDF equivalents, `fact_ids` from the manifest's `fact_revisions` keys, selected `answer_ids`, and `qa`. Use profile-relative paths and the exact hashes from `files.docx.sha256` and `files.pdf.sha256`, so modified files cannot reuse earlier QA. Also pass the manifest's `fact_revisions` as `expected_fact_revisions`, `fact_digests` as `expected_fact_digests`, and `job_digest` as `expected_job_digest`; these prevent registering old text against facts or a JD changed during rendering, including manual edits that retain a revision number. Set `qa.text_checked` and `qa.docx_pdf_consistent` from successful text checks, and `qa.rendered_pages_reviewed` only after the manifest records actual review of every page. Supply `qa.reference` identifying the reviewed manifest. The state helper independently hashes the registered files and captures current dependencies. Material registration alone is not approval.
