CREATE TABLE `ledger_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`section` text NOT NULL,
	`category` text NOT NULL,
	`body` text NOT NULL,
	`fact_status` text DEFAULT 'user-attested' NOT NULL,
	`source_ref` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `package_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opening_slug` text NOT NULL,
	`package_label` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`filename` text NOT NULL,
	`rel_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`version_label` text,
	`is_current` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
