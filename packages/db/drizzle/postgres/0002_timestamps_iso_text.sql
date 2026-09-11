ALTER TABLE "changes" ALTER COLUMN "updated_at" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "updated_at" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "updated_at" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "records" ALTER COLUMN "start" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "records" ALTER COLUMN "stop" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "records" ALTER COLUMN "updated_at" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tokens" ALTER COLUMN "created_at" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tokens" ALTER COLUMN "revoked_at" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "created_at" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "updated_at" SET DATA TYPE text;