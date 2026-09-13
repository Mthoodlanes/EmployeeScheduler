ALTER TYPE "public"."role" ADD VALUE 'coordinator';--> statement-breakpoint
CREATE TABLE "notices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"body" text NOT NULL,
	"posted_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "last_read_notices_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_posted_by_employee_id_employees_id_fk" FOREIGN KEY ("posted_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notices_created_at" ON "notices" USING btree ("created_at");