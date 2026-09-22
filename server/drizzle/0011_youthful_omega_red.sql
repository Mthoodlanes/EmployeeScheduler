CREATE TYPE "public"."backup_source" AS ENUM('manual', 'pre_restore');--> statement-breakpoint
CREATE TABLE "dues_tracker_backups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dues_tracker_backups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"label" text,
	"source" "backup_source" NOT NULL,
	"restored_from_backup_id" integer,
	"league_count" integer NOT NULL,
	"team_count" integer NOT NULL,
	"bowler_count" integer NOT NULL,
	"weekly_entry_count" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dues_tracker_backups" ADD CONSTRAINT "dues_tracker_backups_restored_from_backup_id_dues_tracker_backups_id_fk" FOREIGN KEY ("restored_from_backup_id") REFERENCES "public"."dues_tracker_backups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_tracker_backups" ADD CONSTRAINT "dues_tracker_backups_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;