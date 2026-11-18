CREATE TABLE `status_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opening_id` integer NOT NULL,
	`status` text NOT NULL,
	`email_from` text,
	`email_subject` text,
	`email_date` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
