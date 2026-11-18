DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE openings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  employer TEXT NOT NULL,
  req_id TEXT,
  location TEXT,
  track TEXT NOT NULL,
  role_family TEXT,
  status TEXT NOT NULL,
  legacy_score INTEGER,
  scorecard_score INTEGER,
  coverage_score INTEGER,
  unknown_share INTEGER,
  deadline TEXT,
  deadline_note TEXT,
  salary_text TEXT,
  source_url TEXT,
  jd_summary TEXT,
  matched TEXT,
  gaps TEXT,
  why_label TEXT,
  why_text TEXT,
  reviews_text TEXT,
  fit_note TEXT,
  package_version TEXT,
  approval_status TEXT,
  next_action TEXT,
  flags TEXT,
  last_checked TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE blockers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'universal',
  job_label TEXT,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
