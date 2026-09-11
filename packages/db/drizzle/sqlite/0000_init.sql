CREATE TABLE `changes` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	`actor_id` text NOT NULL,
	`install_id` text NOT NULL,
	`pushed_at` text
);
--> statement-breakpoint
CREATE INDEX `changes_pushed_idx` ON `changes` (`pushed_at`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clients_workspace_idx` ON `clients` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_id` text,
	`name` text NOT NULL,
	`rate` real,
	`limit_min` real,
	`limit_max` real,
	`limit_period` text,
	`start_date` text,
	`end_date` text,
	`color` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `projects_workspace_idx` ON `projects` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`actor_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`start` text NOT NULL,
	`stop` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `records_actor_start_idx` ON `records` (`actor_id`,`start`);--> statement-breakpoint
CREATE INDEX `records_actor_stop_idx` ON `records` (`actor_id`,`stop`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
