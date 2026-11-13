#!/usr/bin/env python3
"""Render evidence-linked jobseek content; never generate applicant claims."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlparse
import zipfile
import xml.etree.ElementTree as ET


class DocumentError(ValueError):
    """A document cannot be generated or marked reviewed."""


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def canonical_digest(value):
    data = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(data.encode()).hexdigest()


def record_digest(value):
    """Use the state helper's canonical record representation."""
    return hashlib.sha256((json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()).hexdigest()


def job_digest(job):
    """Match the selected-JD digest used by the shared state helper."""
    value = {key: job.get(key) for key in ("id", "profile_id", "employer", "title", "canonical_url", "jd_text", "requirements")}
    return record_digest(value)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def stamp():
    return datetime.now(timezone.utc).isoformat()


def content_items(content):
    """Return text objects in exact intended reading order, excluding headings."""
    applicant = content.get("applicant", {})
    yield applicant.get("name")
    yield from applicant.get("contact", [])
    for section in content.get("sections", []):
        yield from section.get("entries", [])


def expected_lines(content):
    yield content["applicant"]["name"]["text"]
    yield from (item["text"] for item in content["applicant"].get("contact", []))
    for section in content["sections"]:
        yield section["title"]
        yield from (item["text"] for item in section["entries"])


def validate_content(content, state):
    if not isinstance(content, dict) or not isinstance(state, dict):
        raise DocumentError("Content and state must be JSON objects.")
    if content.get("profile_id") != state.get("profile_id") or not content.get("profile_id"):
        raise DocumentError("Content profile_id must match the supplied applicant state.")
    if content.get("kind") not in {"resume", "academic_cv"}:
        raise DocumentError("kind must be resume or academic_cv.")
    job = state.get("jobs", {}).get(content.get("job_id"))
    if not job or job.get("profile_id") != content["profile_id"]:
        raise DocumentError("job_id must identify a job in this applicant profile.")
    if content.get("paper", "letter") not in {"letter", "a4"}:
        raise DocumentError("paper must be letter or a4.")
    if not isinstance(content.get("applicant"), dict):
        raise DocumentError("applicant must contain an evidence-linked name and contact items.")
    if not isinstance(content["applicant"].get("contact", []), list):
        raise DocumentError("applicant.contact must be a list of text objects.")
    if not isinstance(content.get("sections"), list) or not content["sections"]:
        raise DocumentError("At least one section is required.")
    for section in content["sections"]:
        if not isinstance(section, dict) or not isinstance(section.get("title"), str) or not section["title"].strip():
            raise DocumentError("Every section needs a nonempty title.")
        if not isinstance(section.get("entries"), list) or not section["entries"]:
            raise DocumentError("Every section needs substantive entries.")
    revisions = {}
    for item in content_items(content):
        if not isinstance(item, dict) or not isinstance(item.get("text"), str) or not item["text"].strip():
            raise DocumentError("Every content item needs nonempty text.")
        if "\x00" in item["text"] or re.search(r"\[(?:TODO|TBD|PLACEHOLDER)\]", item["text"], re.I):
            raise DocumentError("Unresolved placeholders cannot enter application documents.")
        if item.get("type", "paragraph") not in {"paragraph", "heading", "bullet"}:
            raise DocumentError("Entry type must be paragraph, heading, or bullet.")
        ids = item.get("fact_ids")
        if not isinstance(ids, list) or not ids or any(not isinstance(f, str) for f in ids):
            raise DocumentError("Each substantive item needs at least one fact_id.")
        for fact_id in ids:
            fact = state.get("facts", {}).get(fact_id)
            if not fact or fact.get("profile_id") != state["profile_id"]:
                raise DocumentError(f"Unknown or foreign-profile fact: {fact_id}")
            if fact.get("status") not in {"user_attested", "confirmed"}:
                raise DocumentError(f"Fact is not usable for drafting: {fact_id}")
            revision = fact.get("revision")
            if not isinstance(revision, int) or revision < 1:
                raise DocumentError(f"Fact lacks a valid revision: {fact_id}")
            revisions[fact_id] = revision
        if item.get("url") and urlparse(item["url"]).scheme not in {"https", "http", "mailto"}:
            raise DocumentError("Links must use https, http, or mailto.")
    maximum = content.get("max_pages", 2 if content["kind"] == "resume" else None)
    if maximum is not None and (not isinstance(maximum, int) or isinstance(maximum, bool) or maximum < 1):
        raise DocumentError("max_pages must be a positive integer or null.")
    return revisions


def normalized(text):
    # Compare across ordinary PDF line wraps and Unicode compatibility variants.
    import unicodedata
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text)).replace("\u00ad", "")


def ordered_text_check(lines, extracted):
    text = normalized(extracted)
    position = 0
    missing = []
    for line in lines:
        needle = normalized(line)
        found = text.find(needle, position)
        if found < 0:
            missing.append(line)
        else:
            position = found + len(needle)
    return {"passed": not missing, "missing_or_out_of_order": missing}


def extract_docx_text(path):
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    return "\n".join("".join(p.itertext()) for p in root.findall(".//w:p", ns))


def add_text(paragraph, item, bold=False):
    if not item.get("url"):
        paragraph.add_run(item["text"]).bold = bold
        return
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.opc.constants import RELATIONSHIP_TYPE
    hyperlink = OxmlElement("w:hyperlink")
    rel_id = paragraph.part.relate_to(item["url"], RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    hyperlink.set(qn("r:id"), rel_id)
    run = OxmlElement("w:r")
    properties = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "000000")
    properties.append(color)
    if bold:
        properties.append(OxmlElement("w:b"))
    run.append(properties)
    text = OxmlElement("w:t")
    text.text = item["text"]
    run.append(text)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def author_docx(content, destination):
    from docx import Document
    from docx.shared import Inches, Mm, Pt, RGBColor
    from docx.oxml.ns import qn
    document = Document()
    section = document.sections[0]
    section.top_margin = section.bottom_margin = Inches(0.65)
    section.left_margin = section.right_margin = Inches(0.75)
    if content.get("paper", "letter") == "a4":
        section.page_width, section.page_height = Mm(210), Mm(297)
    else:
        section.page_width, section.page_height = Inches(8.5), Inches(11)
    for style_name in ["Normal", "Title", "Heading 1", "Heading 2", "List Bullet"]:
        style = document.styles[style_name]
        style.font.name = "Arial"
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.font.size = Pt(11)
        style.paragraph_format.space_before = Pt(0)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.line_spacing = 1.05
        borders = style.element.find(".//" + qn("w:pBdr"))
        if borders is not None:
            borders.getparent().remove(borders)
    document.styles["Title"].font.size = Pt(20)
    document.styles["Title"].font.bold = True
    document.styles["Heading 1"].font.bold = True
    document.styles["Heading 1"].paragraph_format.space_before = Pt(9)
    document.styles["Heading 1"].paragraph_format.keep_with_next = True
    document.styles["Heading 2"].font.bold = True
    document.styles["Heading 2"].paragraph_format.keep_with_next = True
    document.styles["List Bullet"].paragraph_format.left_indent = Inches(0.16)
    document.styles["List Bullet"].paragraph_format.first_line_indent = Inches(-0.12)
    add_text(document.add_paragraph(style="Title"), content["applicant"]["name"])
    for item in content["applicant"].get("contact", []):
        add_text(document.add_paragraph(), item)
    for group in content["sections"]:
        document.add_paragraph(group["title"], style="Heading 1")
        for item in group["entries"]:
            kind = item.get("type", "paragraph")
            paragraph = document.add_paragraph(style={"bullet": "List Bullet", "heading": "Heading 2"}.get(kind, "Normal"))
            paragraph.paragraph_format.widow_control = True
            add_text(paragraph, item, bold=kind == "heading")
    document.core_properties.author = ""
    document.core_properties.last_modified_by = ""
    document.core_properties.title = content["applicant"]["name"]["text"]
    document.core_properties.comments = ""
    document.save(destination)


def build(content, state, output_dir, renderer, node, marker, timeout=180):
    revisions = validate_content(content, state)
    for label, path in [("renderer", renderer), ("Node runtime", node), ("artifact marker", marker)]:
        if not Path(path).is_file():
            raise DocumentError(f"Missing {label}: {path}. Resolve the bundled document tools; no system fallback is used.")
    output = Path(output_dir).resolve()
    stem = "resume" if content["kind"] == "resume" else "academic-cv"
    docx_path, manifest_path = output / f"{stem}.docx", output / "manifest.json"
    if output.exists() and any(output.iterdir()):
        raise DocumentError("Use an empty, new version directory; existing application artifacts are never overwritten.")
    output.mkdir(parents=True, exist_ok=True)
    marker_result = subprocess.run([str(node), str(marker), "--operation-kind", "create", "--expected-output-count", "2", "--output-format", "docx"], capture_output=True, text=True, timeout=30)
    if marker_result.returncode:
        raise DocumentError("Artifact operation marker failed: " + marker_result.stderr[-2000:])
    author_docx(content, docx_path)
    qa_dir = output / "qa"
    try:
        result = subprocess.run([sys.executable, str(renderer), str(docx_path), "--output_dir", str(qa_dir), "--emit_pdf"], capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise DocumentError("Bundled document renderer timed out; inspect the source DOCX and renderer before retrying.") from exc
    (output / "render.log").write_text(result.stdout + "\n" + result.stderr, encoding="utf-8")
    rendered_pdf = qa_dir / f"{stem}.pdf"
    pages = sorted(qa_dir.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
    if result.returncode or not rendered_pdf.exists() or not pages:
        raise DocumentError(f"Bundled rendering failed; see {output / 'render.log'}. No ready-to-submit claim is made.")
    pdf_path = output / f"{stem}.pdf"
    rendered_pdf.replace(pdf_path)
    from pypdf import PdfReader
    reader = PdfReader(pdf_path)
    pdf_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    docx_text = extract_docx_text(docx_path)
    lines = list(expected_lines(content))
    docx_check = ordered_text_check(lines, docx_text)
    pdf_check = ordered_text_check(lines, pdf_text)
    maximum = content.get("max_pages", 2 if content["kind"] == "resume" else None)
    page_budget_pass = maximum is None or len(reader.pages) <= maximum
    manifest = {
        "schema_version": 1, "profile_id": content["profile_id"], "job_id": content["job_id"],
        "kind": content["kind"], "created_at": stamp(), "content_sha256": canonical_digest(content),
        "job_digest": job_digest(state["jobs"][content["job_id"]]),
        "fact_revisions": revisions,
        "fact_digests": {fact_id: record_digest(state["facts"][fact_id]) for fact_id in revisions},
        "files": {"docx": {"path": str(docx_path), "sha256": digest(docx_path)}, "pdf": {"path": str(pdf_path), "sha256": digest(pdf_path)}},
        "qa": {"text_consistent": docx_check["passed"] and pdf_check["passed"], "docx_text": docx_check,
               "pdf_text": pdf_check, "pages": len(reader.pages), "max_pages": maximum,
               "page_budget_pass": page_budget_pass,
               "page_images": [{"page": i + 1, "path": str(path), "sha256": digest(path)} for i, path in enumerate(pages)],
               "visual_review": {"status": "pending", "reviewer": None, "pages": []}},
        "application_approved": False,
    }
    write_json(output / "content.json", content)
    write_json(manifest_path, manifest)
    if len(reader.pages) != len(pages):
        raise DocumentError("PDF and rendered-page counts differ; inspect the manifest before proceeding.")
    if not manifest["qa"]["text_consistent"] or not page_budget_pass:
        raise DocumentError(f"Document checks failed; inspect {manifest_path}. Revise content in a new version directory.")
    return manifest


def verify_files(manifest):
    for item in [*manifest["files"].values(), *manifest["qa"]["page_images"]]:
        path = Path(item["path"])
        if not path.is_file() or digest(path) != item["sha256"]:
            raise DocumentError(f"Artifact changed or is missing: {path}. Render and review a new version.")


def record_visual_review(manifest_path, pages, reviewer, notes):
    manifest = read_json(manifest_path)
    verify_files(manifest)
    qa = manifest["qa"]
    if not qa["text_consistent"] or not qa["page_budget_pass"]:
        raise DocumentError("Visual review cannot override failed content or page-budget checks.")
    if sorted(pages) != list(range(1, qa["pages"] + 1)):
        raise DocumentError("Every rendered page must be inspected exactly once in the review record.")
    if not reviewer.strip() or not notes.strip():
        raise DocumentError("Provide the actual reviewer and a short inspection note.")
    qa["visual_review"] = {"status": "passed", "reviewer": reviewer, "pages": sorted(pages), "notes": notes, "at": stamp()}
    write_json(manifest_path, manifest)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("build")
    for flag in ["input", "state", "output-dir", "renderer", "node", "marker"]:
        create.add_argument("--" + flag, required=True)
    review = commands.add_parser("review")
    review.add_argument("--manifest", required=True)
    review.add_argument("--pages", required=True, help="Comma-separated page numbers actually inspected.")
    review.add_argument("--reviewer", required=True)
    review.add_argument("--notes", required=True)
    check = commands.add_parser("check")
    check.add_argument("--manifest", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            result = build(read_json(args.input), read_json(args.state), args.output_dir, args.renderer, args.node, args.marker)
        elif args.command == "review":
            result = record_visual_review(args.manifest, [int(p) for p in args.pages.split(",")], args.reviewer, args.notes)
        else:
            result = read_json(args.manifest)
            verify_files(result)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except (DocumentError, OSError, ValueError, KeyError, ImportError) as exc:
        print(f"jobseek documents: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
