ALTER TABLE "weekly_entries" ADD COLUMN "applied_to_last_two_weeks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bowlers" DROP COLUMN "last_two_weeks_paid";