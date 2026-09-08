CREATE TABLE "changes" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"op" text NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" bigint NOT NULL,
	"actor_id" text NOT NULL,
	"install_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"client_id" text,
	"name" text NOT NULL,
	"rate" double precision,
	"limit_min" double precision,
	"limit_max" double precision,
	"limit_period" text,
	"start_date" text,
	"end_date" text,
	"color" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"actor_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"start" bigint NOT NULL,
	"stop" bigint,
	"rate" double precision,
	"billable" boolean DEFAULT false NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"install_id" text,
	"actor_id" text,
	"created_at" bigint NOT NULL,
	"revoked_at" bigint
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"currency" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "changes_entity_idx" ON "changes" USING btree ("entity_kind","entity_id");--> statement-breakpoint
CREATE INDEX "clients_workspace_idx" ON "clients" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "records_workspace_idx" ON "records" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "records_actor_start_idx" ON "records" USING btree ("actor_id","start");--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_hash_idx" ON "tokens" USING btree ("token_hash");