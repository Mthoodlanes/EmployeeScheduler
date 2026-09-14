CREATE TABLE "schedule_publications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schedule_publications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"department" "department" NOT NULL,
	"week_start" text NOT NULL,
	"published_by_employee_id" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_publications_department_week_start_key" UNIQUE("department","week_start")
);
--> statement-breakpoint
ALTER TABLE "schedule_publications" ADD CONSTRAINT "schedule_publications_published_by_employee_id_employees_id_fk" FOREIGN KEY ("published_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;