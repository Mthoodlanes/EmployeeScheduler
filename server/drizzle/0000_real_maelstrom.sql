CREATE TYPE "public"."department" AS ENUM('front_desk', 'cafe', 'bar');--> statement-breakpoint
CREATE TYPE "public"."end_anchor" AS ENUM('fixed', 'close');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('manager', 'employee');--> statement-breakpoint
CREATE TYPE "public"."start_anchor" AS ENUM('fixed', 'open');--> statement-breakpoint
CREATE TABLE "employee_departments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_departments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"department" "department" NOT NULL,
	CONSTRAINT "employee_departments_employee_id_department_key" UNIQUE("employee_id","department")
);
--> statement-breakpoint
CREATE TABLE "employee_preferences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"preferred_start_time" text,
	"preferred_end_time" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_preferences_day_of_week_check" CHECK ("employee_preferences"."day_of_week" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE TABLE "employee_unavailability" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_unavailability_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"reason" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"requested_by" integer NOT NULL,
	"decided_by" integer,
	"decided_at" text,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_unavailability_day_of_week_check" CHECK ("employee_unavailability"."day_of_week" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"is_salaried" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "scheduled_shifts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scheduled_shifts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"department" "department" NOT NULL,
	"shift_date" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"start_anchor" "start_anchor" DEFAULT 'fixed' NOT NULL,
	"end_anchor" "end_anchor" DEFAULT 'fixed' NOT NULL,
	"template_id" integer,
	"is_override" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shift_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"department" "department",
	"name" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"start_anchor" "start_anchor" DEFAULT 'fixed' NOT NULL,
	"end_anchor" "end_anchor" DEFAULT 'fixed' NOT NULL,
	"color" text DEFAULT '#D97706' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "special_event_overrides" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "special_event_overrides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_date" text NOT NULL,
	"label" text NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"open_time" text,
	"close_time" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "special_event_overrides_event_date_unique" UNIQUE("event_date")
);
--> statement-breakpoint
CREATE TABLE "store_hours" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_hours_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day_of_week" integer NOT NULL,
	"open_time" text,
	"close_time" text,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "store_hours_day_of_week_unique" UNIQUE("day_of_week"),
	CONSTRAINT "store_hours_day_of_week_check" CHECK ("store_hours"."day_of_week" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "time_off_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"reason" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" integer,
	"decided_at" text,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_departments" ADD CONSTRAINT "employee_departments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_preferences" ADD CONSTRAINT "employee_preferences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_unavailability" ADD CONSTRAINT "employee_unavailability_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_unavailability" ADD CONSTRAINT "employee_unavailability_requested_by_employees_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_unavailability" ADD CONSTRAINT "employee_unavailability_decided_by_employees_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_template_id_shift_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."shift_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_decided_by_employees_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_departments_employee_id" ON "employee_departments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_preferences_employee_id" ON "employee_preferences" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_unavailability_employee_id" ON "employee_unavailability" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_unavailability_status" ON "employee_unavailability" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduled_shifts_employee_id" ON "scheduled_shifts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_shifts_shift_date" ON "scheduled_shifts" USING btree ("shift_date");--> statement-breakpoint
CREATE INDEX "idx_time_off_requests_employee_id" ON "time_off_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_time_off_requests_status" ON "time_off_requests" USING btree ("status");