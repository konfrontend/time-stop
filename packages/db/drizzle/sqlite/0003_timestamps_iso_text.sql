PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_changes` (
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
INSERT INTO `__new_changes`("id", "entity_kind", "entity_id", "op", "payload", "updated_at", "actor_id", "install_id", "pushed_at") SELECT "id", "entity_kind", "entity_id", "op", "payload", "updated_at", "actor_id", "install_id", "pushed_at" FROM `changes`;--> statement-breakpoint
DROP TABLE `changes`;--> statement-breakpoint
ALTER TABLE `__new_changes` RENAME TO `changes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `changes_pushed_idx` ON `changes` (`pushed_at`);--> statement-breakpoint
CREATE TABLE `__new_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_clients`("id", "workspace_id", "name", "updated_at") SELECT "id", "workspace_id", "name", "updated_at" FROM `clients`;--> statement-breakpoint
DROP TABLE `clients`;--> statement-breakpoint
ALTER TABLE `__new_clients` RENAME TO `clients`;--> statement-breakpoint
CREATE INDEX `clients_workspace_idx` ON `clients` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `__new_projects` (
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
INSERT INTO `__new_projects`("id", "workspace_id", "client_id", "name", "rate", "limit_min", "limit_max", "limit_period", "start_date", "end_date", "color", "archived", "updated_at") SELECT "id", "workspace_id", "client_id", "name", "rate", "limit_min", "limit_max", "limit_period", "start_date", "end_date", "color", "archived", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE INDEX `projects_workspace_idx` ON `projects` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `__new_records` (
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
INSERT INTO `__new_records`("id", "workspace_id", "project_id", "actor_id", "name", "start", "stop", "updated_at") SELECT "id", "workspace_id", "project_id", "actor_id", "name", "start", "stop", "updated_at" FROM `records`;--> statement-breakpoint
DROP TABLE `records`;--> statement-breakpoint
ALTER TABLE `__new_records` RENAME TO `records`;--> statement-breakpoint
CREATE INDEX `records_actor_start_idx` ON `records` (`actor_id`,`start`);--> statement-breakpoint
CREATE INDEX `records_actor_stop_idx` ON `records` (`actor_id`,`stop`);--> statement-breakpoint
CREATE TABLE `__new_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_workspaces`("id", "name", "currency", "created_at", "updated_at") SELECT "id", "name", "currency", "created_at", "updated_at" FROM `workspaces`;--> statement-breakpoint
DROP TABLE `workspaces`;--> statement-breakpoint
ALTER TABLE `__new_workspaces` RENAME TO `workspaces`;