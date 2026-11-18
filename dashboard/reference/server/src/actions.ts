import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { asc, eq } from "drizzle-orm";
import { privileged } from "@space/privileged";
import * as schema from "./schema";

const openingOut = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  employer: z.string(),
  reqId: z.string().nullable(),
  location: z.string().nullable(),
  track: z.string(),
  roleFamily: z.string().nullable(),
  status: z.string(),
  legacyScore: z.number().nullable(),
  scorecardScore: z.number().nullable(),
  coverageScore: z.number().nullable(),
  unknownShare: z.number().nullable(),
  deadline: z.string().nullable(),
  deadlineNote: z.string().nullable(),
  salaryText: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  jdSummary: z.string().nullable(),
  matched: z.string().nullable(),
  gaps: z.string().nullable(),
  whyLabel: z.string().nullable(),
  whyText: z.string().nullable(),
  reviewsText: z.string().nullable(),
  fitNote: z.string().nullable(),
  packageVersion: z.string().nullable(),
  approvalStatus: z.string().nullable(),
  nextAction: z.string().nullable(),
  flags: z.string().nullable(),
  lastChecked: z.string().nullable(),
});

type OpeningRow = typeof schema.openings.$inferSelect;

function toOpening(row: OpeningRow): z.infer<typeof openingOut> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    employer: row.employer,
    reqId: row.reqId,
    location: row.location,
    track: row.track,
    roleFamily: row.roleFamily,
    status: row.status,
    legacyScore: row.legacyScore,
    scorecardScore: row.scorecardScore,
    coverageScore: row.coverageScore,
    unknownShare: row.unknownShare,
    deadline: row.deadline,
    deadlineNote: row.deadlineNote,
    salaryText: row.salaryText,
    sourceUrl: row.sourceUrl,
    jdSummary: row.jdSummary,
    matched: row.matched,
    gaps: row.gaps,
    whyLabel: row.whyLabel,
    whyText: row.whyText,
    reviewsText: row.reviewsText,
    fitNote: row.fitNote,
    packageVersion: row.packageVersion,
    approvalStatus: row.approvalStatus,
    nextAction: row.nextAction,
    flags: row.flags,
    lastChecked: row.lastChecked,
  };
}

const blockerOut = z.object({
  id: z.number(),
  title: z.string(),
  detail: z.string().nullable(),
  status: z.string(),
});

const answerOut = z.object({
  id: z.number(),
  question: z.string(),
  answer: z.string(),
  scope: z.string(),
  jobLabel: z.string().nullable(),
  note: z.string().nullable(),
});

const ledgerEntryOut = z.object({
  id: z.number(),
  section: z.string(),
  category: z.string(),
  body: z.string(),
  factStatus: z.string(),
  sourceRef: z.string().nullable(),
});

const documentOut = z.object({
  id: z.number(),
  openingSlug: z.string(),
  packageLabel: z.string(),
  kind: z.string(),
  label: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  versionLabel: z.string().nullable(),
  isCurrent: z.boolean(),
});

const statusEventOut = z.object({
  id: z.number(),
  openingId: z.number(),
  status: z.string(),
  emailFrom: z.string().nullable(),
  emailSubject: z.string().nullable(),
  emailDate: z.string().nullable(),
  note: z.string().nullable(),
  recordedAt: z.string(),
});

/** Tracker stage label (as shown in the dashboard's Tracker tab) -> the
 * suite status it records. Mirrors the client-side map in App.tsx. */
const STAGE_TO_STATUS: Record<string, string> = {
  Initiated: "Drafting",
  Applied: "Submitted",
  Responded: "Responded",
  "Interview scheduled": "Interview",
  "Offer received": "Offer",
  Rejected: "Rejection",
  Withdrawn: "Withdrawal",
};

const okResponse = z.object({ ok: z.literal(true) });

// ---------------------------------------------------------------------------
// Seed data: the fictional sample applicant (see the seed section below),
// in the same shapes a builder produces from a real TRACKER.md / ledger.
// Evidence coverage is the headline fit score; the scorecard is secondary.
// ---------------------------------------------------------------------------

type SeedOpening = Omit<
  OpeningRow,
  "id" | "createdAt" | "updatedAt" | "sortOrder"
> & { sortOrder?: number };

// ---------------------------------------------------------------------------
// APPLICANT_PROFILE — filled from applicant-profile.yaml by the builder.
// Every prompt below reads constraints from here, never hard-code a real
// applicant's constraints in this file. The values below are the fictional
// sample applicant (Dr. Sam Lee) used by the sample data kit.
// ---------------------------------------------------------------------------

export const APPLICANT_PROFILE = {
  displayName: "Sam Lee",
  // Things the applicant must never be represented as having. Tailoring and
  // research prompts interpolate this list instead of naming constraints
  // inline. Sample values — a builder replaces them from the real profile.
  neverClaim: [
    "independent Python programming proficiency (sample: Sam writes short scripts with assistance only)",
    "a current state clinical laboratory licence (sample: Sam does not hold one)",
    "in vivo animal-model experience (sample: no ledger evidence)",
  ],
  // Eligibility rules are flags on openings, never inputs to a fit score.
  eligibilityRules: [
    "Verify any eligibility flag recorded on an opening against this profile before pursuing it (sample rule).",
    "Confirm the earliest start date with the current institution before any submission (sample rule).",
    "Contractor roles placed at a client site need an eligibility check against this profile before tailoring starts (sample rule).",
  ],
  formatStandardPath: "templates/FORMAT-STANDARD.md",
  // IANA timezone from applicant-profile.yaml (`applicant.timezone`). All
  // server-side date decisions ("today", expiry, cleanup) are made in
  // this timezone — never the server's zone and never UTC. The sample
  // applicant is on America/New_York.
  timezone: "America/New_York",
} as const;

/** "Today" as a YYYY-MM-DD calendar date in the applicant's profile
 * timezone. Server-side date decisions use this; the client's day counts
 * keep browser-local behaviour (DATA-MODEL §12). */
function todayInApplicantTimezone(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: APPLICANT_PROFILE.timezone,
  });
}

/** Pre-submission pipeline statuses, mirroring the client (App.tsx). */
const PRE_SUBMISSION_STATUSES = new Set([
  "Drafting",
  "Awaiting review",
  "Approved",
  "Filling",
  "Awaiting applicant action",
]);

/** Server-side mirror of the client's `tailoringInitiated` (App.tsx):
 * an opening is TRACKED when it has indexed package documents, a recorded
 * package version, or a status at Drafting or beyond (including every
 * post-submission and outcome status). Tracked openings are never
 * deleted by expiry cleanup (DATA-MODEL §12). */
function isTrackedOpening(row: OpeningRow, documentCount: number): boolean {
  if (documentCount > 0) return true;
  if (row.packageVersion) return true;
  return (
    PRE_SUBMISSION_STATUSES.has(row.status) ||
    row.status === "Submitted" ||
    row.status === "Responded" ||
    row.status === "Interview" ||
    row.status === "Offer" ||
    row.status === "Rejection" ||
    row.status === "Withdrawal"
  );
}

// ---------------------------------------------------------------------------
// Seed data: the fictional sample applicant (Dr. Sam Lee, cell biologist,
// Boston, MA — sam.lee@example.com). A builder replaces this seed via
// seed/sync from the applicant's real data kit (TRACKER.md / ledger).
// Evidence coverage is the headline fit score; the scorecard is secondary.
// ---------------------------------------------------------------------------

const SEED_OPENINGS: SeedOpening[] = [
  {
    slug: "novacell-therapeutics-scientist-cell-therapy",
    title: "Scientist, Cell Therapy",
    employer: "NovaCell Therapeutics",
    reqId: "NC-2026-041",
    location: "Boston, MA — on-site",
    track: "Industry",
    roleFamily: "Industry R&D",
    status: "Awaiting review",
    legacyScore: null,
    scorecardScore: 71,
    coverageScore: 68,
    unknownShare: 12,
    deadline: "2027-01-15",
    deadlineNote: "Closes Fri Jan 15, 2027 (sample date)",
    salaryText: "$115,000–$145,000",
    sourceUrl: "https://example.com/novacell/careers/NC-2026-041",
    jdSummary:
      "Scientist, Cell Therapy (sample JD summary): design and run primary human T-cell culture and functional characterisation for an autologous cell-therapy programme — activation, expansion, multiparameter flow cytometry, cytokine profiling, and cytotoxicity assays; analyse and present data to the programme team; contribute to assay transfer documentation. PhD in cell biology, immunology, or a related field, or equivalent experience.",
    matched:
      "PhD in cell biology (Direct); primary human T-cell isolation, activation, and expansion across 12 donor lots (Direct); multiparameter flow cytometry panel design and analysis (Direct); cytokine profiling by ELISA and bead arrays (Direct); cytotoxicity assay design (Direct); assay documentation and transfer support (Transferable).",
    gaps: "Independent Python programming for data pipelines (never claim — see applicant profile); closed-system automated cell processing at manufacturing scale (Unknown — no ledger evidence).",
    whyLabel: "context",
    whyText:
      "Sample background (fictional dataset): NovaCell Therapeutics is presented in this sample as a Boston cell-therapy company expanding its discovery team alongside a new laboratory fit-out announced in sample company news. No source in the sample data states why this specific role is open — context only, not a stated reason.",
    reviewsText:
      "Sample review snapshot (fictional dataset): 3.9/5 from 212 reviews, 71% would recommend (checked 2026-11-18). Positives in the sample data: collaborative bench teams, good laboratory facilities. Negatives: shifting programme priorities, slow promotion. Anonymous and self-selected — signal, not verdict.",
    fitNote:
      "Evidence coverage 68%, Unknown 12% — scorecard 71/100. One-line fit: primary T-cell culture and functional characterisation is the applicant's core bench work; the data-pipeline programming expectation is the named gap.",
    packageVersion: "Resume v2 · Cover letter v1",
    approvalStatus: "Not approved — awaiting Sam's review of the exact package",
    nextAction:
      "Sam reviews the exact package (JD + resume + cover letter together); if approved, submit ahead of the Jan 15, 2027 sample deadline.",
    flags:
      "Programming expectation in the JD vs. the profile never-claim list — framed honestly in the package; sample deadline Jan 15, 2027",
    lastChecked: "2026-11-18",
    sortOrder: 1,
  },
  {
    slug: "north-state-university-research-fellow-immunology",
    title: "Research Fellow",
    employer: "North State University — Immunology Lab",
    reqId: null,
    location: "Boston, MA — on-site",
    track: "Academic",
    roleFamily: "Staff scientist (academic / government)",
    status: "Researched",
    legacyScore: null,
    scorecardScore: 76,
    coverageScore: 74,
    unknownShare: 9,
    deadline: null,
    deadlineNote: "No deadline shown — rolling until filled (sample)",
    salaryText: "University fellow scale (amount not stated in the sample posting)",
    sourceUrl: "https://example.com/north-state/careers/research-fellow-immunology",
    jdSummary:
      "Research Fellow in the Immunology Lab at North State University (sample JD summary): lead a project on how activation state shapes primary T-cell function in tissue-like culture systems; design flow-cytometry and functional assays; analyse single-cell datasets with core-facility support; contribute to manuscripts and grant progress reports; co-supervise a graduate student. PhD in immunology, cell biology, or a related field required.",
    matched:
      "PhD in cell biology (Direct); primary T-cell functional assays (Direct); multiparameter flow cytometry (Direct); manuscript record in T-cell methods (Direct); graduate-student co-supervision during doctoral training (Transferable); single-cell dataset interpretation with core support (Transferable).",
    gaps: "Tissue-like / organoid culture systems (Unknown — no ledger evidence); grant writing as lead author (Unknown).",
    whyLabel: "context",
    whyText:
      "Sample lab background (fictional dataset, label: context). The Immunology Lab at North State University is led by PI Dr. Elena Park (fictional). Stated research goals, from the sample lab website: understand how activation history and tissue context shape T-cell effector function, and turn that into more predictive in vitro models. Recent sample publications and conference abstracts (past five years, fictional dataset) cover activation-state markers in primary T cells, tissue-like culture systems, and flow-cytometry standardisation. Inferred potential directions (kept distinct from stated goals): extending the tissue-like culture work toward donor-variability studies, and pairing functional assays with single-cell profiling. No source in the sample data states why this specific fellowship is open.",
    reviewsText:
      "Sample review snapshot (fictional dataset): university employer reviews 3.7/5 from 480 reviews, 68% would recommend (checked 2026-11-18). Positives in the sample data: academic freedom, core facilities. Negatives: fixed-term contracts, pay below local industry. Anonymous and self-selected — signal, not verdict.",
    fitNote:
      "Evidence coverage 74%, Unknown 9% — scorecard 76/100. One-line fit: T-cell function in controlled culture systems is the applicant's doctoral and postdoctoral core; the lab's stated direction matches the ledger's assay strengths.",
    packageVersion: null,
    approvalStatus: null,
    nextAction:
      "If Sam selects it, tailor the full academic CV (not a 2-page resume) plus a short note on follow-on research ideas.",
    flags: "Academic track — full detailed CV applies; no deadline in the sample posting",
    lastChecked: "2026-11-18",
    sortOrder: 2,
  },
  {
    slug: "meridian-staffing-scientist-government-client",
    title: "Scientist — Government Client Site",
    employer: "Meridian Staffing",
    reqId: null,
    location: "Boston, MA — client site",
    track: "Contractor",
    roleFamily: "Contractor roles",
    status: "Eligibility hold",
    legacyScore: null,
    scorecardScore: 55,
    coverageScore: 52,
    unknownShare: 18,
    deadline: null,
    deadlineNote: "No deadline shown (sample)",
    salaryText: "$98,000–$118,000 (sample range via the staffing firm)",
    sourceUrl: "https://example.com/meridian/jobs/scientist-government-client",
    jdSummary:
      "Scientist placed by Meridian Staffing at a government client site (sample JD summary): run cell-culture and flow-cytometry support for a client laboratory programme, maintain assay records to the client's documentation standard, and report progress through the staffing firm's programme manager. PhD or MS with equivalent experience in cell biology; client-site eligibility requirements apply.",
    matched:
      "Cell culture and flow-cytometry bench skills (Direct); assay record-keeping to a written standard (Transferable); programme reporting experience from core-facility work (Transferable).",
    gaps: "Client-site eligibility is unverified (see flags); client-specific documentation system (Unknown — no ledger evidence).",
    whyLabel: "unavailable",
    whyText:
      "No source found in the sample data stating why this role is open — do not claim a reason. Sample context only: the staffing firm lists several client-site science roles in the same period.",
    reviewsText:
      "Sample review snapshot (fictional dataset): 3.4/5 from 96 reviews, 61% would recommend (checked 2026-11-18). Positives in the sample data: responsive recruiters. Negatives: benefits thinner than direct employment, contract uncertainty. Anonymous and self-selected — signal, not verdict.",
    fitNote:
      "Evidence coverage 52%, Unknown 18% — scorecard 55/100. Bench fit is real, but the role stays on hold until the eligibility flag is checked against the applicant profile.",
    packageVersion: null,
    approvalStatus: null,
    nextAction:
      "Do not tailor yet — resolve the eligibility flag first (see flags), then decide.",
    flags:
      "Verify eligibility flag from applicant profile before pursuing — see profile constraints",
    lastChecked: "2026-11-18",
    sortOrder: 3,
  },
  {
    slug: "quickhire-solutions-lab-technician",
    title: "Lab Technician",
    employer: "QuickHire Solutions",
    reqId: null,
    location: "Boston, MA — on-site",
    track: "Industry",
    roleFamily: "Industry R&D",
    status: "Screened out",
    legacyScore: null,
    scorecardScore: null,
    coverageScore: null,
    unknownShare: null,
    deadline: null,
    deadlineNote: null,
    salaryText: "$52,000–$64,000 (sample range)",
    sourceUrl: "https://example.com/quickhire/jobs/lab-technician",
    jdSummary:
      "Lab Technician in a clinical testing laboratory (sample JD summary): receive and process clinical samples, run routine analyser workflows, and document results under the laboratory's licence. A current state clinical laboratory licence is a stated requirement of the sample posting.",
    matched: "General laboratory technique and record-keeping (Transferable).",
    gaps: "Current state clinical laboratory licence (required — the applicant does not hold one; see the profile never-claim list).",
    whyLabel: "unavailable",
    whyText: "Not researched — the opening was screened out on the licence requirement before background research.",
    reviewsText: null,
    fitNote:
      "Screened out: role requires a current state clinical laboratory licence the applicant does not hold.",
    packageVersion: null,
    approvalStatus: null,
    nextAction: "None — screened out; kept on the board as the screening record.",
    flags: "Screened out at search time — licence requirement",
    lastChecked: "2026-11-18",
    sortOrder: 4,
  },
];

const SEED_BLOCKERS: { title: string; detail: string; status: string }[] = [
  {
    title: "Confirm earliest start date with current institution",
    detail:
      "Sample blocker: the applicant's earliest start date is not yet confirmed with the current institution. Compatibility of current openings with that start is unknown — do not assume an employer can wait; check each role's hiring timeline before any submission.",
    status: "open",
  },
  {
    title: "Obtain official transcript copy",
    detail:
      "Resolved 2026-11-18 (sample): an official transcript copy was received and filed with the sample data kit, so it is available for any application that asks for one.",
    status: "resolved",
  },
];

const SEED_ANSWERS: {
  question: string;
  answer: string;
  scope: string;
  jobLabel: string | null;
  note: string | null;
}[] = [
  {
    question: "Why are you leaving your current position?",
    answer:
      "My current appointment is a fixed-term research position, and the project I was hired to lead is complete (sample answer). I am looking for a role where I can keep building on primary T-cell assay work — this time with a clearer path from assay development into a programme team.",
    scope: "universal",
    jobLabel: null,
    note: "Sample answer-bank entry (fictional) — review the exact wording before using it on any real application.",
  },
  {
    question: "What is your greatest technical strength?",
    answer:
      "Designing primary human T-cell functional assays that other people can reproduce (sample answer). In my current role I rebuilt our expansion and flow-cytometry workflow so donor-to-donor variability dropped and the same protocol ran unchanged across 12 donor lots; the quantified detail lives in the ledger and is only used where it is attested.",
    scope: "universal",
    jobLabel: null,
    note: "Sample answer-bank entry (fictional) — quantified claims must match ledger entries at application time.",
  },
];

// ---------------------------------------------------------------------------
// Master-CV ledger seed: the sample applicant's ledger, structured into
// viewable sections. Inserted only when the ledger_entries table is empty;
// never overwrites later edits. Fact statuses demonstrate the full set:
// user-attested and confirmed are usable; pending, conflicted, and retired
// are not.
// ---------------------------------------------------------------------------

type LedgerSeed = {
  section: string;
  category: string;
  body: string;
  factStatus: string;
  sourceRef: string | null;
};

const LEDGER_SEED: LedgerSeed[] = [
  {
    section: "Identity & contact",
    category: "Profile",
    body: "Dr. Sam Lee, PhD (fictional sample applicant)\nCell biologist — primary human T-cell culture, flow cytometry, and functional assay development.\nEmail: sam.lee@example.com · Location: Boston, MA\nSample data only: every fact in this ledger belongs to the fictional sample applicant and demonstrates the ledger format.",
    factStatus: "user-attested",
    sourceRef: "Sample LEDGER.md — Profile",
  },
  {
    section: "Positioning & research profile",
    category: "Profile",
    body: "Positioning line: Cell Biology | Primary T-Cell Assays | Flow Cytometry\n\nResearch profile (sample): Cell biologist specialising in primary human T-cell culture and functional characterisation. Experience spans donor-cell isolation, activation and expansion workflows, multiparameter flow panel design, cytokine profiling, and cytotoxicity assays, with a record of turning variable bench protocols into documented, transferable methods.\n\nTarget tracks: (1) Industry — Scientist, cell therapy / assay development; (2) Academic — Research Fellow / staff scientist; (3) Contractor — client-site scientist roles, subject to profile eligibility flags.",
    factStatus: "user-attested",
    sourceRef: "Sample LEDGER.md — Profile",
  },
  {
    section: "Education",
    category: "Education",
    body: "PhD, Cell and Molecular Biology — Bayview University (fictional), 2021 (sample).\nThesis: Activation-state markers in primary human T cells cultured under tissue-like conditions.\nBSc, Biological Sciences — Bayview University (fictional), 2015 (sample).",
    factStatus: "confirmed",
    sourceRef: "Sample LEDGER.md — Education",
  },
  {
    section: "Experience — current role",
    category: "Experience",
    body: "Research Scientist, Boston Institute for Cell Research (fictional), 2022–present (sample).\nSTAR: Situation — donor-to-donor variability made the team's T-cell expansion results hard to compare across studies. Task — rebuild the expansion and phenotyping workflow into one documented protocol. Action — standardised isolation, activation, and feeding steps; designed a 12-colour flow panel for activation and memory markers; wrote the transfer document. Result — expansion yield rose from 62% to 84% on average across 12 donor lots, and assay turnaround fell from 5 days to 3 days (sample figures, applicant-attested).",
    factStatus: "user-attested",
    sourceRef: "Sample LEDGER.md — Experience",
  },
  {
    section: "Experience — earlier roles",
    category: "Experience",
    body: "Postdoctoral Researcher, Bayview University (fictional), 2021–2022 (sample): activation-state marker study in primary T cells; maintained the laboratory's flow-cytometry standardisation panel.\nResearch Assistant, Bayview University (fictional), 2015–2016 (sample): cell-culture support and sample banking for two group projects.",
    factStatus: "confirmed",
    sourceRef: "Sample LEDGER.md — Experience",
  },
  {
    section: "Skills — keyword bank",
    category: "Skills",
    body: "Bench: primary human T-cell isolation / activation / expansion; multiparameter flow cytometry (panel design, compensation, analysis); ELISA and bead-based cytokine profiling; cytotoxicity assays; mammalian cell culture; assay documentation and transfer.\nData: spreadsheet and statistics-package analysis of assay data (applicant's own); figure preparation.\nNever claim (see applicant profile): independent Python programming proficiency; a current state clinical laboratory licence; in vivo animal-model experience.",
    factStatus: "user-attested",
    sourceRef: "Sample LEDGER.md — Skills",
  },
  {
    section: "Publications",
    category: "Publications",
    body: "Lee S, Park J, Nguyen T. A standardised expansion workflow reduces donor variability in primary human T-cell culture. Journal of Cellular Methods (fictional journal), 2024 (sample).\nLee S, Okafor C. Activation-state markers track with effector function in tissue-like culture. Cellular Systems Notes (fictional journal), 2022 (sample).",
    factStatus: "confirmed",
    sourceRef: "Sample LEDGER.md — Publications",
  },
  {
    section: "Awards",
    category: "Awards",
    body: "Early-Career Methods Award, Boston Institute for Cell Research internal scheme (fictional), 2024 (sample) — for the standardised T-cell expansion workflow.\nBest Poster Prize, Bayview University Graduate Research Day (fictional), 2020 (sample).",
    factStatus: "user-attested",
    sourceRef: "Sample LEDGER.md — Awards",
  },
];

const LEDGER_SEED_B: LedgerSeed[] = [
  {
    section: "Presentations",
    category: "Presentations",
    body: "Talk (sample): “Making donor variability visible: a standardised T-cell expansion workflow.” Regional Cell Therapy Methods Meeting (fictional), 2025.\nPoster (sample): “A 12-colour activation panel for primary human T cells.” Bayview Immunology Symposium (fictional), 2023.",
    factStatus: "confirmed",
    sourceRef: "Sample LEDGER.md — Presentations",
  },
  {
    section: "Mentoring & teaching",
    category: "Mentoring & Teaching",
    body: "Co-supervised one graduate rotation student (sample, 2024): project on feeding schedules in T-cell expansion; student presented at the institute research day.\nRan the institute's introductory flow-cytometry practical for new starters (sample, 2023–present), 3 cohorts of 6–8 trainees.",
    factStatus: "user-attested",
    sourceRef: "Sample LEDGER.md — Mentoring & Teaching",
  },
  {
    section: "References",
    category: "References",
    body: "Reference 1 (sample): doctoral supervisor at Bayview University (fictional) — agreed to act as a referee; contact details held in the applicant's private data kit, not in this sample.\nReference 2 (sample): current institute group leader — agreement to act as a referee is still being confirmed, so this entry is pending and must not be used until confirmed.",
    factStatus: "pending",
    sourceRef: "Sample LEDGER.md — References",
  },
  {
    section: "Internal constraints — start date",
    category: "Internal Constraints",
    body: "Earliest start date (sample): two sample records disagree — the applicant's note says spring 2027, an older planning note says winter 2026. Marked conflicted: not usable in any application until the applicant confirms the correct date with the current institution (see the open blocker).",
    factStatus: "conflicted",
    sourceRef: "Sample LEDGER.md — Internal Constraints",
  },
  {
    section: "Internal constraints — retired notes",
    category: "Internal Constraints",
    body: "Retired (sample): an earlier preference note set a hard salary floor and excluded all contractor roles. The applicant superseded it on 2026-11-18 (sample) — contractor roles are in scope subject to eligibility flags, and salary is a preference, not a floor. Kept in the ledger as retired so the change of position stays visible; never use the retired version.",
    factStatus: "retired",
    sourceRef: "Sample LEDGER.md — Internal Constraints",
  },
  {
    section: "Skills — awaiting confirmation",
    category: "Skills",
    body: "Single-cell library preparation (sample): the applicant reports assisting on two runs at the core facility. Awaiting confirmation of the extent of hands-on involvement — pending, not usable for matching or drafting until confirmed.",
    factStatus: "pending",
    sourceRef: "Sample LEDGER.md — Skills",
  },
];

// ---------------------------------------------------------------------------
// Package document index seed: the sample package for the NovaCell opening
// plus the master CV. relPath values are built from the directory constants
// below; privileged.ts only ever reads under the applicant's job-search
// data folder.
// ---------------------------------------------------------------------------

type DocumentSeed = {
  openingSlug: string;
  packageLabel: string;
  kind: string;
  label: string;
  filename: string;
  relPath: string;
  mimeType: string;
  versionLabel: string | null;
  isCurrent: number;
};

const NOVACELL_DIR =
  "job-search/applications/novacell-therapeutics-scientist-cell-therapy";
const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MD = "text/markdown";

const DOCUMENT_SEED: DocumentSeed[] = [
  { openingSlug: "novacell-therapeutics-scientist-cell-therapy", packageLabel: "NovaCell Therapeutics — Cell Therapy package", kind: "package", label: "Full package notes — JD, employer background & reviews, resume + cover letter text, approval record", filename: "PACKAGE.md", relPath: `${NOVACELL_DIR}/PACKAGE.md`, mimeType: MD, versionLabel: "Resume v2 · Cover letter v1", isCurrent: 1 },
  { openingSlug: "novacell-therapeutics-scientist-cell-therapy", packageLabel: "NovaCell Therapeutics — Cell Therapy package", kind: "resume", label: "Tailored resume v1 (PDF)", filename: "Lee_Resume_NovaCell_Cell_Therapy_v1.pdf", relPath: `${NOVACELL_DIR}/Lee_Resume_NovaCell_Cell_Therapy_v1.pdf`, mimeType: PDF, versionLabel: "v1", isCurrent: 0 },
  { openingSlug: "novacell-therapeutics-scientist-cell-therapy", packageLabel: "NovaCell Therapeutics — Cell Therapy package", kind: "resume", label: "Tailored resume (PDF)", filename: "Lee_Resume_NovaCell_Cell_Therapy_v2.pdf", relPath: `${NOVACELL_DIR}/Lee_Resume_NovaCell_Cell_Therapy_v2.pdf`, mimeType: PDF, versionLabel: "v2 — current review version", isCurrent: 1 },
  { openingSlug: "novacell-therapeutics-scientist-cell-therapy", packageLabel: "NovaCell Therapeutics — Cell Therapy package", kind: "resume", label: "Tailored resume (DOCX)", filename: "Lee_Resume_NovaCell_Cell_Therapy_v2.docx", relPath: `${NOVACELL_DIR}/Lee_Resume_NovaCell_Cell_Therapy_v2.docx`, mimeType: DOCX, versionLabel: "v2 — current review version", isCurrent: 1 },
  { openingSlug: "novacell-therapeutics-scientist-cell-therapy", packageLabel: "NovaCell Therapeutics — Cell Therapy package", kind: "cover", label: "Cover letter (PDF)", filename: "Lee_Cover_Letter_NovaCell_v1.pdf", relPath: `${NOVACELL_DIR}/Lee_Cover_Letter_NovaCell_v1.pdf`, mimeType: PDF, versionLabel: "v1 — current review version", isCurrent: 1 },
  { openingSlug: "master-cv", packageLabel: "Master CV — full CV in the adopted clean style", kind: "resume", label: "Master CV (PDF)", filename: "master-cv-sam-lee.pdf", relPath: "job-search/master-cv-sam-lee.pdf", mimeType: PDF, versionLabel: "Clean style — sample", isCurrent: 1 },
];

// ---------------------------------------------------------------------------
// Detail backfill: fills still-empty detail fields on openings whose rows
// were created with scores only. The sample dataset ships complete rows,
// so the sample backfill is empty; a builder's sync from a real refresh
// would add entries here in the same shape. Applied only to fields that
// are still null — never overwrites later edits.
// ---------------------------------------------------------------------------

type Backfill = {
  jdSummary?: string;
  matched?: string;
  gaps?: string;
  fitNote?: string;
};

const DETAIL_BACKFILL: Record<string, Backfill> = {};

export const Actions = {
  getDashboard: defineAction({
    description:
      "Returns all tracked openings, standing blockers, the saved answer bank, the full master-CV ledger entries, the package document index, and the recorded status events (with linked recruiter-email evidence) for the job search dashboard.",
    request: z.object({}),
    response: z.object({
      openings: z.array(openingOut),
      blockers: z.array(blockerOut),
      answers: z.array(answerOut),
      ledgerEntries: z.array(ledgerEntryOut),
      documents: z.array(documentOut),
      statusEvents: z.array(statusEventOut),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [
        openingRows,
        blockerRows,
        answerRows,
        ledgerRows,
        documentRows,
        statusEventRows,
      ] = await Promise.all([
        db.select().from(schema.openings).orderBy(asc(schema.openings.sortOrder), asc(schema.openings.id)),
        db.select().from(schema.blockers).orderBy(asc(schema.blockers.id)),
        db.select().from(schema.answers).orderBy(asc(schema.answers.id)),
        db.select().from(schema.ledgerEntries).orderBy(asc(schema.ledgerEntries.sortOrder), asc(schema.ledgerEntries.id)),
        db.select().from(schema.packageDocuments).orderBy(asc(schema.packageDocuments.sortOrder), asc(schema.packageDocuments.id)),
        db.select().from(schema.statusEvents).orderBy(asc(schema.statusEvents.id)),
      ]);
      // All openings are returned, including Closed and past-deadline
      // ones: the Board applies the visibility rule client-side, and
      // TRACKED (tailoring-initiated) Closed/expired openings must reach
      // the Tracker, which lists them until a terminal stage
      // (DATA-MODEL §12–§13). Filtering them out here would silently
      // drop tracked openings from the Tracker.
      return {
        openings: openingRows.map(toOpening),
        blockers: blockerRows.map((b) => ({
          id: b.id,
          title: b.title,
          detail: b.detail,
          status: b.status,
        })),
        answers: answerRows.map((a) => ({
          id: a.id,
          question: a.question,
          answer: a.answer,
          scope: a.scope,
          jobLabel: a.jobLabel,
          note: a.note,
        })),
        ledgerEntries: ledgerRows.map((e) => ({
          id: e.id,
          section: e.section,
          category: e.category,
          body: e.body,
          factStatus: e.factStatus,
          sourceRef: e.sourceRef,
        })),
        documents: documentRows.map((d) => ({
          id: d.id,
          openingSlug: d.openingSlug,
          packageLabel: d.packageLabel,
          kind: d.kind,
          label: d.label,
          filename: d.filename,
          mimeType: d.mimeType,
          versionLabel: d.versionLabel,
          isCurrent: d.isCurrent === 1,
        })),
        statusEvents: statusEventRows.map((e) => ({
          id: e.id,
          openingId: e.openingId,
          status: e.status,
          emailFrom: e.emailFrom,
          emailSubject: e.emailSubject,
          emailDate: e.emailDate,
          note: e.note,
          recordedAt: e.createdAt.toISOString(),
        })),
      };
    },
  }),

  seedFromTracker: defineAction({
    description:
      "One-time populate: inserts the openings, blockers, and answer-bank entries recorded in TRACKER.md / the ledger when the tables are empty. No-op when rows already exist; never overwrites user edits.",
    request: z.object({}),
    response: z.object({
      seeded: z.boolean(),
      openings: z.number(),
      blockers: z.number(),
      answers: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select({ id: schema.openings.id }).from(schema.openings).limit(1);
      if (existing.length > 0) {
        return { seeded: false, openings: 0, blockers: 0, answers: 0 };
      }
      const now = new Date();
      for (const o of SEED_OPENINGS) {
        await db.insert(schema.openings).values({
          ...o,
          sortOrder: o.sortOrder ?? 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      for (const b of SEED_BLOCKERS) {
        await db.insert(schema.blockers).values({ ...b, createdAt: now, updatedAt: now });
      }
      for (const a of SEED_ANSWERS) {
        await db.insert(schema.answers).values({ ...a, createdAt: now, updatedAt: now });
      }
      ctx.invalidateQueries();
      return {
        seeded: true,
        openings: SEED_OPENINGS.length,
        blockers: SEED_BLOCKERS.length,
        answers: SEED_ANSWERS.length,
      };
    },
  }),

  addOpening: defineAction({
    description: "Adds a new opening to the board.",
    request: z.object({
      title: z.string().min(1),
      employer: z.string().min(1),
      track: z.string().min(1),
      roleFamily: z.string().optional(),
      status: z.string().min(1),
      reqId: z.string().optional(),
      location: z.string().optional(),
      deadline: z.string().optional(),
      deadlineNote: z.string().optional(),
      salaryText: z.string().optional(),
      sourceUrl: z.string().optional(),
      coverageScore: z.number().int().min(0).max(100).optional(),
      unknownShare: z.number().int().min(0).max(100).optional(),
      scorecardScore: z.number().int().min(0).max(100).optional(),
      nextAction: z.string().optional(),
      flags: z.string().optional(),
      jdSummary: z.string().optional(),
      matched: z.string().optional(),
      gaps: z.string().optional(),
      whyLabel: z.string().optional(),
      whyText: z.string().optional(),
      reviewsText: z.string().optional(),
      fitNote: z.string().optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const slugBase =
        `${args.employer}-${args.title}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80) || "opening";
      const slug = `${slugBase}-${Date.now().toString(36)}`;
      const result = await db
        .insert(schema.openings)
        .values({
          slug,
          title: args.title,
          employer: args.employer,
          track: args.track,
          roleFamily: args.roleFamily ?? null,
          status: args.status,
          reqId: args.reqId ?? null,
          location: args.location ?? null,
          deadline: args.deadline ?? null,
          deadlineNote: args.deadlineNote ?? null,
          salaryText: args.salaryText ?? null,
          sourceUrl: args.sourceUrl ?? null,
          coverageScore: args.coverageScore ?? null,
          unknownShare: args.unknownShare ?? null,
          scorecardScore: args.scorecardScore ?? null,
          legacyScore: null,
          nextAction: args.nextAction ?? null,
          flags: args.flags ?? null,
          jdSummary: args.jdSummary ?? null,
          matched: args.matched ?? null,
          gaps: args.gaps ?? null,
          whyLabel: args.whyLabel ?? null,
          whyText: args.whyText ?? null,
          reviewsText: args.reviewsText ?? null,
          fitNote: args.fitNote ?? null,
          sortOrder: 100,
        })
        .returning({ id: schema.openings.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addOpening: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateOpening: defineAction({
    description:
      "Updates one opening's status, scores, deadline, package/approval record, next action, flags, and review notes.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.string().optional(),
      nextAction: z.string().nullable().optional(),
      packageVersion: z.string().nullable().optional(),
      approvalStatus: z.string().nullable().optional(),
      coverageScore: z.number().int().min(0).max(100).nullable().optional(),
      unknownShare: z.number().int().min(0).max(100).nullable().optional(),
      scorecardScore: z.number().int().min(0).max(100).nullable().optional(),
      deadline: z.string().nullable().optional(),
      deadlineNote: z.string().nullable().optional(),
      flags: z.string().nullable().optional(),
      lastChecked: z.string().nullable().optional(),
      jdSummary: z.string().nullable().optional(),
      matched: z.string().nullable().optional(),
      gaps: z.string().nullable().optional(),
      whyLabel: z.string().nullable().optional(),
      whyText: z.string().nullable().optional(),
      reviewsText: z.string().nullable().optional(),
      fitNote: z.string().nullable().optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const { id, ...fields } = args;
      await db
        .update(schema.openings)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(schema.openings.id, id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  recordStatusEvent: defineAction({
    description:
      "Records an application status change for one opening together with the recruiter-email evidence behind it (sender, date, subject as seen in your email). Pass either the suite status or the Tracker stage label; the opening's status is updated to match and the event is stored for the Tracker tab's email-evidence area. Email fields may be omitted only for a change with no email behind it.",
    request: z.object({
      openingId: z.number().int().positive(),
      status: z.string().min(1).optional(),
      stage: z.string().min(1).optional(),
      emailFrom: z.string().nullable().optional(),
      emailSubject: z.string().nullable().optional(),
      emailDate: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
    }),
    response: z.object({ ok: z.literal(true), id: z.number(), status: z.string() }),
    handler: async (
      ctx,
      args,
    ): Promise<{ ok: true; id: number; status: string }> => {
      const status =
        args.status ??
        (args.stage ? STAGE_TO_STATUS[args.stage] : undefined);
      if (!status) {
        throw new Error(
          "recordStatusEvent: pass a suite status or a known Tracker stage label",
        );
      }
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const inserted = await db
        .insert(schema.statusEvents)
        .values({
          openingId: args.openingId,
          status,
          emailFrom: args.emailFrom ?? null,
          emailSubject: args.emailSubject ?? null,
          emailDate: args.emailDate ?? null,
          note: args.note ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.statusEvents.id });
      const row = inserted[0];
      if (!row) throw new Error("recordStatusEvent: insert returned no rows");
      await db
        .update(schema.openings)
        .set({ status, updatedAt: now })
        .where(eq(schema.openings.id, args.openingId));
      ctx.invalidateQueries();
      return { ok: true as const, id: row.id, status };
    },
  }),

  saveOpeningResearch: defineAction({
    description:
      "Saves researched JD, employer/position background, and employer-review content onto one opening. Used by the background-research task started from the dashboard so every searched position carries a filled JD & background report.",
    request: z.object({
      id: z.number().int().positive(),
      jdSummary: z.string().nullable().optional(),
      matched: z.string().nullable().optional(),
      gaps: z.string().nullable().optional(),
      whyLabel: z.string().nullable().optional(),
      whyText: z.string().nullable().optional(),
      reviewsText: z.string().nullable().optional(),
      fitNote: z.string().nullable().optional(),
      sourceUrl: z.string().nullable().optional(),
      salaryText: z.string().nullable().optional(),
      deadline: z.string().nullable().optional(),
      deadlineNote: z.string().nullable().optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const { id, ...fields } = args;
      await db
        .update(schema.openings)
        .set({
          ...fields,
          lastChecked: new Date().toISOString().slice(0, 10),
          updatedAt: new Date(),
        })
        .where(eq(schema.openings.id, id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  requestOpeningResearch: defineAction({
    description:
      "Starts background research for one opening whose JD summary, employer/position background, or employer reviews are not filled yet. A background task verifies the JD on the official posting, researches why the role is open (labeled stated-reason / context / inference / unavailable), and pulls Glassdoor/Indeed employer reviews, then saves everything through saveOpeningResearch.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({
      started: z.boolean(),
      missing: z.array(z.string()),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ started: boolean; missing: string[] }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.openings)
        .where(eq(schema.openings.id, args.id))
        .limit(1);
      const row = rows[0];
      if (!row) return { started: false, missing: [] };
      const missing: string[] = [];
      if (!row.jdSummary) missing.push("JD summary");
      if (!row.whyText) missing.push("employer & position background");
      if (!row.reviewsText) missing.push("employer reviews");
      if (missing.length === 0) return { started: false, missing };
      const message = [
        `Fill the JD & background report for one tracked opening in the Job Search Dashboard (slug: ${row.slug}, opening id: ${row.id}).`,
        `Role: ${row.title} at ${row.employer}${row.reqId ? ` (req ${row.reqId})` : ""}${row.location ? ` — ${row.location}` : ""}.`,
        row.sourceUrl
          ? `Recorded posting URL: ${row.sourceUrl}`
          : "No official posting URL is recorded yet — find and verify the official careers-page posting first; aggregators are leads only.",
        `Currently missing: ${missing.join(", ")}. Fill every missing field; also refresh any of the other report fields that are empty.`,
        "Research rules (from the ledger workflow): verify the JD on the official posting and summarize the role from it; research why this role is open in order — press releases/company news, pipeline announcements, M&A, new site/expansion, restructuring, new funding/grant, new program/IND/trial, stated departure/backfill — and label the background stated-reason, context, inference, or unavailable (never invent a reason; if no source is found, say so with label unavailable); pull employer reviews from Glassdoor and Indeed (overall rating, % recommend, review count, category scores, recurring pros/cons, date checked, with the anonymous/self-selected caveat). Map matched evidence and gaps strictly from ledger-attested facts — never claim: " + APPLICANT_PROFILE.neverClaim.join("; ") + ". No field may be left blank: if a JD, background, or reviews genuinely cannot be found after a real search, save an explicit note saying so (with the date checked) instead of leaving the field empty — for the background use whyLabel unavailable.",
        "Eligibility rules from the applicant profile (flags, never scoring inputs): " + APPLICANT_PROFILE.eligibilityRules.join("; ") + ".",
        "When the research is done, save it by calling the saveOpeningResearch action for this opening id with the filled fields (jdSummary, whyLabel, whyText, reviewsText, and matched/gaps/fitNote/sourceUrl/salaryText/deadline/deadlineNote where you verified them). Do not apply, submit anything, or contact anyone.",
      ].join("\n");
      const res = await ctx.agent.spawnTask(message, {
        expectsAction: "saveOpeningResearch",
        dedupeKey: `opening-research-${row.id}`,
      });
      return { started: res.ok, missing };
    },
  }),

  requestTailoredPackage: defineAction({
    description:
      "Starts creation of a tailored CV/resume and cover letter for one opening. A background task verifies the JD live, builds the package from ledger-attested facts only (STAR bullets, quantified results, mandatory grammar-proof pass; industry = 2-page resume, academic = full CV), saves it in the job-search workspace, and records the new package version on the opening through updateOpening for exact-package review.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ started: z.boolean() }),
    async handler(ctx, args): Promise<{ started: boolean }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.openings)
        .where(eq(schema.openings.id, args.id))
        .limit(1);
      const row = rows[0];
      if (!row) return { started: false };
      if (row.status === "Closed" || row.status === "Screened out") {
        return { started: false };
      }
      if (row.status === "Researched" || row.status === "Verify-first") {
        await db
          .update(schema.openings)
          .set({ status: "Drafting", updatedAt: new Date() })
          .where(eq(schema.openings.id, row.id));
      }
      const message = [
        `Create the tailored application package for one tracked opening in the Job Search Dashboard (slug: ${row.slug}, opening id: ${row.id}).`,
        `Role: ${row.title} at ${row.employer}${row.reqId ? ` (req ${row.reqId})` : ""}${row.location ? ` — ${row.location}` : ""}. Track: ${row.track}.`,
        row.sourceUrl
          ? `Official posting: ${row.sourceUrl} — re-verify it is still live before tailoring.`
          : "No official posting URL is recorded — verify the posting on the employer's official careers page before tailoring; if it cannot be verified live, stop and record that on the opening instead of drafting.",
        "Follow the established tailoring workflow: use only user-attested/confirmed ledger facts (never pending/conflicted items; never claim: " + APPLICANT_PROFILE.neverClaim.join("; ") + "); STAR bullets with quantified results from the ledger; industry roles get a 2-page resume, academic roles a full detailed CV; build every document in the one adopted clean style specified in " + APPLICANT_PROFILE.formatStandardPath + " (Times New Roman, right-aligned dates, title-first role lines with italic institutions, hanging-indent publications, grouped skills, no tagline) and verify the format on the PDF render, never the in-app DOCX preview; the cover letter stays science-precise with no generic phrasing; run the mandatory grammar-proof pass (grammar, punctuation, agreement, tense, spelling) before finishing and page-check the output (resume exactly 2 pages / full CV as appropriate, cover letter 1 page). Make sure the opening's JD summary, employer & position background (labeled), and Glassdoor/Indeed reviews are filled first — research and save them via saveOpeningResearch if any are missing. Save the package (DOCX + PDF + PACKAGE.md with the employer background and approval record) in a new folder under workspace/job-search/applications/, following the existing packages' naming.",
        "Eligibility rules from the applicant profile (flags, never scoring inputs): " + APPLICANT_PROFILE.eligibilityRules.join("; ") + ".",
        "When the package is ready, call the updateOpening action for this opening id: set status to Awaiting review, packageVersion to the new document versions, approvalStatus to 'Not approved — awaiting " + APPLICANT_PROFILE.displayName + "'s review of the exact package', and nextAction to reviewing the exact package (JD + resume/CV + cover letter together). Do not submit the application or contact anyone — " + APPLICANT_PROFILE.displayName + " reviews and approves the exact package first.",
      ].join("\n");
      const res = await ctx.agent.spawnTask(message, {
        expectsAction: "updateOpening",
        dedupeKey: `opening-tailor-${row.id}`,
      });
      ctx.invalidateQueries();
      return { started: res.ok };
    },
  }),

  deleteOpening: defineAction({
    description:
      "Deletes one opening from the board, cascading to its package documents (by opening slug) and its status events (by opening id) so no orphaned documents or events are left behind.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.openings)
        .where(eq(schema.openings.id, args.id))
        .limit(1);
      const row = rows[0];
      if (row) {
        await db
          .delete(schema.packageDocuments)
          .where(eq(schema.packageDocuments.openingSlug, row.slug));
        await db
          .delete(schema.statusEvents)
          .where(eq(schema.statusEvents.openingId, row.id));
      }
      await db.delete(schema.openings).where(eq(schema.openings.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  cleanupClosedExpired: defineAction({
    description:
      "Expiry cleanup with the tracked-opening lifecycle rule: permanently deletes every UNTRACKED opening that is Closed or whose deadline date is already in the past (in the applicant's profile timezone), cascading to any package documents and status events it has. TRACKED openings (tailoring initiated — package documents, a recorded package version, or a status at Drafting or beyond, including Submitted/Responded/Interview/Offer) are RETAINED with package and status history intact: they stay off the Board and on the Tracker until a terminal stage. Returns how many were removed and how many tracked openings were kept.",
    request: z.object({}),
    response: z.object({ removed: z.number(), keptTracked: z.number() }),
    async handler(
      ctx,
    ): Promise<{ removed: number; keptTracked: number }> {
      const db = ctx.db<typeof schema>();
      const today = todayInApplicantTimezone();
      const rows = await db.select().from(schema.openings);
      const stale = rows.filter(
        (r) => r.status === "Closed" || (r.deadline && r.deadline < today),
      );
      let removed = 0;
      let keptTracked = 0;
      for (const r of stale) {
        const docs = await db
          .select({ id: schema.packageDocuments.id })
          .from(schema.packageDocuments)
          .where(eq(schema.packageDocuments.openingSlug, r.slug));
        if (isTrackedOpening(r, docs.length)) {
          keptTracked++;
          continue;
        }
        await db
          .delete(schema.packageDocuments)
          .where(eq(schema.packageDocuments.openingSlug, r.slug));
        await db
          .delete(schema.statusEvents)
          .where(eq(schema.statusEvents.openingId, r.id));
        await db.delete(schema.openings).where(eq(schema.openings.id, r.id));
        removed++;
      }
      if (removed > 0) ctx.invalidateQueries();
      return { removed, keptTracked };
    },
  }),

  wipeAllData: defineAction({
    description:
      "Wipes ALL dashboard data — every row in all six tables (openings, ledger entries, package documents, status events, blockers, answers) — returning the dashboard to its empty state, and returns the per-table removed counts. This is the sanctioned sample → real-data wipe (ACCEPTANCE item 55). It requires the explicit confirmation input confirm: true; a call without it is rejected by the request schema and deletes nothing.",
    request: z.object({ confirm: z.literal(true) }),
    response: z.object({
      openings: z.number(),
      ledgerEntries: z.number(),
      documents: z.number(),
      statusEvents: z.number(),
      blockers: z.number(),
      answers: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [openingRows, ledgerRows, documentRows, eventRows, blockerRows, answerRows] =
        await Promise.all([
          db.select({ id: schema.openings.id }).from(schema.openings),
          db.select({ id: schema.ledgerEntries.id }).from(schema.ledgerEntries),
          db.select({ id: schema.packageDocuments.id }).from(schema.packageDocuments),
          db.select({ id: schema.statusEvents.id }).from(schema.statusEvents),
          db.select({ id: schema.blockers.id }).from(schema.blockers),
          db.select({ id: schema.answers.id }).from(schema.answers),
        ]);
      await db.delete(schema.statusEvents);
      await db.delete(schema.packageDocuments);
      await db.delete(schema.openings);
      await db.delete(schema.ledgerEntries);
      await db.delete(schema.blockers);
      await db.delete(schema.answers);
      ctx.invalidateQueries();
      return {
        openings: openingRows.length,
        ledgerEntries: ledgerRows.length,
        documents: documentRows.length,
        statusEvents: eventRows.length,
        blockers: blockerRows.length,
        answers: answerRows.length,
      };
    },
  }),

  requestAllMissingBackgrounds: defineAction({
    description:
      "Starts one background research task that fills the JD summary, employer/position background, and employer reviews for every tracked (non-screened-out, non-closed, non-expired) opening still missing any of them, saving each through saveOpeningResearch. Enforces the rule that every searched position carries a filled JD & background report.",
    request: z.object({}),
    response: z.object({ started: z.boolean(), count: z.number() }),
    async handler(ctx): Promise<{ started: boolean; count: number }> {
      const db = ctx.db<typeof schema>();
      const today = todayInApplicantTimezone();
      const rows = await db.select().from(schema.openings);
      const incomplete = rows.filter(
        (r) =>
          r.status !== "Screened out" &&
          r.status !== "Closed" &&
          !(r.deadline && r.deadline < today) &&
          (!r.jdSummary || !r.whyText || !r.reviewsText),
      );
      if (incomplete.length === 0) return { started: false, count: 0 };
      const list = incomplete
        .map((r) => {
          const missing = [
            !r.jdSummary ? "JD summary" : null,
            !r.whyText ? "employer & position background" : null,
            !r.reviewsText ? "employer reviews" : null,
          ]
            .filter(Boolean)
            .join(", ");
          return `- opening id ${r.id} (slug: ${r.slug}): ${r.title} at ${r.employer}${r.reqId ? ` (req ${r.reqId})` : ""}${r.location ? ` — ${r.location}` : ""}. Missing: ${missing}.${r.sourceUrl ? ` Recorded posting URL: ${r.sourceUrl}` : " No official posting URL recorded — find and verify the official careers-page posting first."}`;
        })
        .join("\n");
      const message = [
        "Fill the JD & background reports for every tracked opening in the Job Search Dashboard that is still missing its JD summary, employer & position background, or employer reviews. Work through this list one opening at a time:",
        list,
        "For each opening: verify the JD on the official posting and summarize the role; research why the role is open in order — press releases/company news, pipeline announcements, M&A, new site/expansion, restructuring, new funding/grant, new program/IND/trial, stated departure/backfill — labeled stated-reason, context, inference, or unavailable (never invent a reason); pull employer reviews from Glassdoor and Indeed (overall rating, % recommend, review count, category scores, recurring pros/cons, date checked, anonymous/self-selected caveat). Map matched evidence and gaps strictly from ledger-attested facts — never claim: " + APPLICANT_PROFILE.neverClaim.join("; ") + ". No field may be left blank: if a JD, background, or reviews genuinely cannot be found after a real search (for example a closed posting with no accessible reviews), save an explicit note saying so with the date checked instead of leaving the field empty — for the background use whyLabel unavailable.",
        "Save each opening as soon as its research is done by calling the saveOpeningResearch action with that opening's id and the filled fields (jdSummary, whyLabel, whyText, reviewsText, plus matched/gaps/fitNote/sourceUrl/salaryText/deadline/deadlineNote where verified). Do not apply, submit anything, or contact anyone.",
      ].join("\n");
      const res = await ctx.agent.spawnTask(message, {
        expectsAction: "saveOpeningResearch",
        dedupeKey: "all-missing-backgrounds",
      });
      return { started: res.ok, count: incomplete.length };
    },
  }),

  addBlocker: defineAction({
    description: "Adds a standing blocker or open question to the search.",
    request: z.object({ title: z.string().min(1), detail: z.string().optional() }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.blockers)
        .values({ title: args.title, detail: args.detail ?? null, status: "open" })
        .returning({ id: schema.blockers.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addBlocker: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  setBlockerStatus: defineAction({
    description: "Marks a standing blocker open or resolved.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["open", "resolved"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.blockers)
        .set({ status: args.status, updatedAt: new Date() })
        .where(eq(schema.blockers.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteBlocker: defineAction({
    description: "Deletes one standing blocker.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.blockers).where(eq(schema.blockers.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  addAnswer: defineAction({
    description: "Adds a reusable application answer to the answer bank.",
    request: z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
      scope: z.string().default("universal"),
      jobLabel: z.string().optional(),
      note: z.string().optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.answers)
        .values({
          question: args.question,
          answer: args.answer,
          scope: args.scope,
          jobLabel: args.jobLabel ?? null,
          note: args.note ?? null,
        })
        .returning({ id: schema.answers.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addAnswer: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateAnswer: defineAction({
    description: "Updates one saved answer-bank entry.",
    request: z.object({
      id: z.number().int().positive(),
      answer: z.string().min(1),
      scope: z.string().optional(),
      jobLabel: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const { id, ...fields } = args;
      await db
        .update(schema.answers)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(schema.answers.id, id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteAnswer: defineAction({
    description: "Deletes one answer-bank entry.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.answers).where(eq(schema.answers.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  syncDashboardContent: defineAction({
    description:
      "Idempotent content sync: seeds the master-CV ledger entries (full ledger content) when empty, upserts the package document index to the current sample package versions (NovaCell resume v2, cover letter v1, and the master CV PDF), refreshes superseded package-version strings on openings, backfills empty detail fields on openings from scoring notes, and adds the sample NovaCell opening row if missing. Never overwrites existing content or user edits.",
    request: z.object({}),
    response: z.object({
      ledgerSeeded: z.number(),
      documentsSeeded: z.number(),
      openingsBackfilled: z.number(),
      sampleOpeningAdded: z.boolean(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      let ledgerSeeded = 0;
      let documentsSeeded = 0;
      let openingsBackfilled = 0;
      let sampleOpeningAdded = false;

      const existingLedger = await db
        .select({ id: schema.ledgerEntries.id })
        .from(schema.ledgerEntries)
        .limit(1);
      if (existingLedger.length === 0) {
        const all = [...LEDGER_SEED, ...LEDGER_SEED_B];
        for (let i = 0; i < all.length; i++) {
          const e = all[i];
          if (!e) continue;
          await db.insert(schema.ledgerEntries).values({
            section: e.section,
            category: e.category,
            body: e.body,
            factStatus: e.factStatus,
            sourceRef: e.sourceRef,
            sortOrder: i + 1,
            createdAt: now,
            updatedAt: now,
          });
          ledgerSeeded++;
        }
      }

      // Document index: upsert by path so newly created package versions
      // (e.g. a later grammar-fix version) appear and the "current"
      // flags track the package folders.
      const existingDocs = await db.select().from(schema.packageDocuments);
      const byPath = new Map(existingDocs.map((d) => [d.relPath, d]));
      for (let i = 0; i < DOCUMENT_SEED.length; i++) {
        const d = DOCUMENT_SEED[i];
        if (!d) continue;
        const existing = byPath.get(d.relPath);
        if (!existing) {
          await db.insert(schema.packageDocuments).values({
            ...d,
            sortOrder: i + 1,
            createdAt: now,
            updatedAt: now,
          });
          documentsSeeded++;
        } else if (
          existing.isCurrent !== d.isCurrent ||
          existing.versionLabel !== d.versionLabel ||
          existing.label !== d.label ||
          existing.packageLabel !== d.packageLabel ||
          existing.sortOrder !== i + 1
        ) {
          await db
            .update(schema.packageDocuments)
            .set({
              isCurrent: d.isCurrent,
              versionLabel: d.versionLabel,
              label: d.label,
              packageLabel: d.packageLabel,
              sortOrder: i + 1,
              updatedAt: now,
            })
            .where(eq(schema.packageDocuments.id, existing.id));
          documentsSeeded++;
        }
      }

      const allOpenings = await db.select().from(schema.openings);
      // Package-version strings superseded by later versions — refreshed
      // only when the stored value is exactly one of the known old strings.
      // The sample chain ends at the sample package version
      // ("Resume v2 \u00b7 Cover letter v1"); rows already carrying that
      // string (or any other value) are left untouched.
      const PACKAGE_VERSION_REFRESH: Record<
        string,
        { froms: string[]; to: string }
      > = {
        "novacell-therapeutics-scientist-cell-therapy": {
          froms: ["Resume v1 \u00b7 Cover letter v1"],
          to: "Resume v2 \u00b7 Cover letter v1",
        },
      };
      for (const row of allOpenings) {
        const refresh = PACKAGE_VERSION_REFRESH[row.slug];
        if (
          refresh &&
          row.packageVersion !== null &&
          refresh.froms.includes(row.packageVersion)
        ) {
          await db
            .update(schema.openings)
            .set({ packageVersion: refresh.to, updatedAt: now })
            .where(eq(schema.openings.id, row.id));
        }
      }
      for (const row of allOpenings) {
        const fill = DETAIL_BACKFILL[row.slug];
        if (!fill) continue;
        const patch: Partial<{
          jdSummary: string;
          matched: string;
          gaps: string;
          fitNote: string;
        }> = {};
        if (row.jdSummary === null && fill.jdSummary) patch.jdSummary = fill.jdSummary;
        if (row.matched === null && fill.matched) patch.matched = fill.matched;
        if (row.gaps === null && fill.gaps) patch.gaps = fill.gaps;
        if (row.fitNote === null && fill.fitNote) patch.fitNote = fill.fitNote;
        if (Object.keys(patch).length > 0) {
          await db
            .update(schema.openings)
            .set({ ...patch, updatedAt: now })
            .where(eq(schema.openings.id, row.id));
          openingsBackfilled++;
        }
      }

      const sampleSlug = "novacell-therapeutics-scientist-cell-therapy";
      const hasSample = allOpenings.some((o) => o.slug === sampleSlug);
      if (!hasSample) {
        const seedOpening = SEED_OPENINGS.find((o) => o.slug === sampleSlug);
        if (seedOpening) {
          await db.insert(schema.openings).values({
            ...seedOpening,
            sortOrder: seedOpening.sortOrder ?? 0,
            createdAt: now,
            updatedAt: now,
          });
          sampleOpeningAdded = true;
        }
      }

      ctx.invalidateQueries();
      return { ledgerSeeded, documentsSeeded, openingsBackfilled, sampleOpeningAdded };
    },
  }),

  addLedgerEntry: defineAction({
    description: "Adds a section to the master-CV ledger view.",
    request: z.object({
      section: z.string().min(1),
      category: z.string().min(1),
      body: z.string().min(1),
      factStatus: z.string().default("user-attested"),
      sourceRef: z.string().optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.ledgerEntries)
        .values({
          section: args.section,
          category: args.category,
          body: args.body,
          factStatus: args.factStatus,
          sourceRef: args.sourceRef ?? null,
          sortOrder: 500,
        })
        .returning({ id: schema.ledgerEntries.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addLedgerEntry: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateLedgerEntry: defineAction({
    description: "Updates one master-CV ledger section's text, category, or fact status.",
    request: z.object({
      id: z.number().int().positive(),
      section: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      factStatus: z.string().optional(),
      sourceRef: z.string().nullable().optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const { id, ...fields } = args;
      await db
        .update(schema.ledgerEntries)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(schema.ledgerEntries.id, id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteLedgerEntry: defineAction({
    description: "Deletes one master-CV ledger section.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteDocument: defineAction({
    description:
      "Deletes one package-document index row by id (metadata only — the file itself in the kit/workspace is not touched).",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.packageDocuments)
        .where(eq(schema.packageDocuments.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteStatusEvent: defineAction({
    description:
      "Deletes one recorded status event by id. The opening's current status is not changed — this removes a history row only.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.statusEvents)
        .where(eq(schema.statusEvents.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  getDocumentFile: defineAction({
    description:
      "Reads one package document (resume, cover letter, or package notes) from the job-search workspace and returns it for display: PDFs and DOCX files come back as a viewable/downloadable blob URL, text files as text.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({
      found: z.boolean(),
      kind: z.enum(["pdf", "file", "text", "missing"]),
      url: z.string().nullable(),
      text: z.string().nullable(),
      filename: z.string(),
      mimeType: z.string(),
    }),
    privileged: [privileged.readWorkspaceFile],
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.packageDocuments)
        .where(eq(schema.packageDocuments.id, args.id))
        .limit(1);
      const doc = rows[0];
      if (!doc) {
        return {
          found: false,
          kind: "missing" as const,
          url: null,
          text: null,
          filename: "",
          mimeType: "",
        };
      }
      const res = await ctx.executePrivileged(privileged.readWorkspaceFile, {
        relPath: doc.relPath,
      });
      if (!res.found) {
        return {
          found: false,
          kind: "missing" as const,
          url: null,
          text: null,
          filename: doc.filename,
          mimeType: doc.mimeType,
        };
      }
      if (res.text !== null) {
        return {
          found: true,
          kind: "text" as const,
          url: null,
          text: res.text,
          filename: doc.filename,
          mimeType: doc.mimeType,
        };
      }
      if (res.base64 !== null) {
        const bytes = Buffer.from(res.base64, "base64");
        const key = `package-files/${doc.id}-${doc.filename}`;
        await ctx.blobs.put(key, bytes, { contentType: doc.mimeType });
        const url = await ctx.blobs.getUrl(key);
        return {
          found: true,
          kind: doc.mimeType === "application/pdf" ? ("pdf" as const) : ("file" as const),
          url,
          text: null,
          filename: doc.filename,
          mimeType: doc.mimeType,
        };
      }
      return {
        found: false,
        kind: "missing" as const,
        url: null,
        text: null,
        filename: doc.filename,
        mimeType: doc.mimeType,
      };
    },
  }),
} satisfies ActionsModule;
