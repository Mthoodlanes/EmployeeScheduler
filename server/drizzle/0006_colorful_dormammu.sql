ALTER TABLE "employees" DROP CONSTRAINT "employees_username_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "employees_username_lower_key" ON "employees" USING btree (lower("username"));