CREATE TYPE "public"."bowler_status" AS ENUM('active', 'left');--> statement-breakpoint
CREATE TABLE "bowlers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bowlers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" "bowler_status" DEFAULT 'active' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"lineage_discount" boolean DEFAULT false NOT NULL,
	"prize_fund_discount" boolean DEFAULT false NOT NULL,
	"drop_notice_week" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"deposit_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"deposit_opt_out" boolean DEFAULT false NOT NULL,
	"usbc_card_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leagues_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"spots_per_team" integer DEFAULT 4 NOT NULL,
	"num_weeks" integer DEFAULT 33 NOT NULL,
	"current_week" integer DEFAULT 1 NOT NULL,
	"prize_fund" numeric(10, 2) DEFAULT '0' NOT NULL,
	"lineage" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sweeper_active" boolean DEFAULT false NOT NULL,
	"sweeper_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"vacancy_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"lineage_discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"prize_fund_discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sponsor_fee_per_team" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sponsor_fee_active" boolean DEFAULT false NOT NULL,
	"deposit_fee_active" boolean DEFAULT false NOT NULL,
	"deposit_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sponsor_fee_due_week" integer DEFAULT 0 NOT NULL,
	"prize_fund_cover_charge_due_week" integer DEFAULT 0 NOT NULL,
	"last_two_weeks_due_week" integer DEFAULT 0 NOT NULL,
	"sanctioned_league" boolean DEFAULT true NOT NULL,
	"created_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"league_id" integer NOT NULL,
	"name" text NOT NULL,
	"folded" boolean DEFAULT false NOT NULL,
	"sponsor_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weekly_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bowler_id" integer NOT NULL,
	"week" integer NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_entries_bowler_id_week_key" UNIQUE("bowler_id","week")
);
--> statement-breakpoint
ALTER TABLE "bowlers" ADD CONSTRAINT "bowlers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_entries" ADD CONSTRAINT "weekly_entries_bowler_id_bowlers_id_fk" FOREIGN KEY ("bowler_id") REFERENCES "public"."bowlers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_weekly_entries_bowler_id" ON "weekly_entries" USING btree ("bowler_id");