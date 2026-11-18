import {
useEffect,
useMemo,
useRef,
useState,
type FormEvent,
type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { PdfViewer } from "@hatch/space-sdk/pdf";
import { api, type ApiResponse } from "./api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";

const FIELDS = actionFields<typeof Actions>();

type Dashboard = ApiResponse<typeof api, "getDashboard">;
type Opening = Dashboard["openings"][number];
type Blocker = Dashboard["blockers"][number];
type Answer = Dashboard["answers"][number];
type LedgerEntry = Dashboard["ledgerEntries"][number];
type PackageDocument = Dashboard["documents"][number];
type StatusEvent = Dashboard["statusEvents"][number];

/** Renders ledger body text: lines starting with "• " become bullets. */
function LedgerBody({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length === 0) return;
    const items = bullets;
    blocks.push(
      <ul key={key} className="list-disc space-y-1 pl-5">
        {items.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  body.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("• ")) {
      bullets.push(t.slice(2));
    } else {
      flush(`ul-${i}`);
      if (t) blocks.push(<p key={`p-${i}`}>{t}</p>);
    }
  });
  flush("ul-end");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-[var(--text)]">
      {blocks}
    </div>
  );
}

function DocumentRow({
  doc,
  onDeleteDocument,
}: {
  doc: PackageDocument;
  onDeleteDocument?: (id: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const file = useQuery({
    queryKey: ["document-file", doc.id],
    queryFn: () => api.getDocumentFile({ id: doc.id }),
    enabled: open,
  });
  const data = file.data;
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--dim)]">
          {doc.kind === "package"
            ? "Package notes"
            : doc.kind === "resume"
              ? "Resume"
              : doc.kind === "cover"
                ? "Cover letter"
                : doc.kind === "plan"
                  ? "Plan"
                  : "Document"}
        </span>
        {doc.versionLabel && (
          <span className="text-[12px] text-[var(--dim)]">{doc.versionLabel}</span>
        )}
        {doc.isCurrent && (
          <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
            current
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "View"} ${doc.label}`}
          className="ml-auto rounded border border-[var(--accent)] px-3 py-1 text-sm font-semibold text-[var(--accent)]"
        >
          {open ? "Hide" : "View"}
        </button>
      </div>
      <p className="mt-1 text-sm font-medium leading-snug text-[var(--text)]">
        {doc.label}
      </p>
      <p className="mt-0.5 break-all text-[12px] text-[var(--dim)]">
        {doc.filename}
      </p>
      {open && (
        <div className="mt-2">
          {file.isPending && (
            <p className="text-sm text-[var(--dim)]">Loading the file…</p>
          )}
          {file.isError && (
            <p className="text-sm text-[var(--red)]">
              The file could not be loaded. It lives in your job-search
              workspace — ask Muse to check it.
            </p>
          )}
          {data && !data.found && (
            <p className="text-sm text-[var(--red)]">
              This file was not found in the job-search workspace
              ({data.filename}). It may have been moved or renamed — ask Muse
              to re-check the package folder.
            </p>
          )}
          {data?.found && data.kind === "text" && (
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] leading-relaxed text-[var(--text)]">
              {data.text}
            </pre>
          )}
          {data?.found && data.kind === "pdf" && data.url && (
            <div>
              <PdfViewer
                src={data.url}
                ariaLabel={doc.label}
                className="w-full rounded border border-[var(--border)]"
              />
              <a
                href={data.url}
                download={data.filename}
                className="mt-2 inline-block text-sm font-semibold text-[var(--accent)] underline"
              >
                Download the PDF
              </a>
            </div>
          )}
          {data?.found && data.kind === "file" && data.url && (
            <p className="text-sm text-[var(--dim)]">
              Word document —{" "}
              <a
                href={data.url}
                download={data.filename}
                className="font-semibold text-[var(--accent)] underline"
              >
                download {data.filename}
              </a>{" "}
              to read or edit it. The PDF version above shows the same content
              in place when one exists.
            </p>
          )}
        </div>
      )}
      {onDeleteDocument && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
              aria-label={`Delete document ${doc.label}`}
              className="text-sm text-[var(--red)] underline"
            >
              Delete document
            </button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--red)]">
                Delete this document?
              </span>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    await onDeleteDocument(doc.id);
                  } catch (error) {
                    setDeleteError(
                      error instanceof Error
                        ? error.message
                        : String(error),
                    );
                    setDeleting(false);
                  }
                }}
                className="rounded bg-[var(--red)] px-3 py-1 font-semibold text-white disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="underline"
              >
                Cancel
              </button>
            </span>
          )}
          {deleteError && (
            <span className="text-sm text-[var(--red)]">{deleteError}</span>
          )}
        </div>
      )}
    </div>
  );
}

function PackageDocuments({
  documents,
  heading,
  onDeleteDocument,
}: {
  documents: PackageDocument[];
  heading?: string;
  onDeleteDocument?: (id: number) => Promise<void>;
}) {
  if (documents.length === 0) return null;
  const groups = new Map<string, PackageDocument[]>();
  for (const d of documents) {
    const list = groups.get(d.packageLabel) ?? [];
    list.push(d);
    groups.set(d.packageLabel, list);
  }
  return (
    <div>
      {heading && <SectionLabel>{heading}</SectionLabel>}
      <div className={heading ? "mt-2 space-y-4" : "space-y-4"}>
        {[...groups.entries()].map(([label, docs]) => (
          <div key={label}>
            <h4 className="text-sm font-semibold text-[var(--text)]">{label}</h4>
            <div className="mt-1.5 space-y-2">
              {docs.map((d) => (
                <DocumentRow
                  key={d.id}
                  doc={d}
                  onDeleteDocument={onDeleteDocument}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PIPELINE = [
  "Researched",
  "Verify-first",
  "Drafting",
  "Awaiting review",
  "Approved",
  "Filling",
  "Awaiting applicant action",
  "Submitted",
  "Responded",
  "Interview",
  "Offer",
] as const;

const ALL_STATUSES = [
  ...PIPELINE,
  "Eligibility hold",
  "Rejection",
  "Withdrawal",
  "Closed",
  "Screened out",
];

const TRACKS = ["Industry", "Academic", "Contractor", "External"] as const;

const ROLE_FAMILIES = [
  "Industry R&D",
  "Staff scientist (academic / government)",
  "Core facilities",
  "Applications / field scientist",
  "Program management",
  "Scientific writing",
  "Tech transfer",
  "Regulatory science",
  "Contractor roles",
  "Government / fellowship",
  "Other science role",
];

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function fmtDate(deadline: string | null): string {
  if (!deadline) return "";
  const d = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function deadlineTone(days: number | null): "red" | "amber" | "plain" {
  if (days === null) return "plain";
  if (days < 0 || days <= 7) return "red";
  if (days <= 21) return "amber";
  return "plain";
}

const WHY_LABELS: Record<string, string> = {
  "stated-reason": "Employer-stated hiring reason",
  context: "Relevant context (connection to this opening not established)",
  inference: "Inference — labeled interpretation",
  unavailable: "Unavailable — no supported explanation found",
};

/** The three fields every searched position must carry: JD, background, reviews. */
function backgroundMissing(opening: Opening): string[] {
  const missing: string[] = [];
  if (!opening.jdSummary) missing.push("JD summary");
  if (!opening.whyText) missing.push("employer background");
  if (!opening.reviewsText) missing.push("employer reviews");
  return missing;
}

function statusStyle(status: string): string {
  switch (status) {
    case "Awaiting review":
      return "bg-[var(--amber-soft)] text-[var(--amber)] border-[var(--amber)]";
    case "Approved":
    case "Offer":
      return "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]";
    case "Eligibility hold":
    case "Rejection":
      return "bg-[var(--red-soft)] text-[var(--red)] border-[var(--red)]";
    case "Submitted":
    case "Responded":
    case "Interview":
      return "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]";
    case "Screened out":
    case "Closed":
    case "Withdrawal":
      return "bg-[var(--surface-alt)] text-[var(--dim)] border-[var(--border)]";
    default:
      return "bg-[var(--surface)] text-[var(--dim)] border-[var(--border)]";
  }
}

/* ---- Application tracker (Tracker tab) ----------------------------------
 * One row per position whose tailored CV has been initiated: tailoring was
 * requested / a package exists, or the opening has moved into the pipeline
 * at Drafting or beyond. The stage shown is the plain-language application
 * stage derived from the opening's suite status; changing it in the tracker
 * writes the matching suite status back through recordStatusEvent. */

const TRACKER_STAGES = [
  "Initiated",
  "Applied",
  "Responded",
  "Interview scheduled",
  "Offer received",
  "Rejected",
  "Withdrawn",
] as const;

type TrackerStage = (typeof TRACKER_STAGES)[number];

/** Suite status -> tracker stage. Pre-submission pipeline states all read
 * as "Initiated" (tailoring started, nothing sent yet). */
function trackerStageFor(status: string): TrackerStage {
  switch (status) {
    case "Submitted":
      return "Applied";
    case "Responded":
      return "Responded";
    case "Interview":
      return "Interview scheduled";
    case "Offer":
      return "Offer received";
    case "Rejection":
      return "Rejected";
    case "Withdrawal":
      return "Withdrawn";
    default:
      return "Initiated";
  }
}

/** Tracker stage -> the suite status written when the stage is changed.
 * "Initiated" writes the earliest in-progress state; an opening already
 * further along the pre-submission pipeline keeps its exact status (the
 * caller skips the write when the stage is unchanged). */
const STAGE_TO_STATUS: Record<TrackerStage, string> = {
  Initiated: "Drafting",
  Applied: "Submitted",
  Responded: "Responded",
  "Interview scheduled": "Interview",
  "Offer received": "Offer",
  Rejected: "Rejection",
  Withdrawn: "Withdrawal",
};

const PRE_SUBMISSION_STATUSES = new Set([
  "Drafting",
  "Awaiting review",
  "Approved",
  "Filling",
  "Awaiting applicant action",
]);

/** Tailoring counts as initiated once a package exists or is recorded, or
 * the opening has entered the pipeline at Drafting or beyond. */
function tailoringInitiated(
  opening: Opening,
  documents: PackageDocument[],
): boolean {
  if (documents.length > 0) return true;
  if (opening.packageVersion) return true;
  return (
    PRE_SUBMISSION_STATUSES.has(opening.status) ||
    opening.status === "Submitted" ||
    opening.status === "Responded" ||
    opening.status === "Interview" ||
    opening.status === "Offer" ||
    opening.status === "Rejection" ||
    opening.status === "Withdrawal"
  );
}

function trackerStageStyle(stage: TrackerStage): string {
  switch (stage) {
    case "Applied":
    case "Responded":
    case "Interview scheduled":
    case "Offer received":
      return "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]";
    case "Rejected":
      return "bg-[var(--red-soft)] text-[var(--red)] border-[var(--red)]";
    case "Withdrawn":
      return "bg-[var(--surface-alt)] text-[var(--dim)] border-[var(--border)]";
    default:
      return "bg-[var(--amber-soft)] text-[var(--amber)] border-[var(--amber)]";
  }
}

function TrackerItem({
  opening,
  documents,
  events,
  expanded,
  onToggle,
}: {
  opening: Opening;
  documents: PackageDocument[];
  events: StatusEvent[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const queryClient = useQueryClient();
  const stage = trackerStageFor(opening.status);
  const days = daysUntil(opening.deadline);
  const [stageNote, setStageNote] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<
    number | null
  >(null);
  const [deleteEventError, setDeleteEventError] = useState<string | null>(
    null,
  );

  const deleteEvent = useMutation({
    mutationFn: async (id: number) =>
      await api.deleteStatusEvent({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmDeleteEventId(null);
      setDeleteEventError(null);
    },
    onError: (error) => {
      setDeleteEventError(error.message);
    },
  });

  const setStage = useMutation({
    mutationFn: async (next: TrackerStage) =>
      await api.recordStatusEvent({
        openingId: opening.id,
        status: STAGE_TO_STATUS[next],
        note: "Stage changed in the dashboard Tracker — no email evidence linked to this change.",
      }),
    onSuccess: (_res, next) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setStageNote(
        next === "Applied"
          ? "Recorded as applied — set this only once the application has actually been submitted."
          : `Stage updated to “${next}”.`,
      );
    },
    onError: () => {
      setStageNote("The stage could not be saved — try again.");
    },
  });

  return (
    <article
      className={`rounded-[var(--radius)] border bg-[var(--surface)] ${
        expanded ? "border-[var(--accent)]" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-snug text-[var(--text)]">
            {opening.title}
          </h3>
          <p className="truncate text-[13px] text-[var(--dim)]">
            {opening.employer}
            {opening.reqId ? ` · ${opening.reqId}` : ""}
            {opening.location ? ` · ${opening.location}` : ""}
          </p>
        </div>
        {opening.deadline && (
          <span
            className={`hidden shrink-0 text-[13px] sm:block ${
              days !== null && days <= 21
                ? "font-semibold text-[var(--red)]"
                : "text-[var(--dim)]"
            }`}
          >
            {fmtDate(opening.deadline)}
          </span>
        )}
        <span
          className={`inline-block shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${trackerStageStyle(stage)}`}
        >
          {stage}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} tracker details for ${opening.title} at ${opening.employer}`}
          className="shrink-0 text-sm font-semibold text-[var(--accent)]"
        >
          {expanded ? "▾ Hide" : "▸ Details"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--text)]">
                Application stage
              </span>
              <select
                aria-label={`Application stage for ${opening.title} at ${opening.employer}`}
                value={stage}
                disabled={setStage.isPending}
                onChange={(e) => {
                  const next = e.target.value as TrackerStage;
                  if (next === stage) return;
                  // Moving back to "Initiated" from a later stage writes
                  // Drafting; within the pre-submission pipeline the exact
                  // status is kept, so no write is needed.
                  if (
                    next === "Initiated" &&
                    PRE_SUBMISSION_STATUSES.has(opening.status)
                  ) {
                    setStageNote(
                      "Already in progress — the exact pipeline status is unchanged.",
                    );
                    return;
                  }
                  setStage.mutate(next);
                }}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]"
              >
                {TRACKER_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <p className="pb-1.5 text-[13px] text-[var(--dim)]">
              Pipeline status:{" "}
              <span className="font-medium text-[var(--text)]">
                {opening.status}
              </span>
              {opening.packageVersion
                ? ` · Package ${opening.packageVersion}`
                : ""}
              {opening.approvalStatus
                ? ` · Approval: ${opening.approvalStatus}`
                : ""}
            </p>
          </div>
          {stageNote && (
            <p className="mt-2 rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[13px] text-[var(--text)]">
              {stageNote}
            </p>
          )}
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Deadline</dt>
              <dd className="text-right font-medium text-[var(--text)]">
                {opening.deadline
                  ? fmtDate(opening.deadline)
                  : (opening.deadlineNote ?? "—")}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">Last checked</dt>
              <dd className="text-right font-medium text-[var(--text)]">
                {opening.lastChecked ?? "—"}
              </dd>
            </div>
          </dl>
          {opening.nextAction && (
            <p className="mt-3 text-sm text-[var(--text)]">
              <span className="font-semibold">Next step:</span>{" "}
              {opening.nextAction}
            </p>
          )}
          {opening.flags && (
            <p className="mt-1 text-[13px] text-[var(--red)]">
              ⚑ {opening.flags}
            </p>
          )}
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              aria-expanded={showEvidence}
              aria-label={`${showEvidence ? "Hide" : "Show"} email evidence for ${opening.title} at ${opening.employer}`}
              className="text-sm font-semibold text-[var(--accent)]"
            >
              {showEvidence ? "▾" : "▸"} Email evidence
              {events.length > 0 ? ` (${events.length})` : ""}
            </button>
            {showEvidence && (
              <div className="mt-2">
                <p className="mb-2 text-[13px] text-[var(--dim)]">
                  Deleting an entry removes the history record only — the
                  current stage stays as-is.
                </p>
                {deleteEventError && (
                  <p className="mb-2 text-sm text-[var(--red)]">
                    {deleteEventError}
                  </p>
                )}
                {events.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-[var(--dim)]">
                    No status change has been recorded with email evidence
                    yet. When a recruiter email drives a change — a reply, an
                    interview invitation, a rejection — Muse records it from your email
                    with the message linked here, so the stage rests on
                    the actual message.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {events.map((e) => {
                      const eStage = trackerStageFor(e.status);
                      const recorded = new Date(e.recordedAt);
                      return (
                        <li
                          key={e.id}
                          className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${trackerStageStyle(eStage)}`}
                            >
                              {eStage}
                            </span>
                            <span className="text-[12px] text-[var(--dim)]">
                              status: {e.status} · recorded{" "}
                              {Number.isNaN(recorded.getTime())
                                ? e.recordedAt
                                : recorded.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                            </span>
                          </div>
                          {e.emailFrom || e.emailSubject || e.emailDate ? (
                            <dl className="mt-1.5 space-y-0.5 text-[13px] leading-relaxed text-[var(--text)]">
                              {e.emailFrom && (
                                <div>
                                  <span className="font-semibold">From:</span>{" "}
                                  {e.emailFrom}
                                </div>
                              )}
                              {e.emailDate && (
                                <div>
                                  <span className="font-semibold">Date:</span>{" "}
                                  {e.emailDate}
                                </div>
                              )}
                              {e.emailSubject && (
                                <div>
                                  <span className="font-semibold">
                                    Subject:
                                  </span>{" "}
                                  {e.emailSubject}
                                </div>
                              )}
                            </dl>
                          ) : (
                            <p className="mt-1 text-[13px] italic text-[var(--dim)]">
                              No email linked to this change.
                            </p>
                          )}
                          {e.note && (
                            <p className="mt-1 text-[13px] text-[var(--dim)]">
                              {e.note}
                            </p>
                          )}
                          <div className="mt-2">
                            {confirmDeleteEventId !== e.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteEventError(null);
                                  setConfirmDeleteEventId(e.id);
                                }}
                                aria-label={`Delete status history entry recorded ${e.recordedAt} for ${opening.title} at ${opening.employer}`}
                                className="text-sm text-[var(--red)] underline"
                              >
                                Delete entry
                              </button>
                            ) : (
                              <span className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-[var(--red)]">
                                  Delete this entry?
                                </span>
                                <button
                                  type="button"
                                  disabled={deleteEvent.isPending}
                                  onClick={() => deleteEvent.mutate(e.id)}
                                  className="rounded bg-[var(--red)] px-3 py-1 font-semibold text-white disabled:opacity-50"
                                >
                                  {deleteEvent.isPending
                                    ? "Deleting…"
                                    : "Yes, delete"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeleteEventId(null)
                                  }
                                  className="underline"
                                >
                                  Cancel
                                </button>
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </div>
          {documents.length > 0 && (
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <PackageDocuments
                documents={documents}
                heading="Tailored package"
              />
            </div>
          )}
          {opening.sourceUrl && (
            <p className="mt-3">
              <a
                href={opening.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-[var(--accent)] underline"
              >
                Open the posting ↗
              </a>
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function TrackerView({ data }: { data: Dashboard }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const docsBySlug = useMemo(() => {
    const map = new Map<string, PackageDocument[]>();
    for (const d of data.documents) {
      const list = map.get(d.openingSlug) ?? [];
      list.push(d);
      map.set(d.openingSlug, list);
    }
    return map;
  }, [data.documents]);

  const tracked = useMemo(
    () =>
      data.openings.filter((o) =>
        tailoringInitiated(o, docsBySlug.get(o.slug) ?? []),
      ),
    [data.openings, docsBySlug],
  );

  /** Status-change history per opening, newest first. */
  const eventsByOpening = useMemo(() => {
    const map = new Map<number, StatusEvent[]>();
    for (const e of data.statusEvents) {
      const list = map.get(e.openingId) ?? [];
      list.push(e);
      map.set(e.openingId, list);
    }
    for (const list of map.values()) list.reverse();
    return map;
  }, [data.statusEvents]);

  const counts = useMemo(() => {
    const map = new Map<TrackerStage, number>();
    for (const o of tracked) {
      const s = trackerStageFor(o.status);
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return TRACKER_STAGES.filter((s) => (map.get(s) ?? 0) > 0).map(
      (s) => ({ stage: s, n: map.get(s) ?? 0 }),
    );
  }, [tracked]);

  return (
    <div>
      <p className="text-sm leading-relaxed text-[var(--dim)]">
        Every position whose tailored CV has been initiated — a package built
        or requested, or the opening already moving through the pipeline —
        with its current application stage. Expand a row for the package,
        deadline, and next step, and to move the stage as things happen
        (applied, responded, interview scheduled, rejected…). Positions join
        this list automatically when tailoring starts from the Board. Status
        changes can rest on recruiter email: Muse monitors your email from chat
        and records each email-driven change with the message linked — open
        a row's “Email evidence” to see the sender, date, and subject behind
        a stage.
      </p>
      {counts.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-2">
          {counts.map(({ stage, n }) => (
            <span
              key={stage}
              className={`inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${trackerStageStyle(stage)}`}
            >
              {stage} · {n}
            </span>
          ))}
        </p>
      )}
      {tracked.length === 0 ? (
        <p className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--dim)]">
          No position has tailoring initiated yet. Use “Create tailored CV /
          resume + cover letter” on a Board card and the position will appear
          here as Initiated.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {tracked.map((o) => (
            <TrackerItem
              key={o.id}
              opening={o}
              documents={docsBySlug.get(o.slug) ?? []}
              events={eventsByOpening.get(o.id) ?? []}
              expanded={expandedId === o.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === o.id ? null : o.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreCell({ opening }: { opening: Opening }) {
  if (opening.coverageScore !== null) {
    return (
      <div className="text-right">
        <div className="font-display tnum text-2xl leading-none text-[var(--text)]">
          {opening.coverageScore}
          <span className="text-sm text-[var(--dim)]">%</span>
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-wide text-[var(--dim)]">
          evidence coverage
          {opening.unknownShare !== null
            ? ` · ${opening.unknownShare}% unknown`
            : ""}
        </div>
        {opening.scorecardScore !== null && (
          <div className="tnum text-[11px] text-[var(--dim)]">
            scorecard {opening.scorecardScore}/100 · legacy{" "}
            {opening.legacyScore ?? "—"}%
          </div>
        )}
      </div>
    );
  }
  if (opening.scorecardScore !== null) {
    return (
      <div className="text-right">
        <div className="font-display tnum text-2xl leading-none text-[var(--text)]">
          {opening.scorecardScore}
          <span className="text-sm text-[var(--dim)]">/100</span>
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-wide text-[var(--dim)]">
          scorecard · legacy {opening.legacyScore ?? "—"}%
        </div>
        <div className="text-[11px] italic text-[var(--dim)]">
          coverage not yet rescored
        </div>
      </div>
    );
  }
  if (opening.legacyScore !== null) {
    return (
      <div className="text-right">
        <div className="font-display tnum text-2xl leading-none text-[var(--text)]">
          ~{opening.legacyScore}
          <span className="text-sm text-[var(--dim)]">%</span>
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-wide text-[var(--dim)]">
          legacy fit (core science)
        </div>
        <div className="text-[11px] italic text-[var(--dim)]">
          coverage not yet rescored
        </div>
      </div>
    );
  }
  return (
    <div className="text-right text-[11px] italic text-[var(--dim)]">
      unscored
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
      {children}
    </h3>
  );
}

function OpeningItem({
  opening,
  documents,
  selected,
  onToggle,
  onOpenReport,
  onRequestResearch,
  onRequestTailor,
  actionNote,
  researchPending,
  tailorPending,
}: {
  opening: Opening;
  documents: PackageDocument[];
  selected: boolean;
  onToggle: () => void;
  onOpenReport: () => void;
  onRequestResearch: () => void;
  onRequestTailor: () => void;
  actionNote: string | null;
  researchPending: boolean;
  tailorPending: boolean;
}) {
  const days = daysUntil(opening.deadline);
  const tone = deadlineTone(days);
  const missing = backgroundMissing(opening);
  const hasPackage = documents.length > 0;
  const canTailor =
    opening.status !== "Closed" && opening.status !== "Screened out";
  const actionBtn =
    "rounded border px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
  return (
    <article
      id={`opening-card-${opening.id}`}
      className={`rounded-[var(--radius)] border bg-[var(--surface)] transition-colors ${
        selected ? "border-[var(--accent)]" : "border-[var(--border)]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={selected}
        aria-label={`${selected ? "Collapse" : "Expand"} ${opening.title} at ${opening.employer} in place`}
        className="block w-full px-4 pt-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle(opening.status)}`}
              >
                {opening.status}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                {opening.track}
                {opening.reqId ? ` · ${opening.reqId}` : ""}
              </span>
            </div>
            <h3 className="font-display mt-2 text-lg leading-snug text-[var(--text)]">
              {opening.title}
            </h3>
            <p className="text-sm text-[var(--dim)]">
              {opening.employer}
              {opening.location ? ` — ${opening.location}` : ""}
            </p>
          </div>
          <ScoreCell opening={opening} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {opening.deadline ? (
            <span
              className={
                tone === "red"
                  ? "font-semibold text-[var(--red)]"
                  : tone === "amber"
                    ? "font-semibold text-[var(--amber)]"
                    : "text-[var(--text)]"
              }
            >
              {fmtDate(opening.deadline)}
              {days !== null &&
                (days < 0
                  ? ` · ${Math.abs(days)}d past`
                  : days === 0
                    ? " · today"
                    : ` · in ${days}d`)}
            </span>
          ) : opening.deadlineNote ? (
            <span className="text-[var(--dim)]">{opening.deadlineNote}</span>
          ) : null}
          {opening.salaryText && (
            <span className="tnum text-[var(--dim)]">{opening.salaryText}</span>
          )}
        </div>
        {opening.nextAction && (
          <p className="mt-2 text-sm text-[var(--text)]">
            <span className="font-semibold">Next:</span> {opening.nextAction}
          </p>
        )}
        {opening.flags && (
          <p className="mt-1 text-[13px] text-[var(--red)]">⚑ {opening.flags}</p>
        )}
      </button>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={onOpenReport}
          aria-label={`View JD and background report for ${opening.title} at ${opening.employer}`}
          className={`${actionBtn} border-[var(--accent)] text-[var(--accent)]`}
        >
          JD & background report
        </button>
        {hasPackage ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={`View the tailored package for ${opening.title} at ${opening.employer}`}
            className={`${actionBtn} border-[var(--border)] text-[var(--text)]`}
          >
            {selected ? "Package shown below" : "View tailored package"}
          </button>
        ) : canTailor ? (
          <button
            type="button"
            onClick={onRequestTailor}
            disabled={tailorPending}
            aria-label={`Create tailored CV, resume and cover letter for ${opening.title} at ${opening.employer}`}
            className={`${actionBtn} border-[var(--border)] text-[var(--text)]`}
          >
            {tailorPending
              ? "Starting…"
              : "Create tailored CV / resume + cover letter"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={selected}
          aria-label={`${selected ? "Collapse" : "Expand"} details for ${opening.title} at ${opening.employer}`}
          className="ml-auto text-sm font-semibold text-[var(--accent)]"
        >
          {selected ? "▾ Hide details" : "▸ Details"}
        </button>
      </div>
      {missing.length > 0 && (
        <p className="mx-4 mb-4 rounded border border-[var(--amber)] bg-[var(--amber-soft)] px-3 py-2 text-[13px] text-[var(--text)]">
          <span className="font-semibold">Background not fully filled:</span>{" "}
          missing {missing.join(", ")}. Every searched position should carry
          all three — open the report to research & fill them.
        </p>
      )}
      {actionNote && (
        <p className="mx-4 mb-4 rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
          {actionNote}
        </p>
      )}
      {selected && (
        <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
          <OpeningDetail
            opening={opening}
            documents={documents}
            onClose={onToggle}
          />
        </div>
      )}
    </article>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1 text-sm leading-relaxed text-[var(--text)]">
        {children ?? (
          <span className="italic text-[var(--dim)]">
            Not filled yet — use “Research & fill the background” in the JD
            & background report, or ask Muse in chat to research it.
          </span>
        )}
      </div>
    </div>
  );
}

function OpeningDetail({
  opening,
  documents,
  onClose,
}: {
  opening: Opening;
  documents: PackageDocument[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  const remove = useMutation({
    mutationFn: async () => await api.deleteOpening({ id: opening.id }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <div aria-label={`Details for ${opening.title}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] leading-relaxed text-[var(--dim)]">
          {opening.roleFamily ? `${opening.roleFamily} · ` : ""}
          Expanded in place — the full record for this position. The same JD,
          background, and reviews are in the “JD & background report.”
          {opening.lastChecked
            ? ` Last checked ${opening.lastChecked}.`
            : ""}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--dim)]"
        >
          ✕ Close
        </button>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <DetailField label="The role (verified JD summary)">
          {opening.jdSummary}
        </DetailField>
        <DetailField label="Employer & position background">
          {opening.whyText && (
            <>
              {opening.whyLabel && (
                <span className="mb-1 inline-block rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-semibold text-[var(--dim)]">
                  {WHY_LABELS[opening.whyLabel] ?? opening.whyLabel}
                </span>
              )}
              <p>{opening.whyText}</p>
            </>
          )}
        </DetailField>
        <DetailField label="Matched — ledger evidence">
          {opening.matched}
        </DetailField>
        <DetailField label="Gaps — not claimed">
          {opening.gaps}
        </DetailField>
        <DetailField label="Employer reviews (Glassdoor / Indeed)">
          {opening.reviewsText}
        </DetailField>
        <DetailField label="Fit note">{opening.fitNote}</DetailField>
      </div>

      {opening.sourceUrl && (
        <p className="mt-4">
          <a
            href={opening.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-[var(--accent)] underline"
          >
            Open the posting ↗
          </a>
        </p>
      )}

      {documents.length > 0 && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <PackageDocuments
            documents={documents}
            heading="Tailored package — resume, cover letter & package notes"
          />
          <p className="mt-2 text-[13px] text-[var(--dim)]">
            Files are read live from the package folder in your job-search
            workspace. Approval covers the exact versions shown here.
          </p>
        </div>
      )}

      <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-3">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-[var(--red)] underline"
          >
            Remove from board
          </button>
        ) : (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-[var(--red)]">Remove this opening?</span>
            <button
              type="button"
              onClick={() => remove.mutate()}
              className="rounded bg-[var(--red)] px-3 py-1 font-semibold text-white"
            >
              Yes, remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="underline"
            >
              Cancel
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

function ReportSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
        {children ?? (
          <span className="italic text-[var(--dim)]">Not filled yet.</span>
        )}
      </div>
    </div>
  );
}

function BackgroundReport({
  opening,
  documents,
  onClose,
  onRequestResearch,
  onRequestTailor,
  onExpand,
  actionNote,
  researchPending,
  tailorPending,
}: {
  opening: Opening;
  documents: PackageDocument[];
  onClose: () => void;
  onRequestResearch: () => void;
  onRequestTailor: () => void;
  onExpand: () => void;
  actionNote: string | null;
  researchPending: boolean;
  tailorPending: boolean;
}) {
  const days = daysUntil(opening.deadline);
  const missing = backgroundMissing(opening);
  const hasPackage = documents.length > 0;
  const canTailor =
    opening.status !== "Closed" && opening.status !== "Screened out";

  // Lock the page behind the dialog while it is open. Without this, a
  // scroll gesture that starts on the backdrop — or chains past the end of
  // the report — scrolls the post list underneath while the report itself
  // stays fixed (the reported bug). The shell scrolls the app inside
  // [data-generated-space-root] (position: fixed; overflow: auto), not the
  // window, so that container is what gets locked; its scroll offset is
  // untouched, so the list is exactly where it was on close. Escape also
  // closes the dialog. onClose is read through a ref so the lock is
  // installed once per dialog, not on every parent re-render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const scroller =
      document.querySelector<HTMLElement>("[data-generated-space-root]") ??
      document.body;
    const prevOverflow = scroller.style.overflow;
    scroller.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      scroller.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`JD and background report for ${opening.title} at ${opening.employer}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius)] bg-[var(--surface)] shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle(opening.status)}`}
              >
                {opening.status}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                {opening.track}
                {opening.roleFamily ? ` · ${opening.roleFamily}` : ""}
                {opening.reqId ? ` · Req ${opening.reqId}` : ""}
              </span>
            </div>
            <h2 className="font-display mt-2 text-2xl leading-tight text-[var(--text)]">
              {opening.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--dim)]">
              {opening.employer}
              {opening.location ? ` — ${opening.location}` : ""}
              {opening.salaryText ? ` · ${opening.salaryText}` : ""}
            </p>
            {opening.deadline ? (
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                Deadline: {fmtDate(opening.deadline)}
                {days !== null &&
                  (days < 0
                    ? ` (${Math.abs(days)} days past)`
                    : ` (in ${days} days)`)}
                {opening.deadlineNote ? ` — ${opening.deadlineNote}` : ""}
              </p>
            ) : opening.deadlineNote ? (
              <p className="mt-1 text-sm text-[var(--dim)]">
                Deadline: {opening.deadlineNote}
              </p>
            ) : null}
            {opening.lastChecked && (
              <p className="text-[12px] text-[var(--dim)]">
                Last checked {opening.lastChecked}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close JD and background report"
            title="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-alt)] text-lg leading-none text-[var(--text)]"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        {missing.length > 0 ? (
          <div className="rounded border border-[var(--amber)] bg-[var(--amber-soft)] px-3 py-3">
            <p className="text-sm text-[var(--text)]">
              <span className="font-semibold">
                This report is incomplete:
              </span>{" "}
              missing {missing.join(", ")}. Every position is supposed to
              carry a filled JD, employer & position background, and employer
              reviews from the moment it is searched.
            </p>
            <button
              type="button"
              onClick={onRequestResearch}
              disabled={researchPending}
              aria-label={`Research and fill the background for ${opening.title} at ${opening.employer}`}
              className="mt-2 rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {researchPending
                ? "Starting research…"
                : "Research & fill the background"}
            </button>
          </div>
        ) : (
          <p className="rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
            JD, employer & position background, and employer reviews are all
            filled for this position.
          </p>
        )}
        {actionNote && (
          <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">
            {actionNote}
          </p>
        )}

        <div className="mt-5 space-y-5">
          <ReportSection label="Job description — verified JD summary">
            {opening.jdSummary}
          </ReportSection>
          <ReportSection label="Employer & position background">
            {opening.whyText && (
              <>
                {opening.whyLabel && (
                  <span className="mb-1 inline-block rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-semibold not-italic text-[var(--dim)]">
                    {WHY_LABELS[opening.whyLabel] ?? opening.whyLabel}
                  </span>
                )}
                <p className="whitespace-pre-wrap">{opening.whyText}</p>
              </>
            )}
          </ReportSection>
          <ReportSection label="Employer reviews (Glassdoor / Indeed)">
            {opening.reviewsText}
          </ReportSection>
          <ReportSection label="Matched — ledger evidence">
            {opening.matched}
          </ReportSection>
          <ReportSection label="Gaps — not claimed">{opening.gaps}</ReportSection>
          <ReportSection label="Fit note">{opening.fitNote}</ReportSection>
          {opening.flags && (
            <ReportSection label="Flags">
              <span className="text-[var(--red)]">{opening.flags}</span>
            </ReportSection>
          )}
        </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3 sm:px-6">
          {opening.sourceUrl && (
            <a
              href={opening.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)]"
            >
              Open the posting ↗
            </a>
          )}
          {hasPackage ? (
            <button
              type="button"
              onClick={onExpand}
              aria-label={`View the tailored package for ${opening.title} at ${opening.employer}`}
              className="rounded border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]"
            >
              View tailored package
            </button>
          ) : canTailor ? (
            <button
              type="button"
              onClick={onRequestTailor}
              disabled={tailorPending}
              aria-label={`Create tailored CV, resume and cover letter for ${opening.title} at ${opening.employer}`}
              className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {tailorPending
                ? "Starting…"
                : "Create tailored CV / resume + cover letter"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-sm text-[var(--dim)] underline"
          >
            Close report
          </button>
        </div>
      </div>
    </div>
  );
}

function AddOpeningForm() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [employer, setEmployer] = useState("");
  const [track, setTrack] = useState<string>("Industry");
  const [roleFamily, setRoleFamily] = useState(ROLE_FAMILIES[0] ?? "");
  const [status, setStatus] = useState<string>("Researched");
  const [reqId, setReqId] = useState("");
  const [location, setLocation] = useState("");
  const [deadline, setDeadline] = useState("");
  const [salary, setSalary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [coverage, setCoverage] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [jdSummary, setJdSummary] = useState("");
  const [whyLabel, setWhyLabel] = useState("unavailable");
  const [whyText, setWhyText] = useState("");
  const [reviewsText, setReviewsText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () =>
      await api.addOpening({
        title,
        employer,
        track,
        roleFamily,
        status,
        reqId: reqId || undefined,
        location: location || undefined,
        deadline: deadline || undefined,
        salaryText: salary || undefined,
        sourceUrl: sourceUrl || undefined,
        coverageScore: coverage === "" ? undefined : Number(coverage),
        nextAction: nextAction || undefined,
        jdSummary: jdSummary || undefined,
        whyLabel: whyText ? whyLabel : undefined,
        whyText: whyText || undefined,
        reviewsText: reviewsText || undefined,
      }),
    onError: (error) => {
      setAddError(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setAddError(null);
      setOpen(false);
      setTitle("");
      setEmployer("");
      setReqId("");
      setLocation("");
      setDeadline("");
      setSalary("");
      setSourceUrl("");
      setCoverage("");
      setNextAction("");
      setJdSummary("");
      setWhyText("");
      setReviewsText("");
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[var(--radius)] border border-dashed border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--accent)]"
      >
        + Add an opening
      </button>
    );
  }

  const inputCls =
    "w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm";
  return (
    <form
      aria-label="Add an opening"
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <h3 className="font-display text-lg text-[var(--text)]">Add an opening</h3>
      <p className="mt-1 text-[13px] text-[var(--dim)]">
        Before adding, check the board (including Screened out) for an existing
        application to the same verified opening — reposts are investigated,
        not merged. Every position is added with its JD summary, employer &
        position background, and employer reviews filled at search time — fill
        the three fields below now, or leave them blank only when genuinely
        not found yet and use “Research & fill the background” on the card
        afterward.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Role title *</span>
          <input {...FIELDS.addOpening.title} aria-label="Role title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Employer *</span>
          <input {...FIELDS.addOpening.employer} aria-label="Employer" value={employer} onChange={(e) => setEmployer(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Track</span>
          <select aria-label="Track" value={track} onChange={(e) => setTrack(e.target.value)} className={inputCls}>
            {TRACKS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Role family (broadened scope)</span>
          <select aria-label="Role family" value={roleFamily} onChange={(e) => setRoleFamily(e.target.value)} className={inputCls}>
            {ROLE_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select aria-label="New opening status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Requisition ID</span>
          <input aria-label="Requisition ID" value={reqId} onChange={(e) => setReqId(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Location</span>
          <input aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Deadline (YYYY-MM-DD)</span>
          <input aria-label="New opening deadline" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="2026-12-19" className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Pay band</span>
          <input aria-label="Pay band" value={salary} onChange={(e) => setSalary(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Evidence coverage % (if scored)</span>
          <input {...FIELDS.addOpening.coverageScore} aria-label="New opening evidence coverage" inputMode="numeric" value={coverage} onChange={(e) => setCoverage(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Official posting URL</span>
          <input aria-label="Official posting URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Next action</span>
          <input aria-label="New opening next action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">JD summary (from the verified official posting)</span>
          <textarea aria-label="New opening JD summary" value={jdSummary} onChange={(e) => setJdSummary(e.target.value)} rows={3} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Background label</span>
          <select aria-label="New opening background label" value={whyLabel} onChange={(e) => setWhyLabel(e.target.value)} className={inputCls}>
            {Object.entries(WHY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {value} — {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Employer & position background (why this role is open — never invent a reason)</span>
          <textarea aria-label="New opening employer and position background" value={whyText} onChange={(e) => setWhyText(e.target.value)} rows={3} className={inputCls} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Employer reviews (Glassdoor / Indeed — rating, % recommend, count, themes, date checked)</span>
          <textarea aria-label="New opening employer reviews" value={reviewsText} onChange={(e) => setReviewsText(e.target.value)} rows={3} className={inputCls} />
        </label>
      </div>
      <div className="mt-3 flex gap-3">
        <button type="submit" disabled={add.isPending} className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {add.isPending ? "Adding…" : "Add opening"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-[var(--dim)] underline">
          Cancel
        </button>
        {addError && <span className="text-sm text-[var(--red)]">{addError}</span>}
      </div>
    </form>
  );
}

function BoardView({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const [trackFilter, setTrackFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showScreened, setShowScreened] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const research = useMutation({
    mutationFn: async (o: Opening) =>
      await api.requestOpeningResearch({ id: o.id }),
    onSuccess: (res, o) => {
      setNotes((prev) => ({
        ...prev,
        [o.id]: res.started
          ? "Background research started — Muse is verifying the JD on the official posting and filling the employer & position background and Glassdoor/Indeed reviews. They will appear in this report once saved."
          : "JD, employer background, and reviews are already filled for this position.",
      }));
    },
    onError: (_err, o) => {
      setNotes((prev) => ({
        ...prev,
        [o.id]: "The research request could not be started — try again, or ask Muse in chat to fill this background.",
      }));
    },
  });

  const tailor = useMutation({
    mutationFn: async (o: Opening) =>
      await api.requestTailoredPackage({ id: o.id }),
    onSuccess: (res, o) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setNotes((prev) => ({
        ...prev,
        [o.id]: res.started
          ? "Tailoring started — Muse is building the tailored CV/resume and cover letter from the ledger (STAR bullets, quantified results, grammar-proof pass). When ready, the opening moves to Awaiting review and the package is attached here for your exact-package approval."
          : "The tailoring request could not be started — try again, or ask Muse in chat to build the package.",
      }));
    },
    onError: (_err, o) => {
      setNotes((prev) => ({
        ...prev,
        [o.id]: "The tailoring request could not be started — try again, or ask Muse in chat to build the package.",
      }));
    },
  });

  const [researchAllNote, setResearchAllNote] = useState<string | null>(null);
  const researchAll = useMutation({
    mutationFn: async () => await api.requestAllMissingBackgrounds({}),
    onSuccess: (res) => {
      setResearchAllNote(
        res.started
          ? `Research started for ${res.count} incomplete opening${res.count === 1 ? "" : "s"} — Muse is verifying each JD on the official posting and filling the employer background and Glassdoor/Indeed reviews. Cards update as each one is saved.`
          : "Every opening already has its JD, background, and reviews filled.",
      );
    },
    onError: () => {
      setResearchAllNote(
        "The research request could not be started — try again, or ask Muse in chat to fill the missing backgrounds.",
      );
    },
  });

  /** Jump straight to a card: clear filters, expand it in place, scroll to it. */
  const jumpTo = (id: number | null) => {
    if (id === null) return;
    setTrackFilter("All");
    setSearch("");
    setSelectedId(id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById(`opening-card-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const reportOpening =
    reportId === null
      ? null
      : (data.openings.find((o) => o.id === reportId) ?? null);

  // Closed and expired (deadline already past) positions are off the board.
  const visible = useMemo(
    () =>
      data.openings.filter((o) => {
        if (o.status === "Closed") return false;
        const d = daysUntil(o.deadline);
        return !(d !== null && d < 0);
      }),
    [data.openings],
  );
  const active = useMemo(
    () => visible.filter((o) => o.status !== "Screened out"),
    [visible],
  );
  const screened = useMemo(
    () => visible.filter((o) => o.status === "Screened out"),
    [visible],
  );

  const withDeadlines = useMemo(
    () =>
      active
        .filter((o) => o.deadline)
        .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? "")),
    [active],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return active.filter((o) => {
      if (trackFilter !== "All" && o.track !== trackFilter) return false;
      if (!q) return true;
      return (
        o.title.toLowerCase().includes(q) ||
        o.employer.toLowerCase().includes(q) ||
        (o.reqId ?? "").toLowerCase().includes(q)
      );
    });
  }, [active, trackFilter, search]);

  const byStatus = useMemo(() => {
    const groups = new Map<string, Opening[]>();
    for (const s of ALL_STATUSES) groups.set(s, []);
    for (const o of filtered) {
      const list = groups.get(o.status) ?? [];
      list.push(o);
      groups.set(o.status, list);
    }
    return [...groups.entries()].filter(([, list]) => list.length > 0);
  }, [filtered]);

  const urgentList = withDeadlines.filter((o) => {
    const d = daysUntil(o.deadline);
    return d !== null && d >= 0 && d <= 21;
  });
  const urgentCount = urgentList.length;
  const awaitingList = active.filter((o) => o.status === "Awaiting review");
  const awaiting = awaitingList.length;
  const holdsList = active.filter((o) => o.status === "Eligibility hold");
  const holds = holdsList.length;
  const incompleteCount = active.filter(
    (o) => backgroundMissing(o).length > 0,
  ).length;

  const statBoxes: {
    n: number;
    label: string;
    target: Opening | undefined;
    targetDesc: string;
  }[] = [
    {
      n: active.length,
      label: "openings tracked",
      target: active[0],
      targetDesc: "first tracked opening",
    },
    {
      n: awaiting,
      label: "in awaiting-review status",
      target: awaitingList[0],
      targetDesc: "first opening awaiting review",
    },
    {
      n: urgentCount,
      label: "deadlines within 21 days",
      target: urgentList[0],
      targetDesc: "nearest deadline within 21 days",
    },
    {
      n: holds,
      label: "on eligibility hold",
      target: holdsList[0],
      targetDesc: "first opening on eligibility hold",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statBoxes.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={!s.target}
            onClick={() => jumpTo(s.target?.id ?? null)}
            aria-label={
              s.target
                ? `Go to ${s.targetDesc}: ${s.target.title} at ${s.target.employer}`
                : `${s.n} ${s.label} — none to jump to`
            }
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-center transition-colors hover:border-[var(--accent)] disabled:cursor-default disabled:opacity-60 disabled:hover:border-[var(--border)]"
          >
            <div className="font-display tnum text-3xl text-[var(--text)]">{s.n}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wide text-[var(--dim)]">
              {s.label}
            </div>
            {s.target && (
              <div className="mt-1 text-[11px] font-semibold text-[var(--accent)]">
                Jump to post ↓
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed text-[var(--text)]">
        <p>
          <span className="font-semibold">JD & background coverage:</span>{" "}
          {active.length - incompleteCount} of {active.length} openings have
          the JD summary, employer & position background, and employer
          reviews all filled — the standard for every position when it is
          searched. Every position on this board must be fully researched;
          anything still missing is flagged on its card.
        </p>
        {incompleteCount > 0 && (
          <button
            type="button"
            onClick={() => researchAll.mutate()}
            disabled={researchAll.isPending}
            aria-label={`Research and fill the missing JD, background and reviews for all ${incompleteCount} incomplete openings`}
            className="mt-2 rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {researchAll.isPending
              ? "Starting research…"
              : `Research & fill all ${incompleteCount} incomplete opening${incompleteCount === 1 ? "" : "s"}`}
          </button>
        )}
        {researchAllNote && (
          <p className="mt-2 text-[var(--text)]">{researchAllNote}</p>
        )}
      </div>

      {withDeadlines.length > 0 && (
        <section
          aria-label="Upcoming deadlines"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <SectionLabel>Deadlines — nearest first</SectionLabel>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {withDeadlines.map((o) => {
              const d = daysUntil(o.deadline);
              const tone = deadlineTone(d);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTrackFilter("All");
                      setSearch("");
                      setSelectedId(o.id);
                      requestAnimationFrame(() => {
                        document
                          .getElementById(`opening-card-${o.id}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                    aria-label={`Deadline details for ${o.title} at ${o.employer}`}
                    className="flex w-full items-baseline justify-between gap-3 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--text)]">
                        {o.employer} — {o.title}
                      </span>
                      {o.deadlineNote && (
                        <span className="block text-[12px] text-[var(--dim)]">
                          {o.deadlineNote}
                        </span>
                      )}
                    </span>
                    <span
                      className={`tnum shrink-0 text-sm font-semibold ${
                        tone === "red"
                          ? "text-[var(--red)]"
                          : tone === "amber"
                            ? "text-[var(--amber)]"
                            : "text-[var(--text)]"
                      }`}
                    >
                      {fmtDate(o.deadline)}
                      {d !== null &&
                        (d < 0 ? ` · ${Math.abs(d)}d past` : d === 0 ? " · today" : ` · ${d}d`)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by track">
          {["All", ...TRACKS].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTrackFilter(t)}
              aria-pressed={trackFilter === t}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                trackFilter === t
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          aria-label="Search openings"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, employer, req…"
          className="min-w-44 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>

      {byStatus.length === 0 && (
        <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--dim)]">
          No openings match this filter.
        </p>
      )}

      {byStatus.map(([status, list]) => (
        <section key={status} aria-label={`Openings with status ${status}`}>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="font-display text-xl text-[var(--text)]">{status}</h2>
            <span className="tnum text-sm text-[var(--dim)]">{list.length}</span>
          </div>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {list.map((o) => (
              <div
                key={o.id}
                className={o.id === selectedId ? "lg:col-span-2" : ""}
              >
                <OpeningItem
                  opening={o}
                  documents={data.documents.filter(
                    (d) => d.openingSlug === o.slug,
                  )}
                  selected={o.id === selectedId}
                  onToggle={() =>
                    setSelectedId(o.id === selectedId ? null : o.id)
                  }
                  onOpenReport={() => setReportId(o.id)}
                  onRequestResearch={() => research.mutate(o)}
                  onRequestTailor={() => tailor.mutate(o)}
                  actionNote={notes[o.id] ?? null}
                  researchPending={
                    research.isPending && research.variables?.id === o.id
                  }
                  tailorPending={
                    tailor.isPending && tailor.variables?.id === o.id
                  }
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <AddOpeningForm />

      <section aria-label="Screened out openings">
        <button
          type="button"
          onClick={() => setShowScreened((v) => !v)}
          aria-expanded={showScreened}
          className="flex items-baseline gap-2 text-left"
        >
          <h2 className="font-display text-xl text-[var(--text)]">
            Screened out — do not resurface
          </h2>
          <span className="tnum text-sm text-[var(--dim)]">{screened.length}</span>
          <span className="text-sm text-[var(--accent)]">
            {showScreened ? "Hide" : "Show"}
          </span>
        </button>
        {showScreened && (
          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            {screened.map((o) => (
              <div
                key={o.id}
                className={o.id === selectedId ? "lg:col-span-2" : ""}
              >
                <OpeningItem
                  opening={o}
                  documents={data.documents.filter(
                    (d) => d.openingSlug === o.slug,
                  )}
                  selected={o.id === selectedId}
                  onToggle={() =>
                    setSelectedId(o.id === selectedId ? null : o.id)
                  }
                  onOpenReport={() => setReportId(o.id)}
                  onRequestResearch={() => research.mutate(o)}
                  onRequestTailor={() => tailor.mutate(o)}
                  actionNote={notes[o.id] ?? null}
                  researchPending={
                    research.isPending && research.variables?.id === o.id
                  }
                  tailorPending={
                    tailor.isPending && tailor.variables?.id === o.id
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {reportOpening && (
        <BackgroundReport
          opening={reportOpening}
          documents={data.documents.filter(
            (d) => d.openingSlug === reportOpening.slug,
          )}
          onClose={() => setReportId(null)}
          onRequestResearch={() => research.mutate(reportOpening)}
          onRequestTailor={() => tailor.mutate(reportOpening)}
          onExpand={() => {
            setSelectedId(reportOpening.id);
            setReportId(null);
            requestAnimationFrame(() => {
              document
                .getElementById(`opening-card-${reportOpening.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
          actionNote={notes[reportOpening.id] ?? null}
          researchPending={
            research.isPending && research.variables?.id === reportOpening.id
          }
          tailorPending={
            tailor.isPending && tailor.variables?.id === reportOpening.id
          }
        />
      )}
    </div>
  );
}

function WorkflowView({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const [wipeText, setWipeText] = useState("");
  const [wipeResult, setWipeResult] = useState<{
    openings: number;
    ledgerEntries: number;
    documents: number;
    statusEvents: number;
    blockers: number;
    answers: number;
  } | null>(null);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const wipe = useMutation({
    mutationFn: async () => await api.wipeAllData({ confirm: true }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setWipeResult(res);
      setWipeError(null);
      setWipeText("");
    },
    onError: (error) => {
      setWipeError(error.message);
      setWipeResult(null);
    },
  });
  const stages = [
    {
      n: "1",
      name: "Career ledger",
      text: "One evidence-backed ledger (LEDGER.md) is the master source. Only user-attested or confirmed facts are usable for matching and drafting; pending, conflicted, and retired facts are not. Nothing enters a tailored document unless it is in the ledger or you confirm it.",
    },
    {
      n: "2",
      name: "Broad discovery",
      text: "Searches span job boards, employer career sites, USAJOBS and government portals, universities and institutes, and specialist boards — deduplicated, with sources checked and coverage gaps recorded. New scope: any science role family you can realistically get, not Scientist titles only.",
    },
    {
      n: "3",
      name: "Evidence coverage + employer research",
      text: "Each JD's requirements are grouped into competencies and credited Direct (1), Transferable (0.5), Unknown (0), or Gap (0); required ×2, preferred ×1. Coverage % is the headline score, with the weighted Unknown share beside it. Eligibility, location, start date, and deadline are flags — never inside the number. ≥30% enters the ranked shortlist; you select what to pursue. At search time, every position also gets its verified JD summary, employer & position background (labeled), and Glassdoor/Indeed employer reviews filled — all three are readable from the “JD & background report” button on each card, and any gap can be researched & filled from that report.",
    },
    {
      n: "4",
      name: "Tailored materials",
      text: "Industry = 2-page resume; academic = full CV; bullets in STAR with quantified results from the ledger; cover letters science-precise, no generic phrasing. Every document uses the one adopted clean style (templates/FORMAT-STANDARD.md — Harvard/UPenn-benchmarked: Times New Roman, right-aligned dates, title-first role lines with italic institutions, hanging-indent publications, grouped skills, no tagline). DOCX and PDF are generated from the same content and page-checked before review — format is judged on the PDF render, since the in-app DOCX preview substitutes a sans-serif font for Times New Roman.",
    },
    {
      n: "5",
      name: "Exact-package approval",
      text: "You review the exact JD + tailored CV + cover letter + employer background together. Approval is recorded per package (JD, document versions, fact revisions, answer set). Silence is not approval, and approval for one opening never transfers to another.",
    },
    {
      n: "6",
      name: "Apply assist, page by page",
      text: "Forms are filled and verified page by page with checkpoints. You click every Next / Continue / Submit and handle authentication, signatures, and consent. A submission is recorded only from an observed confirmation or your own report — a filled form is not a submission.",
    },
    {
      n: "7",
      name: "Tracking & the Monday refresh",
      text: "Statuses follow the suite states; interview / offer / rejection / withdrawal / closure are recorded only from actual events or your reports. The Monday refresh re-verifies tracked postings, searches for new openings across all tracks, scores them, and flags deadlines within 21 days.",
    },
  ];
  return (
    <div className="space-y-5">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h2 className="font-display text-2xl text-[var(--text)]">
          The integrated workflow
        </h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Your jobseek-skills suite merged
          with the Muse setup — the goal is any science career out of the
          postdoc, not a scientist title specifically.
        </p>
        <ol className="mt-4 space-y-4">
          {stages.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--accent)] text-[var(--accent)]">
                {s.n}
              </span>
              <div>
                <h3 className="font-semibold text-[var(--text)]">{s.name}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--dim)]">
                  {s.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <SectionLabel>Format standard, platform note, and spec version</SectionLabel>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-[var(--text)]">
          <p>
            <span className="font-semibold">Rejected improvements:</span>{" "}
            five content/format improvements trialled during the reference
            build (a page-2 footer, “(n of N)” pagination, a bulleted
            summary, award selectivity notes, and a folded in-preparation
            publications section) were adopted and then dropped the same
            day after careful review. They are not part of the format
            standard and must not be re-applied.
          </p>
          <p>
            <span className="font-semibold">Platform note:</span> this
            build runs on Muse — research and tailoring requests start a
            background agent task from the dashboard, and the task saves
            its results back through the dashboard's actions. (On ChatGPT
            Sites the same requests are queued and executed in chat
            instead; a build must state the behaviour actually in effect
            on its platform.)
          </p>
          <p>
            <span className="font-semibold">Spec version:</span> this
            build was made against version 2.0.2 of the Job Search
            Dashboard specification (dashboard/SPEC.md §12).
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <SectionLabel>Adopted from your jobseek-skills repo — gaps it closed</SectionLabel>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--text)]">
            <li>Evidence coverage is now the headline fit score (the /100 scorecard is secondary context) — resolving the Nov 13 conflict over whether eligibility sits inside the score. It doesn't: flags live outside the number.</li>
            <li>Ledger fact statuses: only user-attested / confirmed facts are usable; pending and conflicted ledger items stay visibly unusable.</li>
            <li>Exact-package approval records, an answer bank, and feedback classified as fact / wording / job-specific inclusion.</li>
            <li>Employer research labeled stated-reason / context / inference / unavailable — visible on every opening's detail.</li>
            <li>Apply-assist protocol with page checkpoints, and submission recorded only from observed confirmation.</li>
            <li>Duplicate-application checks and the suite status vocabulary used across this board.</li>
          </ul>
        </section>
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <SectionLabel>Kept from the Muse setup — what it does better</SectionLabel>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--text)]">
            <li>Glassdoor + Indeed employer reviews in every package background (the repo has no employer-review step) — see the review flag on an opening's card.</li>
            <li>The Monday weekly refresh with 21-day deadline flags; the repo's tracker explicitly creates no reminders or scheduled searches.</li>
            <li>Live JD verification on official careers pages before any tailoring; aggregators are leads only.</li>
            <li>Eligibility flags from the applicant profile on contractor roles — for example a site or employer-type restriction recorded as a profile constraint.</li>
            <li>Quantified-STAR ledger discipline — numbers are applicant-attested, pending figures are never promoted.</li>
            <li>This dashboard itself: the repo's state lives in local files; here the board, blockers, and answer bank are in the app, on your phone.</li>
          </ul>
        </section>
      </div>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <SectionLabel>Scope — role families in play</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROLE_FAMILIES.map((f) => (
            <span
              key={f}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1 text-sm text-[var(--text)]"
            >
              {f}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
          Preferences on record (sample profile): PhD-level roles, no title
          restriction; Boston area preferred; on-site, hybrid, and remote
          all acceptable; salary judged against each posting's range;
          earliest start to be confirmed with the current institution;
          stage is market exploration, so eligibility is tracked as a
          flag, not a screening input.
        </p>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h2 className="font-display text-xl text-[var(--text)]">
          Data controls
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
          Wipe all data empties every table in this dashboard. This is{" "}
          <span className="font-semibold">irreversible</span> — there is
          no undo. Its purpose is clearing the sample data before loading
          real data.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
          This will remove:{" "}
          <span className="tnum font-medium text-[var(--text)]">
            {data.openings.length}
          </span>{" "}
          openings,{" "}
          <span className="tnum font-medium text-[var(--text)]">
            {data.ledgerEntries.length}
          </span>{" "}
          ledger entries,{" "}
          <span className="tnum font-medium text-[var(--text)]">
            {data.documents.length}
          </span>{" "}
          documents,{" "}
          <span className="tnum font-medium text-[var(--text)]">
            {data.statusEvents.length}
          </span>{" "}
          status events,{" "}
          <span className="tnum font-medium text-[var(--text)]">
            {data.blockers.length}
          </span>{" "}
          blockers, and{" "}
          <span className="tnum font-medium text-[var(--text)]">
            {data.answers.length}
          </span>{" "}
          answers.
        </p>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium text-[var(--text)]">
            Type WIPE to confirm
          </span>
          <input
            aria-label="Type WIPE to confirm wipe"
            value={wipeText}
            onChange={(e) => setWipeText(e.target.value)}
            placeholder="WIPE"
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)] sm:max-w-xs"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={wipeText !== "WIPE" || wipe.isPending}
            onClick={() => wipe.mutate()}
            className="rounded bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {wipe.isPending ? "Wiping…" : "Wipe all data"}
          </button>
          {wipeError && (
            <span className="text-sm text-[var(--red)]">{wipeError}</span>
          )}
        </div>
        {wipeResult && (
          <p className="mt-3 rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm leading-relaxed text-[var(--text)]">
            Wipe complete — removed{" "}
            <span className="tnum">{wipeResult.openings}</span> openings,{" "}
            <span className="tnum">{wipeResult.ledgerEntries}</span>{" "}
            ledger entries,{" "}
            <span className="tnum">{wipeResult.documents}</span>{" "}
            documents,{" "}
            <span className="tnum">{wipeResult.statusEvents}</span>{" "}
            status events,{" "}
            <span className="tnum">{wipeResult.blockers}</span>{" "}
            blockers, and{" "}
            <span className="tnum">{wipeResult.answers}</span> answers.
          </p>
        )}
      </section>
    </div>
  );
}

function BlockerCard({ blocker }: { blocker: Blocker }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: async () =>
      await api.setBlockerStatus({
        id: blocker.id,
        status: blocker.status === "open" ? "resolved" : "open",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
  const remove = useMutation({
    mutationFn: async () => await api.deleteBlocker({ id: blocker.id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`font-display text-lg leading-snug ${
            blocker.status === "resolved"
              ? "text-[var(--dim)] line-through"
              : "text-[var(--text)]"
          }`}
        >
          {blocker.title}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle(
            blocker.status === "open" ? "Eligibility hold" : "Approved",
          )}`}
        >
          {blocker.status}
        </span>
      </div>
      {blocker.detail && (
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {blocker.detail}
        </p>
      )}
      <div className="mt-3 flex gap-4 text-sm">
        <button
          type="button"
          onClick={() => toggle.mutate()}
          className="font-semibold text-[var(--accent)] underline"
        >
          {blocker.status === "open" ? "Mark resolved" : "Reopen"}
        </button>
        <button
          type="button"
          onClick={() => remove.mutate()}
          className="text-[var(--red)] underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AnswerCard({ answer }: { answer: Answer }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(answer.answer);
  const [note, setNote] = useState(answer.note ?? "");
  const save = useMutation({
    mutationFn: async () =>
      await api.updateAnswer({
        id: answer.id,
        answer: text,
        note: note || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: async () => await api.deleteAnswer({ id: answer.id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg leading-snug text-[var(--text)]">
          {answer.question}
        </h3>
        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-semibold text-[var(--dim)]">
          {answer.scope}
          {answer.jobLabel ? ` · ${answer.jobLabel}` : ""}
        </span>
      </div>
      {!editing ? (
        <>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
            {answer.answer}
          </p>
          {answer.note && (
            <p className="mt-1 text-[13px] italic text-[var(--dim)]">{answer.note}</p>
          )}
          <div className="mt-3 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-semibold text-[var(--accent)] underline"
            >
              Edit answer
            </button>
            <button
              type="button"
              onClick={() => remove.mutate()}
              className="text-[var(--red)] underline"
            >
              Delete
            </button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium">Answer</span>
            <textarea
              {...FIELDS.updateAnswer.answer}
              aria-label={`Answer for ${answer.question}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-2"
            />
          </label>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium">Note (scope, evidence)</span>
            <textarea
              aria-label={`Note for ${answer.question}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-2"
            />
          </label>
          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-[var(--dim)] underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const FACT_STATUSES = ["user-attested", "confirmed", "pending", "conflicted", "retired"];

function factStatusStyle(status: string): string {
  switch (status) {
    case "user-attested":
    case "confirmed":
      return "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]";
    case "pending":
      return "bg-[var(--amber-soft)] text-[var(--amber)] border-[var(--amber)]";
    default:
      return "bg-[var(--red-soft)] text-[var(--red)] border-[var(--red)]";
  }
}

function LedgerEntryCard({ entry }: { entry: LedgerEntry }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [section, setSection] = useState(entry.section);
  const [body, setBody] = useState(entry.body);
  const [factStatus, setFactStatus] = useState(entry.factStatus);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () =>
      await api.updateLedgerEntry({
        id: entry.id,
        section,
        body,
        factStatus,
      }),
    onError: (error) => {
      setSaveError(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSaveError(null);
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: async () => await api.deleteLedgerEntry({ id: entry.id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
  const inputCls =
    "w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm";
  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-lg leading-snug text-[var(--text)]">
          {entry.section}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${factStatusStyle(entry.factStatus)}`}
          >
            {entry.factStatus}
          </span>
          {entry.sourceRef && (
            <span className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
              {entry.sourceRef}
            </span>
          )}
        </div>
      </div>
      {!editing ? (
        <>
          <div className="mt-2">
            <LedgerBody body={entry.body} />
          </div>
          <div className="mt-3 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-semibold text-[var(--accent)] underline"
            >
              Edit section
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-[var(--red)] underline"
              >
                Delete
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-[var(--red)]">Delete this section?</span>
                <button
                  type="button"
                  onClick={() => remove.mutate()}
                  className="rounded bg-[var(--red)] px-2 py-0.5 font-semibold text-white"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="underline"
                >
                  Cancel
                </button>
              </span>
            )}
          </div>
        </>
      ) : (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium">Section title</span>
            <input
              {...FIELDS.updateLedgerEntry.section}
              aria-label={`Section title for ${entry.section}`}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium">
              Content (start a line with “• ” for a bullet)
            </span>
            <textarea
              {...FIELDS.updateLedgerEntry.body}
              aria-label={`Content for ${entry.section}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className={inputCls}
            />
          </label>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium">Fact status</span>
            <select
              aria-label={`Fact status for ${entry.section}`}
              value={factStatus}
              onChange={(e) => setFactStatus(e.target.value)}
              className={inputCls}
            >
              {FACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-[var(--dim)] underline"
            >
              Cancel
            </button>
            {saveError && (
              <span className="text-sm text-[var(--red)]">{saveError}</span>
            )}
          </div>
        </form>
      )}
    </article>
  );
}

const CV_CATEGORIES = [
  "Profile",
  "Experience — STAR inventory",
  "Skills — keyword bank",
  "Publications & scholarly record",
  "Constraints & preferences",
  "Search rules & status",
];

function MasterCvView({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [section, setSection] = useState("");
  const [category, setCategory] = useState(CV_CATEGORIES[0] ?? "Profile");
  const [body, setBody] = useState("");
  const [factStatus, setFactStatus] = useState("user-attested");
  const [addError, setAddError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () =>
      await api.addLedgerEntry({ section, category, body, factStatus }),
    onError: (error) => {
      setAddError(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setAddError(null);
      setFormOpen(false);
      setSection("");
      setBody("");
    },
  });

  const q = search.trim().toLowerCase();
  const entries = data.ledgerEntries.filter(
    (e) =>
      !q ||
      e.section.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q),
  );
  const categories = [
    ...CV_CATEGORIES,
    ...entries
      .map((e) => e.category)
      .filter((c) => !CV_CATEGORIES.includes(c)),
  ].filter(
    (c, i, arr) =>
      arr.indexOf(c) === i && entries.some((e) => e.category === c),
  );

  const inputCls =
    "w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm";

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h2 className="font-display text-2xl text-[var(--text)]">
          Master CV — the full ledger
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          Everything in the ledger (LEDGER.md),
          fully displayed: contact, education, every position with its full
          STAR bullets, the complete skills bank, publications, awards,
          presentations, mentoring, and references. This is the
          master source every tailored resume and cover letter is built from —
          check here what you have before anything is drafted.
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["User-attested", "Explicitly supplied by you — usable for matching and drafting."],
            ["Confirmed", "Extracted from a source and reviewed by you — usable."],
            ["Pending", "Imported, awaiting your confirmation — NOT usable. Records still awaiting confirmation sit here."],
            ["Conflicted / retired", "Contradictory or superseded — NOT usable until resolved."],
          ].map(([t, d]) => (
            <div key={t} className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <span className="font-semibold text-[var(--text)]">{t}:</span>{" "}
              <span className="text-[var(--dim)]">{d}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm leading-relaxed text-[var(--text)]">
          <span className="font-semibold">Adding to your ledger:</span> in
          chat, just say “add … to my ledger.” Muse will ask you for the
          details needed to write it as a full STAR entry (situation/task,
          action, quantified result) before filing it — a bare note is never
          filed when the item needs STAR detail. You can also add or edit a
          section directly below.
        </p>
        <input
          aria-label="Search the master CV"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the full CV — e.g. a method, a journal, a skill…"
          className="mt-3 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </section>

      {data.documents.some((d) => d.openingSlug === "master-cv") && (
        <section
          aria-label="Master CV file"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
        >
          <h2 className="font-display text-xl text-[var(--text)]">
            The master CV file — download
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
            The full master CV as a finished document, in the one adopted
            clean style (Harvard/UPenn-benchmarked: Times New Roman,
            right-aligned dates, title-first role lines with italic
            institutions, hanging-indent publications, grouped skills — see
            templates/FORMAT-STANDARD.md). Judge the format by this PDF
            render or the downloaded file opened in Word: the in-app DOCX
            preview substitutes a sans-serif font for Times New Roman, so it
            does not show the real format.
          </p>
          <div className="mt-3">
            <PackageDocuments
              documents={data.documents.filter(
                (d) => d.openingSlug === "master-cv",
              )}
            />
          </div>
        </section>
      )}

      {entries.length === 0 && (
        <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--dim)]">
          {data.ledgerEntries.length === 0
            ? "The master CV has not been loaded into the dashboard yet — ask Muse to sync the ledger."
            : "No sections match this search."}
        </p>
      )}

      {categories.map((cat) => (
        <section key={cat} aria-label={`Master CV — ${cat}`}>
          <h2 className="font-display mb-2 text-xl text-[var(--text)]">{cat}</h2>
          <div className="space-y-3">
            {entries
              .filter((e) => e.category === cat)
              .map((e) => (
                <LedgerEntryCard key={e.id} entry={e} />
              ))}
          </div>
        </section>
      ))}

      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="w-full rounded-[var(--radius)] border border-dashed border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--accent)]"
        >
          + Add a ledger section
        </button>
      ) : (
        <form
          aria-label="Add a ledger section"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <h3 className="font-display text-lg text-[var(--text)]">
            Add a ledger section
          </h3>
          <p className="mt-1 text-[13px] text-[var(--dim)]">
            For experience items, write the content as STAR bullets: start
            each line with “• ”, give the situation/task, your action, and the
            quantified result.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Section title *</span>
              <input {...FIELDS.addLedgerEntry.section} aria-label="New ledger section title" value={section} onChange={(e) => setSection(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Category</span>
              <select aria-label="New ledger section category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {CV_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Fact status</span>
              <select aria-label="New ledger section fact status" value={factStatus} onChange={(e) => setFactStatus(e.target.value)} className={inputCls}>
                {FACT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Content *</span>
              <textarea {...FIELDS.addLedgerEntry.body} aria-label="New ledger section content" value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={inputCls} />
            </label>
          </div>
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={add.isPending} className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {add.isPending ? "Adding…" : "Add section"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="text-sm text-[var(--dim)] underline">
              Cancel
            </button>
            {addError && <span className="text-sm text-[var(--red)]">{addError}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function LedgerView({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const deleteDocument = useMutation({
    mutationFn: async (id: number) =>
      await api.deleteDocument({ id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
  const [bTitle, setBTitle] = useState("");
  const [bDetail, setBDetail] = useState("");
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [scope, setScope] = useState("universal");
  const [jobLabel, setJobLabel] = useState("");

  const addBlocker = useMutation({
    mutationFn: async () =>
      await api.addBlocker({ title: bTitle, detail: bDetail || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setBTitle("");
      setBDetail("");
    },
  });
  const addAnswer = useMutation({
    mutationFn: async () =>
      await api.addAnswer({
        question: q,
        answer: a,
        scope,
        jobLabel: jobLabel || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setQ("");
      setA("");
      setJobLabel("");
    },
  });

  const inputCls =
    "w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm";
  const openBlockers = data.blockers.filter((b) => b.status === "open");
  const resolvedBlockers = data.blockers.filter((b) => b.status === "resolved");

  return (
    <div className="space-y-5">
      {data.documents.length > 0 && (
        <section
          aria-label="Prepared packages and documents"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
        >
          <h2 className="font-display text-xl text-[var(--text)]">
            Prepared packages — resumes & cover letters
          </h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Every tailored package prepared so far, read live from your
            job-search workspace. The same files also appear inside each
            opening's expanded view on the Board. Approval covers the exact
            versions marked current.
          </p>
          <div className="mt-3">
            <PackageDocuments
              documents={data.documents}
              onDeleteDocument={async (id) => {
                await deleteDocument.mutateAsync(id);
              }}
            />
          </div>
        </section>
      )}

      <section aria-label="Standing blockers">
        <h2 className="font-display mb-2 text-xl text-[var(--text)]">
          Standing blockers & open questions{" "}
          <span className="tnum text-sm text-[var(--dim)]">
            {openBlockers.length} open
          </span>
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {openBlockers.map((b) => (
            <BlockerCard key={b.id} blocker={b} />
          ))}
        </div>
        {resolvedBlockers.length > 0 && (
          <>
            <h3 className="font-display mb-2 mt-5 text-lg text-[var(--dim)]">
              Resolved
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {resolvedBlockers.map((b) => (
                <BlockerCard key={b.id} blocker={b} />
              ))}
            </div>
          </>
        )}
        <form
          aria-label="Add a blocker"
          className="mt-4 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            addBlocker.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">New blocker / open question</span>
              <input {...FIELDS.addBlocker.title} aria-label="New blocker title" value={bTitle} onChange={(e) => setBTitle(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Detail</span>
              <input aria-label="New blocker detail" value={bDetail} onChange={(e) => setBDetail(e.target.value)} className={inputCls} />
            </label>
          </div>
          <button type="submit" disabled={addBlocker.isPending} className="mt-3 rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Add blocker
          </button>
        </form>
      </section>

      <section aria-label="Answer bank">
        <h2 className="font-display mb-2 text-xl text-[var(--text)]">
          Answer bank
        </h2>
        <p className="mb-3 text-sm text-[var(--dim)]">
          Saved answers keep their supporting facts and intended scope. Reuse
          requires checking current facts and job relevance — a job-specific
          answer never becomes universal on its own, and authorization, salary,
          availability, demographics, declarations, and consent are never
          guessed.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.answers.map((ans) => (
            <AnswerCard key={ans.id} answer={ans} />
          ))}
        </div>
        <form
          aria-label="Add an answer"
          className="mt-4 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            addAnswer.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Question</span>
              <input {...FIELDS.addAnswer.question} aria-label="New answer question" value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Scope</span>
              <select aria-label="New answer scope" value={scope} onChange={(e) => setScope(e.target.value)} className={inputCls}>
                <option value="universal">universal</option>
                <option value="job-specific">job-specific</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Answer</span>
              <textarea {...FIELDS.addAnswer.answer} aria-label="New answer text" value={a} onChange={(e) => setA(e.target.value)} rows={2} className={inputCls} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Job label (if job-specific)</span>
              <input aria-label="New answer job label" value={jobLabel} onChange={(e) => setJobLabel(e.target.value)} className={inputCls} />
            </label>
          </div>
          <button type="submit" disabled={addAnswer.isPending} className="mt-3 rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Add answer
          </button>
        </form>
      </section>
    </div>
  );
}

/** Floating back-to-top button: appears once the page is scrolled, fixed to
 * the bottom-right corner. On phones it sits above the Muse shell's bottom
 * function bar (safe-area inset + clearance); on larger screens it rests in
 * the corner.
 *
 * The shell scrolls the app inside [data-generated-space-root] (position:
 * fixed; overflow: auto), NOT the window — so scroll position and scrolling
 * must go through that container, falling back to the window when it is
 * absent. Listening to / scrolling the window alone silently does nothing
 * here, which is also why the report dialog locks this same container. */
function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const scroller =
      document.querySelector<HTMLElement>("[data-generated-space-root]") ??
      document.documentElement;
    const onScroll = () => setVisible(scroller.scrollTop > 600);
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => {
        const scroller =
          document.querySelector<HTMLElement>(
            "[data-generated-space-root]",
          ) ?? document.documentElement;
        scroller.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
      }}
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-xl leading-none text-white shadow-lg sm:bottom-6"
    >
      ↑
    </button>
  );
}

export function App() {
  const [tab, setTab] = useState<
    "board" | "cv" | "tracker" | "workflow" | "ledger"
  >("board");
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard({}),
  });

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4">
        <p className="text-sm leading-relaxed text-[var(--dim)]">
          Goal: a science career beyond the postdoc — any role family you can
          realistically get, not scientist titles only. Tailored packages
          awaiting your review are shown on each opening's card, with the
          exact package version and approval status. Every resume and the
          master CV use the one adopted clean style. Your full master CV,
          including the downloadable clean-style file, is under the Master
          CV tab, and every position with tailoring initiated is tracked
          under the Tracker tab.
        </p>
        {dashboard.data &&
          (() => {
            const packaged = dashboard.data.openings.filter(
              (o) => o.packageVersion,
            );
            const deadlines = dashboard.data.openings
              .filter(
                (o) =>
                  o.deadline &&
                  o.status !== "Closed" &&
                  o.status !== "Screened out" &&
                  // Tracked Closed/expired openings ride along in the
                  // payload for the Tracker; a past deadline is not a
                  // "nearest closing date".
                  (daysUntil(o.deadline) ?? -1) >= 0,
              )
              .map((o) => o.deadline as string)
              .sort();
            return (
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                {packaged.length === 0
                  ? "No tailored packages yet."
                  : `${packaged.length} tailored package${packaged.length === 1 ? "" : "s"}: ${packaged
                      .map((o) => `${o.employer} — ${o.packageVersion}`)
                      .join("; ")}.`}
                {deadlines.length > 0 &&
                  ` Nearest closing date: ${fmtDate(deadlines[0] ?? null)}.`}
              </p>
            );
          })()}

        <nav
          aria-label="Dashboard views"
          className="mt-4 flex flex-wrap gap-1 border-b border-[var(--border)]"
        >
          {(
            [
              ["board", "Board"],
              ["cv", "Master CV (ledger)"],
              ["tracker", "Tracker"],
              ["workflow", "Workflow"],
              ["ledger", "Packages, blockers & answers"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`rounded-t px-3 py-2 text-sm ${
                tab === key
                  ? "border border-b-0 border-[var(--border)] bg-[var(--surface)] font-semibold text-[var(--text)]"
                  : "text-[var(--dim)]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-5">
          {dashboard.isPending && (
            <p className="text-sm text-[var(--dim)]">Loading your search…</p>
          )}
          {dashboard.isError && (
            <div className="rounded-[var(--radius)] border border-[var(--red)] bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--red)]">
                The dashboard data failed to load.
              </p>
              <button
                type="button"
                onClick={() => dashboard.refetch()}
                className="mt-2 rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </div>
          )}
          {dashboard.data && tab === "board" && (
            <BoardView data={dashboard.data} />
          )}
          {dashboard.data && tab === "cv" && (
            <MasterCvView data={dashboard.data} />
          )}
          {dashboard.data && tab === "tracker" && (
            <TrackerView data={dashboard.data} />
          )}
          {dashboard.data && tab === "workflow" && (
            <WorkflowView data={dashboard.data} />
          )}
          {dashboard.data && tab === "ledger" && (
            <LedgerView data={dashboard.data} />
          )}
        </div>
      </main>
      <BackToTopButton />
    </div>
  );
}
