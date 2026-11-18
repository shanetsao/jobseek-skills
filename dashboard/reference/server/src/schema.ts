import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const openings = sqliteTable("openings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  employer: text("employer").notNull(),
  reqId: text("req_id"),
  location: text("location"),
  track: text("track").notNull(),
  roleFamily: text("role_family"),
  status: text("status").notNull(),
  legacyScore: integer("legacy_score"),
  scorecardScore: integer("scorecard_score"),
  coverageScore: integer("coverage_score"),
  unknownShare: integer("unknown_share"),
  deadline: text("deadline"),
  deadlineNote: text("deadline_note"),
  salaryText: text("salary_text"),
  sourceUrl: text("source_url"),
  jdSummary: text("jd_summary"),
  matched: text("matched"),
  gaps: text("gaps"),
  whyLabel: text("why_label"),
  whyText: text("why_text"),
  reviewsText: text("reviews_text"),
  fitNote: text("fit_note"),
  packageVersion: text("package_version"),
  approvalStatus: text("approval_status"),
  nextAction: text("next_action"),
  flags: text("flags"),
  lastChecked: text("last_checked"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const blockers = sqliteTable("blockers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  detail: text("detail"),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const ledgerEntries = sqliteTable("ledger_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  section: text("section").notNull(),
  category: text("category").notNull(),
  body: text("body").notNull(),
  factStatus: text("fact_status").notNull().default("user-attested"),
  sourceRef: text("source_ref"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const packageDocuments = sqliteTable("package_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openingSlug: text("opening_slug").notNull(),
  packageLabel: text("package_label").notNull(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  filename: text("filename").notNull(),
  relPath: text("rel_path").notNull(),
  mimeType: text("mime_type").notNull(),
  versionLabel: text("version_label"),
  isCurrent: integer("is_current").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const statusEvents = sqliteTable("status_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openingId: integer("opening_id").notNull(),
  status: text("status").notNull(),
  emailFrom: text("email_from"),
  emailSubject: text("email_subject"),
  emailDate: text("email_date"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const answers = sqliteTable("answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  scope: text("scope").notNull().default("universal"),
  jobLabel: text("job_label"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
