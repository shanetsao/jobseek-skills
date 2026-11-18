#!/usr/bin/env python3
"""Applicant-data kit helper for the jobseek v2 workflow. Python stdlib only.

The applicant-data kit is the single source of truth for one applicant.
This helper initialises a kit, summarises it, validates it, renders the
readable LEDGER.md from ledger.json, snapshots the kit into history/, and
reconciles manual LEDGER.md edits without ever silently overwriting them.

Kit layout (one directory per applicant, at WORKSPACE/profiles/PROFILE_ID/):

    profile.yaml            applicant profile (see templates/)
    ledger.json             structured ledger (fact statuses on every entry)
    LEDGER.md               readable ledger, rendered from ledger.json
    openings.json           tracked openings
    documents-index.json    index of package documents (points at files)
    answers.json            answer bank + per-application answer sets
    status-events.json      append-only status history
    blockers.json           standing blockers (optional but validated)
    packages/<slug>/        one folder per tailored package
    sources/                preserved source files, never modified
    history/                immutable snapshots written by this helper
    reconciliation/         preserved manual LEDGER.md edits
    .kit-meta.json          helper bookkeeping (revision, LEDGER.md baseline)

Unlike the v1 helper, there is no canonical state.json and no change
operation API: kit files are the human-editable interchange format.
Edit them (or let a skill edit them), then run `validate`. Use
`snapshot` before and after significant edits, `render` to regenerate
LEDGER.md from ledger.json, and `reconcile` when LEDGER.md was edited
by hand. A v1 `state.json` profile is a legacy import source only; see
references/records.md for the import mapping.
"""
from __future__ import annotations

import argparse
import contextlib
import copy
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile


KIT_FORMAT = "applicant-data-kit/1"
USABLE_FACT_STATUSES = {"user-attested", "confirmed"}
FACT_STATUSES = USABLE_FACT_STATUSES | {"pending", "conflicted", "retired"}
TRACKS = {"Industry", "Academic", "Contractor", "External"}
ROLE_FAMILIES = {
    "Industry R&D", "Staff scientist (academic / government)",
    "Core facilities", "Applications / field scientist",
    "Program management", "Scientific writing", "Tech transfer",
    "Regulatory science", "Contractor roles", "Government / fellowship",
    "Other science role",
}
OPENING_STATUSES = {
    "Researched", "Verify-first", "Drafting", "Awaiting review",
    "Approved", "Filling", "Awaiting applicant action", "Submitted",
    "Responded", "Interview", "Offer", "Eligibility hold", "Rejection",
    "Withdrawal", "Closed", "Screened out",
}
WHY_LABELS = {"stated-reason", "context", "inference", "unavailable"}
ANSWER_SCOPES = {"universal", "job-specific"}
BLOCKER_STATUSES = {"open", "resolved"}
ASSESSMENT_VALUES = {"direct", "transferable", "unknown", "gap"}
IMPORTANCE_VALUES = {"required", "preferred", "unclassified"}
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
KIT_FILES = ("profile.yaml", "ledger.json", "LEDGER.md", "openings.json",
             "documents-index.json", "answers.json", "status-events.json",
             "blockers.json")
REQUIRED_KIT_FILES = ("profile.yaml", "ledger.json", "LEDGER.md",
                      "openings.json", "documents-index.json",
                      "answers.json", "status-events.json")


class KitError(ValueError):
    """Invalid or unsafe kit operation; nothing was written."""


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def file_hash(path):
    h = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def valid_id(value, label="id"):
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise KitError(
            f"Invalid {label}; use letters, digits, hyphens, or underscores "
            "(1-80 characters).")
    return value


def atomic_write(path, content):
    """Replace one file atomically; callers hold the kit lock."""
    path = Path(path)
    descriptor, temp = tempfile.mkstemp(prefix=".jobseek-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def _yaml_scalar(raw):
    raw = raw.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        return raw[1:-1]
    return raw


def read_profile(path):
    """Read the subset of profile.yaml the helper needs.

    The profile template has a fixed shape (top-level sections with
    indented keys and simple lists). This reader handles that shape with
    the standard library only; it is not a general YAML parser. Unknown
    keys are ignored, never rewritten by this helper.
    """
    profile = {"applicant": {}, "goal": {}, "constraints": {},
               "preferences": {}}
    section = None
    list_key = None
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        text = line.strip()
        if indent == 0 and text.endswith(":"):
            section = text[:-1]
            list_key = None
            continue
        if section not in profile:
            section = None
            continue
        if text.startswith("- "):
            if list_key:
                profile[section].setdefault(list_key, []).append(
                    _yaml_scalar(text[2:]))
            continue
        if ":" in text:
            key, _, raw = text.partition(":")
            key = key.strip()
            raw = raw.strip()
            if raw == "":
                list_key = key
                profile[section].setdefault(key, [])
            else:
                list_key = None
                profile[section][key] = _yaml_scalar(raw)
    return profile


def render_ledger(ledger_entries, display_name):
    """Render LEDGER.md from ledger.json entries (the sample format)."""
    lines = [f"# Ledger — {display_name}", "",
             "Rendered from `ledger.json` by jobseek_state.py `render`. "
             "The two files carry identical entries; ledger.json is the "
             "structured record and this file is its readable view. "
             "Manual edits to this file are preserved for reconciliation "
             "by the `reconcile` command, never silently overwritten.", ""]
    for entry in sorted(ledger_entries,
                        key=lambda e: (e.get("sortOrder", 0),
                                       e.get("section", ""))):
        lines.append(f"## {entry['section']}")
        lines.append("")
        meta = (f"**Category:** {entry['category']} · "
                f"**Fact status:** {entry['factStatus']}")
        if entry.get("sourceRef"):
            meta += f" · **Source:** {entry['sourceRef']}"
        lines.append(meta)
        lines.append("")
        lines.append(entry["body"].rstrip())
        lines.append("")
    return ("\n".join(lines).rstrip() + "\n").encode()


class KitStore:
    """One applicant's kit at WORKSPACE/profiles/PROFILE_ID/."""

    def __init__(self, workspace, profile_id):
        valid_id(profile_id, "profile_id")
        self.workspace = Path(workspace).expanduser().resolve()
        self.profile_id = profile_id
        self.root = self.workspace / "profiles" / profile_id
        self._check_ancestors(self.root)

    # -- path safety (carried over from the v1 helper) ----------------
    def _check_ancestors(self, path):
        path = Path(path).absolute()
        try:
            relative = path.relative_to(self.workspace)
        except ValueError as exc:
            raise KitError("Path escapes the selected workspace.") from exc
        current = self.workspace
        for piece in relative.parts:
            if piece in {".", ".."}:
                raise KitError("Path traversal is not allowed.")
            current = current / piece
            if current.is_symlink():
                raise KitError(
                    f"Symlink is not allowed in applicant storage: "
                    f"{current.name}")

    def path(self, relative):
        relative = Path(relative)
        if relative.is_absolute() or ".." in relative.parts:
            raise KitError("Stored paths must be relative to this kit.")
        result = self.root / relative
        self._check_ancestors(result)
        return result

    @contextlib.contextmanager
    def _locked(self):
        self._check_ancestors(self.root)
        self.root.mkdir(parents=True, exist_ok=True)
        lock_path = self.path(".kit.lock")
        with open(lock_path, "a+b") as handle:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise KitError(
                    "Another writer is updating this applicant; reload "
                    "and retry.") from exc
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)

    # -- bookkeeping ---------------------------------------------------
    def _meta_path(self):
        return self.path(".kit-meta.json")

    def _load_meta(self):
        path = self._meta_path()
        if not path.is_file():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise KitError("Cannot read .kit-meta.json.") from exc

    def _save_meta(self, meta):
        atomic_write(self._meta_path(),
                     (json.dumps(meta, ensure_ascii=False, sort_keys=True,
                                 indent=2) + "\n").encode())

    def _ledger_md_hash(self):
        path = self.path("LEDGER.md")
        return file_hash(path) if path.is_file() else None

    def manual_edits_pending(self, meta=None):
        """True when LEDGER.md differs from its last accepted baseline."""
        meta = meta if meta is not None else self._load_meta()
        if not meta:
            return False
        baseline = meta.get("ledger_md_sha256")
        return baseline is not None and self._ledger_md_hash() != baseline

    # -- loading -------------------------------------------------------
    def exists(self):
        return self.path("profile.yaml").is_file()

    def load_json(self, name):
        path = self.path(name)
        if not path.is_file():
            raise KitError(f"Kit file is missing: {name}. "
                           "Initialise the kit first.")
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise KitError(f"Cannot read {name}: {exc}") from exc

    def load_kit(self):
        if not self.exists():
            raise KitError("Applicant kit does not exist; "
                           "initialise it first.")
        kit = {"profile": read_profile(self.path("profile.yaml"))}
        for name in ("ledger.json", "openings.json",
                     "documents-index.json", "answers.json",
                     "status-events.json", "blockers.json"):
            kit[name[:-5].replace("-", "_")] = (
                self.load_json(name) if self.path(name).is_file() else [])
        return kit

    # -- commands ------------------------------------------------------
    def initialize(self, display_name=None, from_dir=None):
        with self._locked():
            if self.exists():
                raise KitError("Applicant kit already exists.")
            for directory in ("packages", "sources", "history",
                              "reconciliation"):
                self.path(directory).mkdir(parents=True, exist_ok=True)
            if from_dir:
                source = Path(from_dir).expanduser().resolve()
                if not source.is_dir():
                    raise KitError(f"--from directory not found: {source}")
                for name in KIT_FILES:
                    origin = source / name
                    if name == "profile.yaml" and not origin.is_file():
                        # The sample dataset (and a filled template
                        # instance) names the profile
                        # applicant-profile.yaml; in a live kit it is
                        # profile.yaml.
                        origin = source / "applicant-profile.yaml"
                    if origin.is_file():
                        shutil.copyfile(origin, self.path(name))
                packages = source / "packages"
                if packages.is_dir():
                    shutil.copytree(packages, self.path("packages"),
                                    dirs_exist_ok=True)
                sources = source / "sources"
                if sources.is_dir():
                    shutil.copytree(sources, self.path("sources"),
                                    dirs_exist_ok=True)
            name = display_name
            if not name and self.path("profile.yaml").is_file():
                name = read_profile(
                    self.path("profile.yaml"))["applicant"].get("full_name")
            if not name:
                raise KitError("Provide --display-name, or --from a kit "
                               "whose profile.yaml names the applicant.")
            if not self.path("profile.yaml").is_file():
                skeleton = (
                    "# Applicant profile — created by jobseek_state.py "
                    "init.\n# Fill from "
                    "templates/applicant-profile.template.yaml.\n\n"
                    f"applicant:\n  full_name: \"{name}\"\n"
                    "  display_name: \"\"\n  email: \"\"\n  phone: \"\"\n"
                    "  location: \"\"\n  timezone: \"\"\n\n"
                    "goal:\n  statement: \"\"\n  tracks: []\n"
                    "  role_families: []\n\n"
                    "constraints:\n  never_claim: []\n"
                    "  eligibility_flags: []\n"
                    "  work_authorization_note: \"\"\n\n"
                    "preferences:\n  fit_threshold_percent: 30\n")
                atomic_write(self.path("profile.yaml"),
                             skeleton.encode())
            for name_ in ("ledger.json", "openings.json",
                          "documents-index.json", "answers.json",
                          "status-events.json", "blockers.json"):
                if not self.path(name_).is_file():
                    atomic_write(self.path(name_), b"[]\n")
            if not self.path("LEDGER.md").is_file():
                atomic_write(self.path("LEDGER.md"),
                             render_ledger([], name))
            meta = {"kit_format": KIT_FORMAT,
                    "profile_id": self.profile_id,
                    "display_name": name, "revision": 0,
                    "created_at": utc_now(), "updated_at": utc_now(),
                    "ledger_md_sha256": self._ledger_md_hash()}
            self._save_meta(meta)
            return {"profile_id": self.profile_id, "display_name": name,
                    "kit": str(self.root),
                    "seeded_from": str(from_dir) if from_dir else None,
                    "revision": 0}

    def show(self):
        kit = self.load_kit()
        meta = self._load_meta() or {}
        ledger = kit["ledger"]
        openings = kit["openings"]
        statuses = {}
        for opening in openings:
            statuses[opening.get("status")] = (
                statuses.get(opening.get("status"), 0) + 1)
        fact_statuses = {}
        for entry in ledger:
            fact_statuses[entry.get("factStatus")] = (
                fact_statuses.get(entry.get("factStatus"), 0) + 1)
        return {
            "profile_id": self.profile_id,
            "display_name": meta.get(
                "display_name",
                kit["profile"]["applicant"].get("full_name")),
            "kit": str(self.root),
            "revision": meta.get("revision"),
            "ledger_entries": len(ledger),
            "fact_statuses": fact_statuses,
            "usable_ledger_entries": sum(
                1 for e in ledger
                if e.get("factStatus") in USABLE_FACT_STATUSES),
            "openings": len(openings),
            "opening_statuses": statuses,
            "documents_indexed": len(kit["documents_index"]),
            "answers": len(kit["answers"]),
            "status_events": len(kit["status_events"]),
            "blockers": len(kit["blockers"]),
            "manual_ledger_edits_pending": self.manual_edits_pending(meta),
        }

    def render(self):
        with self._locked():
            kit = self.load_kit()
            meta = self._load_meta()
            if self.manual_edits_pending(meta):
                raise KitError(
                    "LEDGER.md was edited manually since its last "
                    "accepted baseline. Review it and run reconcile "
                    "before rendering, so the edits are preserved.")
            name = (meta or {}).get(
                "display_name",
                kit["profile"]["applicant"].get("full_name", ""))
            entries = kit["ledger"]
            if not isinstance(entries, list):
                raise KitError("ledger.json must be a list of entries.")
            atomic_write(self.path("LEDGER.md"),
                         render_ledger(entries, name))
            if meta is not None:
                meta["revision"] = meta.get("revision", 0) + 1
                meta["updated_at"] = utc_now()
                meta["ledger_md_sha256"] = self._ledger_md_hash()
                self._save_meta(meta)
            return {"profile_id": self.profile_id, "rendered": "LEDGER.md",
                    "entries": len(entries)}

    def snapshot(self, label=None):
        with self._locked():
            if not self.exists():
                raise KitError("Applicant kit does not exist.")
            stamp = dt.datetime.now(dt.timezone.utc).strftime(
                "%Y%m%dT%H%M%SZ")
            dest = self.path(f"history/snapshot-{stamp}")
            suffix = 1
            while dest.exists():
                suffix += 1
                dest = self.path(f"history/snapshot-{stamp}-{suffix}")
            dest.mkdir(parents=True)
            manifest = {"profile_id": self.profile_id, "label": label,
                        "created_at": utc_now(), "files": {}}
            for name in KIT_FILES:
                origin = self.path(name)
                if origin.is_file():
                    shutil.copyfile(origin, dest / name)
                    manifest["files"][name] = file_hash(origin)
            packages = self.path("packages")
            if packages.is_dir():
                shutil.copytree(packages, dest / "packages")
                for item in sorted((dest / "packages").rglob("*")):
                    if item.is_file():
                        rel = str(item.relative_to(dest))
                        manifest["files"][rel] = file_hash(item)
            atomic_write(dest / "manifest.json",
                         (json.dumps(manifest, ensure_ascii=False,
                                     sort_keys=True, indent=2) +
                          "\n").encode())
            meta = self._load_meta()
            if meta is not None:
                meta["revision"] = meta.get("revision", 0) + 1
                meta["updated_at"] = utc_now()
                self._save_meta(meta)
            return {"profile_id": self.profile_id,
                    "snapshot": str(dest.relative_to(self.root)),
                    "files": len(manifest["files"]), "label": label}

    def reconcile(self, resolution="reviewed_no_fact_changes"):
        if resolution not in {"reviewed_no_fact_changes",
                              "import_reviewed_changes"}:
            raise KitError(
                "resolution must be reviewed_no_fact_changes or "
                "import_reviewed_changes.")
        with self._locked():
            meta = self._load_meta()
            if not self.manual_edits_pending(meta):
                return {"profile_id": self.profile_id,
                        "manual_edits": False,
                        "note": "LEDGER.md matches its accepted "
                                "baseline; nothing to reconcile."}
            edited = self.path("LEDGER.md").read_bytes()
            stamp = dt.datetime.now(dt.timezone.utc).strftime(
                "%Y%m%dT%H%M%SZ")
            preserved = self.path(
                f"reconciliation/LEDGER-before-{stamp}.md")
            self.path("reconciliation").mkdir(exist_ok=True)
            atomic_write(preserved, edited)
            kit = self.load_kit()
            name = (meta or {}).get(
                "display_name",
                kit["profile"]["applicant"].get("full_name", ""))
            atomic_write(self.path("LEDGER.md"),
                         render_ledger(kit["ledger"], name))
            if meta is not None:
                meta["revision"] = meta.get("revision", 0) + 1
                meta["updated_at"] = utc_now()
                meta["ledger_md_sha256"] = self._ledger_md_hash()
                self._save_meta(meta)
            return {"profile_id": self.profile_id, "manual_edits": True,
                    "resolution": resolution,
                    "preserved_copy": str(
                        preserved.relative_to(self.root)),
                    "note": "The edited LEDGER.md was preserved, not "
                            "overwritten silently. Reviewed fact "
                            "changes belong in ledger.json (edit it "
                            "first, then reconcile with "
                            "import_reviewed_changes); LEDGER.md has "
                            "been regenerated from ledger.json."}

    # -- validation ----------------------------------------------------
    def validate(self):
        issues, warnings = [], []

        def issue(message):
            issues.append(message)

        if not self.exists():
            return {"valid": False, "profile_id": self.profile_id,
                    "issues": ["Kit does not exist: profile.yaml is "
                               "missing."],
                    "warnings": warnings}
        for name in REQUIRED_KIT_FILES:
            if not self.path(name).is_file():
                issue(f"Missing required kit file: {name}")
        if not self.path("blockers.json").is_file():
            warnings.append("blockers.json is missing (optional, but "
                            "the dashboard seed uses it).")
        if issues:
            return {"valid": False, "profile_id": self.profile_id,
                    "issues": issues, "warnings": warnings}

        profile = read_profile(self.path("profile.yaml"))
        applicant = profile["applicant"]
        if not (applicant.get("full_name") or "").strip():
            issue("profile.yaml: applicant.full_name is empty.")
        if not (applicant.get("timezone") or "").strip():
            issue("profile.yaml: applicant.timezone is empty.")

        data = {}
        for name in ("ledger.json", "openings.json",
                     "documents-index.json", "answers.json",
                     "status-events.json", "blockers.json"):
            if not self.path(name).is_file():
                data[name] = []
                continue
            try:
                data[name] = self.load_json(name)
            except KitError as exc:
                issue(str(exc))
                data[name] = []
            if not isinstance(data[name], list):
                issue(f"{name} must be a JSON list.")
                data[name] = []

        # Ledger
        sections = set()
        for i, entry in enumerate(data["ledger.json"]):
            where = f"ledger.json[{i}]"
            if not isinstance(entry, dict):
                issue(f"{where} must be an object.")
                continue
            for field in ("section", "category", "body", "factStatus"):
                if not (isinstance(entry.get(field), str)
                        and entry[field].strip()):
                    issue(f"{where}.{field} must be a nonempty string.")
            if entry.get("factStatus") not in FACT_STATUSES:
                issue(f"{where}.factStatus "
                      f"{entry.get('factStatus')!r} is not a valid fact "
                      "status (user-attested, confirmed, pending, "
                      "conflicted, retired).")
            if entry.get("section") in sections:
                issue(f"ledger.json: duplicate section "
                      f"{entry.get('section')!r}; sections are the "
                      "evidence identifiers used by matching and must "
                      "be unique.")
            sections.add(entry.get("section"))
            if not isinstance(entry.get("sortOrder", 0), int):
                issue(f"{where}.sortOrder must be an integer.")

        # Openings
        slugs = set()
        for i, opening in enumerate(data["openings.json"]):
            where = f"openings.json[{i}]"
            if not isinstance(opening, dict):
                issue(f"{where} must be an object.")
                continue
            for field in ("slug", "title", "employer", "track",
                          "status"):
                if not (isinstance(opening.get(field), str)
                        and opening[field].strip()):
                    issue(f"{where}.{field} must be a nonempty string.")
            slug = opening.get("slug")
            if slug in slugs:
                issue(f"openings.json: duplicate slug {slug!r}.")
            slugs.add(slug)
            if opening.get("track") not in TRACKS:
                issue(f"{where} ({slug}).track "
                      f"{opening.get('track')!r} is not one of "
                      f"{sorted(TRACKS)}.")
            if opening.get("status") not in OPENING_STATUSES:
                issue(f"{where} ({slug}).status "
                      f"{opening.get('status')!r} is not in the "
                      "DATA-MODEL status vocabulary.")
            role_family = opening.get("roleFamily")
            if role_family is not None and role_family not in ROLE_FAMILIES:
                issue(f"{where} ({slug}).roleFamily {role_family!r} "
                      "is not in the DATA-MODEL role-family vocabulary.")
            why = opening.get("whyLabel")
            if why is not None and why not in WHY_LABELS:
                issue(f"{where} ({slug}).whyLabel {why!r} is not one "
                      f"of {sorted(WHY_LABELS)}.")
            for field in ("coverageScore", "unknownShare",
                          "scorecardScore", "legacyScore"):
                value = opening.get(field)
                if value is not None and (
                        not isinstance(value, (int, float))
                        or isinstance(value, bool)
                        or not 0 <= value <= 100):
                    issue(f"{where} ({slug}).{field} must be null or "
                          "a number between 0 and 100.")
            deadline = opening.get("deadline")
            if deadline is not None:
                if not (isinstance(deadline, str)
                        and DATE_PATTERN.fullmatch(deadline)):
                    issue(f"{where} ({slug}).deadline must be null or "
                          "YYYY-MM-DD.")
                else:
                    try:
                        dt.date.fromisoformat(deadline)
                    except ValueError:
                        issue(f"{where} ({slug}).deadline "
                              f"{deadline!r} is not a real date.")
            self._validate_assessments(opening, sections, issue)

        # Documents index
        current_counts = {}
        for i, doc in enumerate(data["documents-index.json"]):
            where = f"documents-index.json[{i}]"
            if not isinstance(doc, dict):
                issue(f"{where} must be an object.")
                continue
            rel = doc.get("relPath")
            if not (isinstance(rel, str) and rel.strip()):
                issue(f"{where}.relPath must be a nonempty string.")
                continue
            if Path(rel).name != doc.get("filename"):
                issue(f"{where}: filename {doc.get('filename')!r} does "
                      f"not match relPath {rel!r}.")
            try:
                target = self.path(rel)
            except KitError as exc:
                issue(f"{where}: {exc}")
                continue
            if not target.is_file():
                issue(f"{where}: indexed document does not exist in "
                      f"the kit: {rel}")
            owner = doc.get("openingSlug")
            if owner != "master-cv" and owner not in slugs:
                issue(f"{where}: openingSlug {owner!r} does not match "
                      "any opening in openings.json.")
            if doc.get("isCurrent") not in (0, 1, True, False):
                issue(f"{where}.isCurrent must be 0 or 1.")
            elif doc.get("isCurrent") in (1, True):
                key = (owner, doc.get("kind"), doc.get("versionLabel"),
                       doc.get("mimeType"))
                current_counts[key] = current_counts.get(key, 0) + 1
        for key, count in current_counts.items():
            if count > 1:
                issue(f"documents-index.json: {count} documents marked "
                      f"current for the same opening/kind/version/"
                      f"format: {key}.")

        # Answers
        for i, answer in enumerate(data["answers.json"]):
            where = f"answers.json[{i}]"
            if not isinstance(answer, dict):
                issue(f"{where} must be an object.")
                continue
            for field in ("question", "answer"):
                if not (isinstance(answer.get(field), str)
                        and answer[field].strip()):
                    issue(f"{where}.{field} must be a nonempty string.")
            if answer.get("scope") not in ANSWER_SCOPES:
                issue(f"{where}.scope {answer.get('scope')!r} must be "
                      "universal or job-specific.")
            if answer.get("scope") == "job-specific" \
                    and not answer.get("jobLabel"):
                issue(f"{where} is job-specific but has no jobLabel.")

        # Status events
        for i, event in enumerate(data["status-events.json"]):
            where = f"status-events.json[{i}]"
            if not isinstance(event, dict):
                issue(f"{where} must be an object.")
                continue
            if event.get("status") not in OPENING_STATUSES:
                issue(f"{where}.status {event.get('status')!r} is not "
                      "in the DATA-MODEL status vocabulary.")
            if event.get("openingSlug") not in slugs:
                issue(f"{where}.openingSlug "
                      f"{event.get('openingSlug')!r} does not match "
                      "any opening in openings.json.")
            email = [event.get(k) for k in
                     ("emailFrom", "emailSubject", "emailDate")]
            if any(email) and not all(email):
                issue(f"{where}: email evidence must record sender, "
                      "subject, and date together, or none of them.")

        # Blockers
        for i, blocker in enumerate(data["blockers.json"]):
            where = f"blockers.json[{i}]"
            if not isinstance(blocker, dict):
                issue(f"{where} must be an object.")
                continue
            if not (isinstance(blocker.get("title"), str)
                    and blocker["title"].strip()):
                issue(f"{where}.title must be a nonempty string.")
            if blocker.get("status") not in BLOCKER_STATUSES:
                issue(f"{where}.status {blocker.get('status')!r} must "
                      "be open or resolved.")

        # Packages on disk
        packages = self.path("packages")
        if packages.is_dir():
            for folder in sorted(packages.iterdir()):
                if folder.is_dir() and not (folder / "PACKAGE.md").is_file():
                    warnings.append(
                        f"packages/{folder.name}/ has no PACKAGE.md.")

        meta = self._load_meta()
        if self.manual_edits_pending(meta):
            warnings.append(
                "LEDGER.md was edited manually since its last "
                "accepted baseline; run reconcile after reviewing "
                "the edits.")

        return {"valid": not issues, "profile_id": self.profile_id,
                "issues": issues, "warnings": warnings,
                "counts": {
                    "ledger_entries": len(data["ledger.json"]),
                    "openings": len(data["openings.json"]),
                    "documents": len(data["documents-index.json"]),
                    "answers": len(data["answers.json"]),
                    "status_events": len(data["status-events.json"]),
                    "blockers": len(data["blockers.json"])}}

    @staticmethod
    def _validate_assessments(opening, sections, issue):
        assessments = opening.get("assessments")
        if assessments is None:
            return
        slug = opening.get("slug")
        where = f"openings.json ({slug}).assessments"
        if not isinstance(assessments, list) or not assessments:
            issue(f"{where} must be a nonempty list when present.")
            return
        seen = set()
        for j, row in enumerate(assessments):
            rwhere = f"{where}[{j}]"
            if not isinstance(row, dict):
                issue(f"{rwhere} must be an object.")
                continue
            if not row.get("id") or row["id"] in seen:
                issue(f"{rwhere}.id must be present and unique within "
                      "the opening.")
            seen.add(row.get("id"))
            if not (isinstance(row.get("text"), str)
                    and row["text"].strip()):
                issue(f"{rwhere}.text must be a nonempty string.")
            if row.get("importance", "unclassified") \
                    not in IMPORTANCE_VALUES:
                issue(f"{rwhere}.importance "
                      f"{row.get('importance')!r} must be required, "
                      "preferred, or unclassified.")
            if row.get("assessment") not in ASSESSMENT_VALUES:
                issue(f"{rwhere}.assessment "
                      f"{row.get('assessment')!r} must be direct, "
                      "transferable, unknown, or gap.")
            evidence = row.get("evidence", [])
            if not isinstance(evidence, list) or any(
                    not isinstance(x, str) for x in evidence):
                issue(f"{rwhere}.evidence must be a list of ledger "
                      "section names.")
            else:
                for section in evidence:
                    if section not in sections:
                        issue(f"{rwhere}.evidence references unknown "
                              f"ledger section {section!r}.")
            if row.get("assessment") in {"direct", "transferable",
                                         "gap"} and not (
                    isinstance(row.get("rationale"), str)
                    and row["rationale"].strip()):
                issue(f"{rwhere} ({row.get('id')}) is assessed "
                      f"{row.get('assessment')} but has no rationale.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True,
                        help="Selected jobseek data workspace")
    parser.add_argument("--profile", required=True,
                        help="Explicit applicant profile ID (the kit "
                             "folder under WORKSPACE/profiles/)")
    subparsers = parser.add_subparsers(dest="command", required=True)
    init = subparsers.add_parser(
        "init", help="Create a kit; --from seeds it from an existing "
                     "kit directory (e.g. the sample dataset)")
    init.add_argument("--display-name")
    init.add_argument("--from", dest="from_dir")
    subparsers.add_parser("show", help="Summarise the kit")
    subparsers.add_parser("validate",
                          help="Validate the kit; exit 2 when invalid")
    subparsers.add_parser("render",
                          help="Regenerate LEDGER.md from ledger.json")
    snap = subparsers.add_parser(
        "snapshot", help="Snapshot the kit into history/")
    snap.add_argument("--label")
    cp = subparsers.add_parser(
        "checkpoint", help="Alias for snapshot (application checkpoint)")
    cp.add_argument("--label")
    rec = subparsers.add_parser(
        "reconcile",
        help="Preserve manual LEDGER.md edits and regenerate it")
    rec.add_argument("--resolution",
                     default="reviewed_no_fact_changes",
                     choices=("reviewed_no_fact_changes",
                              "import_reviewed_changes"))
    args = parser.parse_args(argv)
    try:
        store = KitStore(args.workspace, args.profile)
        if args.command == "init":
            result = store.initialize(args.display_name, args.from_dir)
        elif args.command == "show":
            result = store.show()
        elif args.command == "validate":
            result = store.validate()
        elif args.command == "render":
            result = store.render()
        elif args.command in ("snapshot", "checkpoint"):
            result = store.snapshot(args.label)
        else:
            result = store.reconcile(args.resolution)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.command == "validate" and not result["valid"]:
            return 2
        return 0
    except (KitError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
