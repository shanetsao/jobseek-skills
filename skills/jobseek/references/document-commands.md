# Document commands: jobseek_documents.py

The documents helper is the platform-independent core of package QA:
manifests, file-integrity checks, text checks, and visual-review
records. Standard library only. It never writes applicant claims, never
decides what is true, and never approves a package.

```bash
python3 skills/jobseek/scripts/jobseek_documents.py <command> [options]
```

Exit 0 = success / check passed, 2 = error / check failed.

## manifest — fingerprint a package folder

```bash
python3 ... manifest --package-dir packages/<slug> \
  [--output <path>]        # default: <package-dir>/manifest.json
```

Walks the folder (skipping its own manifest) and records, per file:
relative path, kind guess (resume / cover / package / document),
SHA-256, size, and text extraction where possible — `.md`/`.txt`
directly, `.docx` via the standard library, `.pdf` via `pypdf` **when
installed**. It also reports whether `PACKAGE.md` is present and what
approval record it contains (`not-approved` / `approved-recorded`), and
embeds the adapter report (below). `application_approved` is always
`false` in a manifest: a manifest is evidence about files, not an
approval.

When a file's text cannot be extracted (e.g. PDF without `pypdf`), the
manifest says `unavailable` and names the file — it never pretends the
check ran.

## check — verify files against a manifest

```bash
python3 ... check --manifest packages/<slug>/manifest.json
```

Re-hashes every manifest file; reports missing or changed files by
name. Exit 2 if any problem. This is how "the exact files that were
approved" stays checkable after the fact.

## text-check — ordered content check

```bash
python3 ... text-check --file <resume.docx|pdf|md> --expect <lines.txt>
```

`--expect` is a text file with one expected line per line. The check
normalises whitespace/Unicode (so PDF line wraps don't matter) and
verifies the lines appear **in order** in the extracted text. Reports
the missing or out-of-order lines; exit 2 on failure or when the
file's text is unavailable.

## review — record an actual visual review

```bash
python3 ... review --manifest packages/<slug>/manifest.json \
  --pages 1,2 --reviewer "<who looked>" --notes "<what was checked>"
```

Records into the manifest that a named reviewer actually inspected the
listed rendered pages. Refuses if any file changed or went missing
since the manifest was built (render and re-manifest a new version
first). A review record is QA evidence; approval is still the separate
exact-package record in `PACKAGE.md`.

## adapters — what can render here

```bash
python3 ... adapters
```

Reports what this environment offers:

- **LibreOffice** (`soffice`) — renders DOCX→PDF locally when present:
  `soffice --headless --convert-to pdf FILE`.
- **python-docx** — author/edit DOCX when installed.
- **pypdf** — PDF text extraction when installed.
- **Platform tooling** — Muse and ChatGPT/Codex provide their own
  documents tooling inside the platform; the helper cannot detect it
  from the command line. Use the platform tooling to build and render,
  then this helper for manifest, checks, and the review record.

Degradation rule: when no renderer is available, documents stay drafts.
Build the manifest, run the checks that are possible, and record the
missing renderer in the package QA log. Never claim a page was rendered
or reviewed when it was not. (The v1 helper hard-wired one platform's
bundled renderer paths; v2 deliberately does not — renderer discovery
is per-platform, above.)
