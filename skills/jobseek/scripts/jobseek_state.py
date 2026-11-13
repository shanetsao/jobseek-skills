#!/usr/bin/env python3
"""Local applicant records and version-bound approval checks. Python stdlib only."""
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


SCHEMA_VERSION = 1
USABLE_FACT_STATUSES = {"user_attested", "confirmed"}
FACT_STATUSES = USABLE_FACT_STATUSES | {"pending", "conflicted", "retired"}
ACTIVE_APPROVAL_STATUSES = {"approved", "filling", "awaiting_applicant_action"}
STATUS_VALUES = {"drafting", "awaiting_review", "approved", "filling",
                 "awaiting_applicant_action", "submitted", "interview", "offer",
                 "rejected", "withdrawn", "closed"}
QA_KEYS = ("rendered_pages_reviewed", "text_checked", "docx_pdf_consistent")
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")


class StateError(ValueError):
    """Invalid or unsafe change; no canonical state was written."""


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()


def digest(value):
    return hashlib.sha256(json_bytes(value)).hexdigest()


def file_hash(path):
    h = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def valid_id(value, label="id"):
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise StateError(f"Invalid {label}; use letters, digits, hyphens, or underscores (1–80 characters).")
    return value


def nonempty(value, label):
    if not isinstance(value, str) or not value.strip():
        raise StateError(f"{label} must be a nonempty string.")
    return value


def atomic_write(path, content):
    """Replace one file atomically; callers hold the profile lock."""
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


def _md_value(value, level=0):
    if isinstance(value, dict):
        lines = []
        for key, item in value.items():
            label = str(key).replace("_", " ")
            if isinstance(item, (list, dict)):
                lines.append("  " * level + f"- **{label}:**")
                lines.extend(_md_value(item, level + 1))
            else:
                lines.append("  " * level + f"- **{label}:** {item}")
        return lines
    if isinstance(value, list):
        lines = []
        for item in value:
            if isinstance(item, (dict, list)):
                lines.extend(_md_value(item, level))
                lines.append("")
            else:
                lines.append("  " * level + f"- {item}")
        return lines or ["  " * level + "- None recorded"]
    return ["  " * level + str(value)]


def render_dossier(state):
    lines = [f"# {state['display_name']} — applicant dossier", "",
             f"Profile: `{state['profile_id']}` · Revision: {state['revision']}", "",
             "Generated from state.json. Use jobseek-ledger to update records. Manual edits are preserved for reconciliation.", "",
             "## Career preferences", ""]
    lines.extend(_md_value(state["preferences"]))
    for category in sorted({fact["category"] for fact in state["facts"].values()}):
        lines.extend(["", f"## {category.replace('_', ' ').title()}", ""])
        for fact in state["facts"].values():
            if fact["category"] != category:
                continue
            lines.extend([f"### {fact['id']} — {fact['status']}", "",
                          f"Record revision: {fact['revision']}", ""])
            lines.extend(_md_value(fact["data"]))
            lines.extend(["", "Evidence:", ""])
            lines.extend(_md_value(fact["provenance"]))
            if fact.get("review"):
                lines.extend(["", "Review:", ""])
                lines.extend(_md_value(fact["review"]))
    lines.extend(["", "## Application tracker", ""])
    for application in state["applications"].values():
        job = state["jobs"][application["job_id"]]
        lines.extend([f"- **{application['id']}**: {job['employer']} — {job['title']} — {application['status']}"])
        if application.get("review_required"):
            lines.append("  - Review required: " + "; ".join(application["review_required"]))
        if application.get("checkpoint"):
            lines.extend(_md_value(application["checkpoint"], 1))
    lines.extend(["", "## Answer bank", ""])
    for answer in state["answers"].values():
        lines.extend([f"### {answer['id']} — {answer['status']}", "", answer["question"], "", answer["text"], ""])
    lines.extend(["", "## Feedback", ""])
    lines.extend(_md_value(state["feedback"]))
    return ("\n".join(lines).rstrip() + "\n").encode()


class JobseekStore:
    def __init__(self, workspace, profile_id):
        valid_id(profile_id, "profile_id")
        self.workspace = Path(workspace).expanduser().resolve()
        self.profile_id = profile_id
        self.root = self.workspace / "profiles" / profile_id
        self._check_ancestors(self.root)

    def _check_ancestors(self, path):
        path = Path(path).absolute()
        # An explicitly selected workspace may be reached through a user's mount;
        # everything below that workspace must remain an ordinary local path.
        try:
            relative = path.relative_to(self.workspace)
        except ValueError as exc:
            raise StateError("Path escapes the selected workspace.") from exc
        current = self.workspace
        for piece in relative.parts:
            if piece in {".", ".."}:
                raise StateError("Path traversal is not allowed.")
            current = current / piece
            if current.is_symlink():
                raise StateError(f"Symlink is not allowed in applicant storage: {current.name}")

    def path(self, relative):
        relative = Path(relative)
        if relative.is_absolute() or ".." in relative.parts:
            raise StateError("Stored paths must be relative to this applicant profile.")
        result = self.root / relative
        self._check_ancestors(result)
        return result

    @contextlib.contextmanager
    def _locked(self):
        self._check_ancestors(self.root)
        self.root.mkdir(parents=True, exist_ok=True)
        lock_path = self.path(".write.lock")
        with open(lock_path, "a+b") as handle:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise StateError("Another writer is updating this applicant; reload and retry.") from exc
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)

    def initialize(self, display_name):
        nonempty(display_name, "display_name")
        with self._locked():
            if self.path("state.json").exists():
                raise StateError("Applicant profile already exists.")
            state = {"schema_version": SCHEMA_VERSION, "profile_id": self.profile_id,
                     "revision": 0, "display_name": display_name, "updated_at": utc_now(),
                     "preferences": {}, "facts": {}, "jobs": {}, "applications": {},
                     "answers": {}, "feedback": [], "search_runs": [], "sources": {}, "preference_history": []}
            for directory in ("sources", "history", "applications", "reconciliation"):
                self.path(directory).mkdir(exist_ok=True)
            self._commit(state)
            return state

    def load(self):
        path = self.path("state.json")
        if not path.is_file():
            raise StateError("Applicant profile does not exist; initialize it first.")
        try:
            state = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            raise StateError("Cannot read applicant state.json.") from exc
        self._validate_state(state)
        return state

    def _record_profile(self, record):
        if not isinstance(record, dict):
            raise StateError("Record must be a JSON object.")
        if record.get("profile_id") != self.profile_id:
            raise StateError("Every record must explicitly name this profile_id.")
        valid_id(record.get("id"))

    def _validate_fact(self, fact, state):
        self._record_profile(fact)
        nonempty(fact.get("category"), "fact.category")
        if not isinstance(fact.get("data"), dict) or not fact["data"]:
            raise StateError("fact.data must be a nonempty object.")
        if fact.get("status") not in FACT_STATUSES:
            raise StateError("Invalid fact status.")
        provenance = fact.get("provenance")
        if not isinstance(provenance, list) or not provenance:
            raise StateError("Every fact needs provenance.")
        for source in provenance:
            if not isinstance(source, dict) or source.get("kind") not in {"user", "document"}:
                raise StateError("Fact provenance kind must be user or document.")
            reference = nonempty(source.get("reference"), "provenance.reference")
            if source["kind"] == "document" and not (
                reference in state["sources"] or reference.startswith(("https://", "http://"))
            ):
                raise StateError("Document provenance must reference a registered source ID or source URL.")
        if fact["status"] == "user_attested" and not any(p["kind"] == "user" for p in provenance):
            raise StateError("A user-attested fact requires an explicit user reference.")
        if fact["status"] == "confirmed":
            review = fact.get("review", {})
            if review.get("kind") != "user_confirmation":
                raise StateError("Confirmed imported facts require a user_confirmation review.")
            nonempty(review.get("reference"), "review.reference")

    def _validate_state(self, state):
        if not isinstance(state, dict):
            raise StateError("Applicant state must be a JSON object.")
        if state.get("schema_version") != SCHEMA_VERSION or state.get("profile_id") != self.profile_id:
            raise StateError("Wrong profile or unsupported schema version.")
        if not isinstance(state.get("revision"), int) or state["revision"] < 0:
            raise StateError("Invalid profile revision.")
        nonempty(state.get("display_name"), "display_name")
        for name in ("preferences", "facts", "jobs", "applications", "answers", "sources"):
            if not isinstance(state.get(name), dict):
                raise StateError(f"{name} must be an object.")
        for name in ("feedback", "search_runs"):
            if not isinstance(state.get(name), list):
                raise StateError(f"{name} must be a list.")
        for group in ("facts", "jobs", "applications", "answers", "sources"):
            for key, record in state[group].items():
                if not isinstance(record, dict) or record.get("id") != key:
                    raise StateError(f"Invalid {group} record identifier.")
                self._record_profile(record)
        for fact in state["facts"].values():
            self._validate_fact(fact, state)
            if not isinstance(fact.get("revision"), int) or fact["revision"] < 1:
                raise StateError("Invalid fact revision.")
        for application in state["applications"].values():
            if application.get("job_id") not in state["jobs"]:
                raise StateError("Application refers to a missing job.")
            if application.get("status") not in STATUS_VALUES:
                raise StateError("Invalid application status.")

    def _dossier_changed(self, state):
        path = self.path("dossier.md")
        return not path.is_file() or file_hash(path) != state.get("dossier_sha256")

    def _commit(self, state):
        dossier = render_dossier(state)
        state["dossier_sha256"] = hashlib.sha256(dossier).hexdigest()
        self._validate_state(state)
        history = self.path(f"history/revision-{state['revision']:06d}.json")
        if history.exists():
            raise StateError("Revision snapshot already exists; do not overwrite history.")
        payload = json_bytes(state)
        atomic_write(history, payload)
        # State is authoritative. A crash between replacements is detected as a
        # changed dossier and handled through explicit reconciliation.
        atomic_write(self.path("state.json"), payload)
        atomic_write(self.path("dossier.md"), dossier)

    def _put(self, state, collection, record):
        record = copy.deepcopy(record)
        self._record_profile(record)
        old = state[collection].get(record["id"])
        record["revision"] = (old or {}).get("revision", 0) + 1
        record["created_at"] = (old or {}).get("created_at", utc_now())
        record["updated_at"] = utc_now()
        state[collection][record["id"]] = record
        return record

    def _fact_revisions(self, state, ids):
        if not isinstance(ids, list) or any(not isinstance(item, str) for item in ids) or len(ids) != len(set(ids)):
            raise StateError("fact_ids must be a list of unique IDs.")
        revisions = {}
        for identifier in ids:
            fact = state["facts"].get(identifier)
            if not fact or fact["status"] not in USABLE_FACT_STATUSES:
                raise StateError(f"Fact is missing or not usable: {identifier}")
            revisions[identifier] = fact["revision"]
        return revisions

    def _answer_snapshot(self, state, ids, application_id):
        if not isinstance(ids, list) or any(not isinstance(item, str) for item in ids) or len(ids) != len(set(ids)):
            raise StateError("answer_ids must be a list of unique IDs.")
        result = {}
        for identifier in ids:
            answer = state["answers"].get(identifier)
            if not answer:
                raise StateError(f"Missing answer: {identifier}")
            if answer["scope"] == "application" and answer.get("application_id") != application_id:
                raise StateError("An application-specific answer cannot be used for a different application.")
            self._fact_revisions(state, answer.get("fact_ids", []))
            result[identifier] = {"revision": answer["revision"], "digest": digest(answer)}
        return result

    def _application(self, state, identifier):
        valid_id(identifier, "application_id")
        if identifier not in state["applications"]:
            raise StateError("Unknown application.")
        return state["applications"][identifier]

    def _material_reasons(self, state, application, material):
        reasons = []
        job = state["jobs"][application["job_id"]]
        if material.get("job_digest") != self._job_digest(job):
            reasons.append("Job description or application destination changed.")
        for identifier, revision in material["fact_revisions"].items():
            fact = state["facts"].get(identifier)
            if not fact or fact["status"] not in USABLE_FACT_STATUSES or fact["revision"] != revision:
                reasons.append(f"Supporting fact changed or is not usable: {identifier}.")
            elif material.get("fact_digests", {}).get(identifier) != digest(fact):
                reasons.append(f"Supporting fact content changed without a matching revision: {identifier}.")
            if fact:
                for evidence in fact["provenance"]:
                    source = state["sources"].get(evidence["reference"])
                    if source and source["kind"] == "document":
                        try:
                            path = self.path(source["stored_path"])
                            if not path.is_file() or file_hash(path) != source["sha256"]:
                                reasons.append(f"Supporting source changed or is missing: {source['id']}.")
                        except StateError as exc:
                            reasons.append(str(exc))
        try:
            if material["answers"] != self._answer_snapshot(state, list(material["answers"]), application["id"]):
                reasons.append("Application answers changed.")
        except StateError as exc:
            reasons.append(str(exc))
        for document in material["documents"]:
            try:
                path = self.path(document["path"])
                if not path.is_file() or file_hash(path) != document["sha256"]:
                    reasons.append(f"Document changed or is missing: {document['path']}.")
            except StateError as exc:
                reasons.append(str(exc))
        return reasons

    @staticmethod
    def _job_digest(job):
        return digest({key: job.get(key) for key in ("id", "profile_id", "employer", "title", "canonical_url", "jd_text", "requirements")})

    def _approval_result(self, state, application):
        material_id = application.get("current_material_id")
        material = next((item for item in application["materials"] if item["id"] == material_id), None)
        if not material:
            return {"approved": False, "reasons": ["No registered application material."], "application_id": application["id"]}
        reasons = self._material_reasons(state, application, material)
        if self._dossier_changed(state):
            reasons.append("Unresolved dossier edits require reconciliation before application use.")
        approval = next((item for item in reversed(application["approvals"]) if item["material_id"] == material_id), None)
        if not approval:
            reasons.append("This material version has not been approved by the applicant.")
        elif approval.get("decision") == "revoked":
            reasons.append("The applicant revoked approval of this material version: " + approval["reason"])
        elif approval.get("material_digest") != digest(material):
            reasons.append("Registered material changed after approval.")
        return {"approved": not reasons, "reasons": reasons, "application_id": application["id"],
                "material_id": material_id, "approval": approval}

    def check_approval(self, application_id):
        state = self.load()
        return self._approval_result(state, self._application(state, application_id))

    def _invalidate_affected(self, state):
        for application in state["applications"].values():
            if not application.get("approvals"):
                continue
            result = self._approval_result(state, application)
            application["review_required"] = result["reasons"]
            if not result["approved"] and application["status"] in ACTIVE_APPROVAL_STATUSES:
                application["status"] = "awaiting_review"

    def change(self, operation, payload, expected_revision):
        if not isinstance(payload, dict):
            raise StateError("Change payload must be a JSON object.")
        with self._locked():
            current = self.load()
            if type(expected_revision) is not int or expected_revision != current["revision"]:
                raise StateError(f"Revision mismatch: expected {expected_revision}; current {current['revision']}. Reload before editing.")
            if self._dossier_changed(current) and operation != "reconcile-dossier":
                raise StateError("dossier.md was edited or is missing. Review it and use reconcile-dossier before updating records.")
            state = copy.deepcopy(current)
            self._apply(state, operation, copy.deepcopy(payload))
            self._invalidate_affected(state)
            state["revision"] += 1
            state["updated_at"] = utc_now()
            self._commit(state)
            return state

    def _apply(self, state, operation, payload):
        if operation == "fact":
            self._validate_fact(payload, state)
            self._put(state, "facts", payload)
        elif operation in {"facts", "batch-facts"}:
            records = payload.get("records", payload.get("facts"))
            if not isinstance(records, list) or not records:
                raise StateError("facts requires a nonempty records list.")
            for record in records:
                self._record_profile(record)
            ids = [item.get("id") for item in records]
            if len(set(ids)) != len(ids):
                raise StateError("Duplicate fact IDs in one batch.")
            for record in records:
                self._apply(state, "fact", record)
        elif operation == "job":
            for field in ("employer", "title", "jd_text"):
                nonempty(payload.get(field), f"job.{field}")
            if payload.get("canonical_url") is not None and not str(payload["canonical_url"]).startswith(("https://", "http://")):
                raise StateError("canonical_url must be an HTTP(S) URL or null.")
            if not isinstance(payload.get("requirements"), list):
                raise StateError("job.requirements must be a list.")
            self._put(state, "jobs", payload)
        elif operation == "answer":
            for field in ("question", "text"):
                nonempty(payload.get(field), f"answer.{field}")
            if payload.get("scope") not in {"profile", "application"}:
                raise StateError("Answer scope must be profile or application.")
            if payload["scope"] == "application":
                self._application(state, payload.get("application_id"))
            self._fact_revisions(state, payload.get("fact_ids", []))
            if payload.get("status") not in {"draft", "approved"}:
                raise StateError("Answer status must be draft or approved.")
            if payload["status"] == "approved":
                nonempty(payload.get("approval_reference"), "answer.approval_reference")
            self._put(state, "answers", payload)
        elif operation == "preferences":
            if payload.get("profile_id") != self.profile_id or not isinstance(payload.get("values"), dict):
                raise StateError("preferences needs this profile_id and values object.")
            nonempty(payload.get("user_reference"), "preferences.user_reference")
            state["preferences"].update(payload["values"])
            state.setdefault("preference_history", []).append({"values": copy.deepcopy(payload["values"]),
                "user_reference": payload["user_reference"], "recorded_at": utc_now()})
        elif operation == "source":
            self._record_profile(payload)
            if payload["id"] in state["sources"]:
                raise StateError("Sources are immutable; register a new source ID for a changed source.")
            kind = payload.get("kind")
            if kind == "document":
                source = Path(nonempty(payload.get("path"), "source.path")).expanduser()
                if not source.is_file():
                    raise StateError("Source document does not exist.")
                destination_dir = self.path(f"sources/{payload['id']}")
                if destination_dir.exists():
                    raise StateError("Source destination already exists; inspect before retrying.")
                destination_dir.mkdir()
                destination = self.path(f"sources/{payload['id']}/{source.name}")
                shutil.copyfile(source, destination)
                record = {"id": payload["id"], "profile_id": self.profile_id, "kind": kind,
                          "original_path": str(source.absolute()), "stored_path": str(destination.relative_to(self.root)),
                          "sha256": file_hash(destination), "registered_at": utc_now()}
            elif kind in {"web", "user"}:
                record = {"id": payload["id"], "profile_id": self.profile_id, "kind": kind,
                          "reference": nonempty(payload.get("reference"), "source.reference"), "registered_at": utc_now()}
            else:
                raise StateError("source.kind must be document, web, or user.")
            state["sources"][payload["id"]] = record
        elif operation == "application":
            self._record_profile(payload)
            if payload["id"] in state["applications"]:
                raise StateError("Application exists; use materials or status to update it.")
            if payload.get("job_id") not in state["jobs"]:
                raise StateError("Application needs an existing job_id.")
            nonempty(payload.get("selection_reference"), "application.selection_reference")
            self.path(f"applications/{payload['id']}").mkdir(exist_ok=False)
            state["applications"][payload["id"]] = {**payload, "status": "drafting", "materials": [],
                                                     "approvals": [], "events": [], "created_at": utc_now()}
        elif operation == "materials":
            application = self._application(state, payload.get("application_id"))
            identifier = valid_id(payload.get("id"), "material id")
            if any(item["id"] == identifier for item in application["materials"]):
                raise StateError("Material version IDs are immutable.")
            documents = payload.get("documents")
            if not isinstance(documents, list) or len(documents) != 2:
                raise StateError("Register one PDF and one DOCX per material version.")
            checked = []
            kinds = set()
            prefix = Path("applications") / application["id"]
            for item in documents:
                if not isinstance(item, dict):
                    raise StateError("Each document must be an object with path and expected_sha256.")
                relative = Path(nonempty(item.get("path"), "document.path"))
                if not relative.is_relative_to(prefix):
                    raise StateError("Application documents must be stored in this application's directory.")
                path = self.path(relative)
                suffix = path.suffix.lower()
                if suffix not in {".pdf", ".docx"} or not path.is_file() or path.stat().st_size == 0:
                    raise StateError("Documents must be existing nonempty PDF/DOCX files.")
                actual_hash = file_hash(path)
                if item.get("expected_sha256") != actual_hash:
                    raise StateError("Document changed since generation or expected_sha256 is missing.")
                kinds.add(suffix)
                checked.append({"path": str(relative), "sha256": actual_hash, "format": suffix[1:]})
            if kinds != {".pdf", ".docx"}:
                raise StateError("Both PDF and DOCX are required.")
            answer_ids = payload.get("answer_ids", [])
            answers = self._answer_snapshot(state, answer_ids, application["id"])
            document_fact_ids = payload.get("fact_ids", [])
            self._fact_revisions(state, document_fact_ids)
            fact_ids = list(document_fact_ids)
            for answer_id in answer_ids:
                fact_ids.extend(state["answers"][answer_id].get("fact_ids", []))
            fact_revisions = self._fact_revisions(state, list(dict.fromkeys(fact_ids)))
            if not fact_revisions:
                raise StateError("Application documents require supporting fact_ids.")
            expected_facts = payload.get("expected_fact_revisions")
            if not isinstance(expected_facts, dict) or not expected_facts:
                raise StateError("expected_fact_revisions from the document build are required.")
            document_facts = payload.get("fact_ids", [])
            if set(expected_facts) != set(document_facts) or any(fact_revisions.get(key) != value for key, value in expected_facts.items()):
                raise StateError("Document facts changed since generation or expected_fact_revisions is incomplete.")
            job_digest = self._job_digest(state["jobs"][application["job_id"]])
            if payload.get("expected_job_digest") != job_digest:
                raise StateError("Job changed since document generation or expected_job_digest is missing.")
            expected_digests = payload.get("expected_fact_digests")
            if (
                not isinstance(expected_digests, dict) or set(expected_digests) != set(document_facts)
                or any(digest(state["facts"][key]) != value for key, value in expected_digests.items())
            ):
                raise StateError("Document fact contents changed since generation or expected_fact_digests is missing/incomplete.")
            qa = payload.get("qa", {})
            if not isinstance(qa, dict):
                raise StateError("qa must be an object.")
            material = {"id": identifier, "documents": checked, "fact_revisions": fact_revisions,
                        "fact_digests": {key: digest(state["facts"][key]) for key in fact_revisions},
                        "answers": answers, "job_digest": job_digest,
                        "qa": qa, "registered_at": utc_now()}
            application["materials"].append(material)
            application["current_material_id"] = material["id"]
            application["status"] = "awaiting_review"
        elif operation == "approve":
            application = self._application(state, payload.get("application_id"))
            reference = nonempty(payload.get("user_reference"), "approval.user_reference")
            material_id = payload.get("material_id")
            if material_id != application.get("current_material_id"):
                raise StateError("Only the current material version can be approved.")
            material = next(item for item in application["materials"] if item["id"] == material_id)
            reasons = self._material_reasons(state, application, material)
            if reasons:
                raise StateError("Cannot approve stale material: " + "; ".join(reasons))
            if not all(material.get("qa", {}).get(key) is True for key in QA_KEYS):
                raise StateError("Rendered-page, extracted-text, and PDF/DOCX consistency checks are required before approval.")
            nonempty(material["qa"].get("reference"), "qa.reference")
            application["approvals"].append({"material_id": material_id, "material_digest": digest(material),
                                             "decision": "approved", "user_reference": reference, "approved_at": utc_now()})
            application["status"] = "approved"
            application["review_required"] = []
        elif operation == "revoke-approval":
            application = self._application(state, payload.get("application_id"))
            material_id = payload.get("material_id")
            if not any(item["id"] == material_id for item in application["materials"]):
                raise StateError("Unknown material version.")
            reference = nonempty(payload.get("user_reference"), "revocation.user_reference")
            reason = nonempty(payload.get("reason"), "revocation.reason")
            application["approvals"].append({"material_id": material_id, "decision": "revoked",
                                             "reason": reason, "user_reference": reference, "revoked_at": utc_now()})
            application["events"].append({"event": "approval_revoked", "material_id": material_id,
                                           "reason": reason, "user_reference": reference, "at": utc_now()})
            if material_id == application.get("current_material_id") and application["status"] in ACTIVE_APPROVAL_STATUSES:
                application["status"] = "awaiting_review"
        elif operation == "status":
            application = self._application(state, payload.get("application_id"))
            status = payload.get("status")
            if status not in STATUS_VALUES - {"approved"}:
                raise StateError("Invalid status; approved is set only by the approve operation.")
            if status in {"filling", "awaiting_applicant_action"}:
                result = self._approval_result(state, application)
                if not result["approved"]:
                    raise StateError("Current applicant approval is required: " + "; ".join(result["reasons"]))
            evidence = payload.get("evidence")
            if status == "submitted":
                if not isinstance(evidence, dict) or evidence.get("kind") not in {"observed_confirmation", "user_report"}:
                    raise StateError("Submitted requires observed_confirmation or user_report evidence.")
                nonempty(evidence.get("reference"), "submission evidence.reference")
            checkpoint = payload.get("checkpoint")
            if checkpoint is not None:
                if not isinstance(checkpoint, dict):
                    raise StateError("checkpoint must be an object.")
                action = str(checkpoint.get("action_performed", "")).casefold()
                if re.search(r"\b(proceed|next|continue|submit|submission)\b", action) and checkpoint.get("actor") != "user":
                    raise StateError("Only the applicant may perform progression and submission actions.")
                application["checkpoint"] = checkpoint
            application["status"] = status
            application["events"].append({"status": status, "at": utc_now(), "evidence": evidence,
                                           "checkpoint": checkpoint})
        elif operation == "feedback":
            self._record_profile(payload)
            if any(item["id"] == payload["id"] for item in state["feedback"]):
                raise StateError("Feedback ID already exists.")
            if payload.get("kind") not in {"fact_correction", "wording", "formatting", "job_decision"}:
                raise StateError("Invalid feedback kind.")
            nonempty(payload.get("user_reference"), "feedback.user_reference")
            nonempty(payload.get("text"), "feedback.text")
            if payload.get("scope") not in {"application", "profile"}:
                raise StateError("Feedback scope must be application or profile.")
            if payload["scope"] == "application":
                self._application(state, payload.get("application_id"))
            elif payload.get("generalize_explicitly") is not True:
                raise StateError("Profile-wide feedback requires explicit generalization by the applicant.")
            payload["recorded_at"] = utc_now()
            state["feedback"].append(payload)
        elif operation == "search-run":
            self._record_profile(payload)
            if any(item["id"] == payload["id"] for item in state["search_runs"]):
                raise StateError("Search run ID already exists.")
            if not isinstance(payload.get("sources_checked"), list):
                raise StateError("Search run requires sources_checked, including inaccessible sources.")
            payload["recorded_at"] = utc_now()
            state["search_runs"].append(payload)
        elif operation == "reconcile-dossier":
            nonempty(payload.get("user_reference"), "reconciliation.user_reference")
            if payload.get("resolution") not in {"reviewed_no_fact_changes", "import_reviewed_changes"}:
                raise StateError("Explicit dossier reconciliation resolution is required.")
            original = self.path("dossier.md")
            if original.exists():
                destination = self.path(f"reconciliation/dossier-before-revision-{state['revision'] + 1:06d}.md")
                if destination.exists():
                    raise StateError("Reconciliation snapshot already exists.")
                atomic_write(destination, original.read_bytes())
            changes = payload.get("facts", [])
            if changes and payload["resolution"] != "import_reviewed_changes":
                raise StateError("Fact changes require import_reviewed_changes.")
            for fact in changes:
                self._apply(state, "fact", fact)
        else:
            raise StateError(f"Unknown change operation: {operation}")

    def validate(self):
        state = self.load()
        issues = []
        if self._dossier_changed(state):
            issues.append("dossier.md differs from its generated version; reconcile manual edits.")
        for source in state["sources"].values():
            if source["kind"] == "document":
                path = self.path(source["stored_path"])
                if not path.is_file() or file_hash(path) != source["sha256"]:
                    issues.append(f"Stored source changed or is missing: {source['id']}.")
        approvals = {identifier: self._approval_result(state, item) for identifier, item in state["applications"].items()}
        return {"valid": not issues, "profile_id": self.profile_id, "revision": state["revision"],
                "issues": issues, "application_approvals": approvals}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True, help="Selected jobseek data workspace")
    parser.add_argument("--profile", required=True, help="Explicit applicant profile ID")
    subparsers = parser.add_subparsers(dest="command", required=True)
    init = subparsers.add_parser("init")
    init.add_argument("--display-name", required=True)
    subparsers.add_parser("show")
    subparsers.add_parser("validate")
    check = subparsers.add_parser("check-approval")
    check.add_argument("--application", required=True)
    change = subparsers.add_parser("change")
    change.add_argument("operation", choices=("fact", "facts", "batch-facts", "job", "answer", "preferences", "source", "application", "materials", "approve", "revoke-approval", "status", "feedback", "search-run", "reconcile-dossier"))
    change.add_argument("--input", required=True, help="JSON file; - reads stdin")
    change.add_argument("--expected-revision", type=int, required=True)
    args = parser.parse_args(argv)
    try:
        store = JobseekStore(args.workspace, args.profile)
        if args.command == "init":
            result = store.initialize(args.display_name)
        elif args.command == "show":
            result = store.load()
        elif args.command == "validate":
            result = store.validate()
        elif args.command == "check-approval":
            result = store.check_approval(args.application)
        else:
            raw = sys.stdin.read() if args.input == "-" else Path(args.input).read_text()
            result = store.change(args.operation, json.loads(raw), args.expected_revision)
            result = {"profile_id": result["profile_id"], "revision": result["revision"], "operation": args.operation}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.command == "validate" and not result["valid"]:
            return 2
        if args.command == "check-approval" and not result["approved"]:
            return 2
        return 0
    except (StateError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
