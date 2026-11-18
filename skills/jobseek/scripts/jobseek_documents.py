#!/usr/bin/env python3
"""Package-document manifests and QA checks for jobseek v2.

Platform-independent core, standard library only. This helper never
decides which claims are true and never generates applicant claims.
It:

- builds a manifest for an existing package folder (file hashes,
  sizes, kinds, and text extraction where the format allows it),
- checks a manifest against the files on disk (nothing changed or
  missing since the manifest was built),
- records an actual visual review of rendered pages into a manifest.

Rendering a DOCX/PDF is NOT done here. The v1 helper hard-wired one
platform's bundled renderer; v2 replaces that with platform adapters
(see `adapters` output and references/document-commands.md):

- Muse: use the platform's documents tooling to build/render, then
  run this helper for the manifest and checks.
- ChatGPT / Codex: use the workspace's documents tooling the same way.
- Local: LibreOffice (`soffice`) can render DOCX to PDF when present.

When a renderer or a PDF text parser is unavailable, the manifest says
so plainly (`unavailable`) instead of claiming a check was performed.
Recording a visual review here never approves a package; approval is
the separate exact-package record in PACKAGE.md / the state workflow.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
import unicodedata
from urllib.parse import urlparse
import zipfile
import xml.etree.ElementTree as ET


class DocumentError(ValueError):
    """A package cannot be manifested, checked, or marked reviewed."""


MANIFEST_NAME = "manifest.json"
TEXT_SUFFIXES = {".md", ".txt"}
SKIP_SUFFIXES = {".tmp"}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    temporary.replace(path)


# ---------------------------------------------------------------- text

def normalized(text):
    # Compare across ordinary PDF line wraps and Unicode compatibility
    # variants. (Carried over from the v1 helper.)
    return re.sub(r"\s+", "",
                  unicodedata.normalize("NFKC", text)).replace(
                      "\u00ad", "")


def ordered_text_check(lines, extracted):
    """Check intended lines appear in `extracted`, in reading order."""
    text = normalized(extracted)
    position = 0
    missing = []
    for line in lines:
        needle = normalized(line)
        if not needle:
            continue
        found = text.find(needle, position)
        if found < 0:
            missing.append(line)
        else:
            position = found + len(needle)
    return {"passed": not missing, "missing_or_out_of_order": missing}


def extract_docx_text(path):
    """Extract DOCX paragraph text with the standard library only."""
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/"
                "2006/main"}
    return "\n".join("".join(p.itertext())
                     for p in root.findall(".//w:p", ns))


def extract_pdf_text(path):
    """Return (status, text). Degrades honestly without a PDF parser."""
    if importlib.util.find_spec("pypdf") is None:
        return ("unavailable",
                "pypdf is not installed in this environment; PDF text "
                "was not extracted. Use the platform documents tooling "
                "to extract text, or install pypdf, and record the "
                "result in the package QA log.")
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    return ("extracted",
            "\n".join(page.extract_text() or "" for page in reader.pages))


def extract_text(path):
    suffix = Path(path).suffix.lower()
    if suffix in TEXT_SUFFIXES:
        return ("extracted",
                Path(path).read_text(encoding="utf-8",
                                     errors="replace"))
    if suffix == ".docx":
        try:
            return ("extracted", extract_docx_text(path))
        except (zipfile.BadZipFile, KeyError, ET.ParseError) as exc:
            return ("failed", f"DOCX text extraction failed: {exc}")
    if suffix == ".pdf":
        return extract_pdf_text(path)
    return ("skipped", f"No text extractor for {suffix} files.")


def guess_kind(filename):
    name = filename.lower()
    if name == "package.md":
        return "package"
    if "cover" in name:
        return "cover"
    if "resume" in name or "cv" in name:
        return "resume"
    if "manifest" in name:
        return "manifest"
    return "document"


# ------------------------------------------------------------- adapters

def detect_adapters():
    """Report which document renderers/parsers this environment has."""
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    return {
        "libreoffice": {
            "available": soffice is not None,
            "path": soffice,
            "use": "Render DOCX to PDF locally: "
                   "soffice --headless --convert-to pdf FILE",
        },
        "python_docx": {
            "available": importlib.util.find_spec("docx") is not None,
            "use": "Author/edit DOCX from content on any platform "
                   "that provides python-docx.",
        },
        "pypdf": {
            "available": importlib.util.find_spec("pypdf") is not None,
            "use": "Extract PDF text and page counts for QA checks.",
        },
        "platform_tooling": {
            "available": None,
            "note": "Muse and ChatGPT/Codex provide their own "
                    "documents tooling inside the platform; this "
                    "helper cannot detect it from the command line. "
                    "Use the platform tooling to render, then this "
                    "helper for manifest, text, and review records.",
        },
        "degradation": "When no renderer is available, documents stay "
                       "drafts: build the manifest, run the text "
                       "checks that are possible, and record the "
                       "missing renderer in the package QA log. Never "
                       "claim a page was rendered or reviewed when it "
                       "was not.",
    }


# -------------------------------------------------------------- commands

def build_manifest(package_dir):
    root = Path(package_dir).expanduser().resolve()
    if not root.is_dir():
        raise DocumentError(f"Package directory not found: {root}")
    files = []
    for item in sorted(root.rglob("*")):
        if not item.is_file():
            continue
        rel = item.relative_to(root)
        if item.name == MANIFEST_NAME and len(rel.parts) == 1:
            continue
        if item.suffix.lower() in SKIP_SUFFIXES:
            continue
        status, text = extract_text(item)
        entry = {"path": str(rel), "filename": item.name,
                 "kind": guess_kind(item.name),
                 "sha256": digest(item), "size": item.stat().st_size,
                 "text_status": status}
        if status == "extracted":
            entry["text_chars"] = len(text)
            entry["text_sha256"] = hashlib.sha256(
                text.encode()).hexdigest()
        else:
            entry["text_note"] = text
        files.append(entry)
    package_md = root / "PACKAGE.md"
    approval = None
    if package_md.is_file():
        body = package_md.read_text(encoding="utf-8", errors="replace")
        if re.search(r"NOT APPROVED", body, re.I):
            approval = "not-approved"
        elif re.search(r"\bAPPROVED\b", body):
            approval = "approved-recorded"
    manifest = {
        "schema_version": 2,
        "package_dir": str(root),
        "created_at": stamp(),
        "files": files,
        "qa": {
            "package_md_present": package_md.is_file(),
            "approval_record_in_package_md": approval,
            "text_extraction": {
                "extracted": sum(1 for f in files
                                 if f["text_status"] == "extracted"),
                "unavailable_or_failed": [
                    f["path"] for f in files
                    if f["text_status"] in ("unavailable", "failed")],
            },
            "visual_review": {"status": "pending", "reviewer": None,
                              "pages": [], "notes": None},
        },
        "environment": detect_adapters(),
        "application_approved": False,
        "note": "This manifest records file identity and QA state. It "
                "does not approve the package; approval is the "
                "exact-package record in PACKAGE.md and the workflow's "
                "approval step.",
    }
    return manifest


def verify_files(manifest):
    root = Path(manifest["package_dir"])
    problems = []
    for item in manifest["files"]:
        path = root / item["path"]
        if not path.is_file():
            problems.append(f"Missing file: {item['path']}")
        elif digest(path) != item["sha256"]:
            problems.append(f"Changed file: {item['path']}")
    return problems


def check_manifest(manifest_path):
    manifest = read_json(manifest_path)
    problems = verify_files(manifest)
    return {"manifest": str(manifest_path), "ok": not problems,
            "problems": problems,
            "files_checked": len(manifest["files"])}


def record_visual_review(manifest_path, pages, reviewer, notes):
    manifest = read_json(manifest_path)
    problems = verify_files(manifest)
    if problems:
        raise DocumentError(
            "Files changed or are missing since the manifest was "
            "built: " + "; ".join(problems) +
            ". Render and manifest a new version before reviewing.")
    if not pages or pages != sorted(set(pages)):
        raise DocumentError(
            "Supply every rendered page number actually inspected, "
            "once each, in order.")
    if not reviewer.strip() or not notes.strip():
        raise DocumentError(
            "Provide the actual reviewer and a short inspection note.")
    unavailable = manifest["qa"]["text_extraction"][
        "unavailable_or_failed"]
    manifest["qa"]["visual_review"] = {
        "status": "passed", "reviewer": reviewer, "pages": pages,
        "notes": notes, "at": stamp(),
        "text_unavailable_files": unavailable,
    }
    write_json(manifest_path, manifest)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    man = commands.add_parser(
        "manifest", help="Build a manifest for a package folder")
    man.add_argument("--package-dir", required=True)
    man.add_argument("--output",
                     help="Write the manifest here (default: "
                          "PACKAGE_DIR/manifest.json)")
    chk = commands.add_parser(
        "check", help="Verify files against a manifest")
    chk.add_argument("--manifest", required=True)
    rev = commands.add_parser(
        "review", help="Record an actual visual review in a manifest")
    rev.add_argument("--manifest", required=True)
    rev.add_argument("--pages", required=True,
                     help="Comma-separated page numbers actually "
                          "inspected, e.g. 1,2")
    rev.add_argument("--reviewer", required=True)
    rev.add_argument("--notes", required=True)
    commands.add_parser(
        "adapters",
        help="Report available document renderers/parsers")
    txt = commands.add_parser(
        "text-check",
        help="Check that expected lines appear, in order, in a file")
    txt.add_argument("--file", required=True)
    txt.add_argument("--expect", required=True,
                     help="Text file with one expected line per line")
    args = parser.parse_args(argv)
    try:
        if args.command == "manifest":
            result = build_manifest(args.package_dir)
            output = Path(args.output) if args.output else (
                Path(args.package_dir).expanduser().resolve()
                / MANIFEST_NAME)
            write_json(output, result)
            result = {"manifest": str(output),
                      "files": len(result["files"]),
                      "qa": result["qa"]}
        elif args.command == "check":
            result = check_manifest(args.manifest)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0 if result["ok"] else 2
        elif args.command == "review":
            pages = [int(p) for p in args.pages.split(",") if p.strip()]
            result = record_visual_review(
                args.manifest, pages, args.reviewer, args.notes)
            result = {"manifest": args.manifest,
                      "visual_review": result["qa"]["visual_review"]}
        elif args.command == "adapters":
            result = detect_adapters()
        else:  # text-check
            status, text = extract_text(args.file)
            if status != "extracted":
                raise DocumentError(
                    f"Text unavailable for {args.file}: {text}")
            lines = [line for line in
                     Path(args.expect).read_text(
                         encoding="utf-8").splitlines() if line.strip()]
            result = ordered_text_check(lines, text)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0 if result["passed"] else 2
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except (DocumentError, OSError, ValueError, KeyError) as exc:
        print(f"jobseek documents: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
