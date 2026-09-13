ALTER TABLE "employees" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: `ADD COLUMN ... DEFAULT 0` alone leaves every existing employee
-- tied at 0, which would make the Schedule Board look broken (every row a
-- coin-flip tie) the moment this ships. Assign sequential values (0, 1, 2,
-- ...) in the employees' current alphabetical-by-name order — exactly the
-- order `employeeRepo.listAll()` used before this migration (see the SQLite
-- migration 009 equivalent for the same choice) — so the Schedule Board's
-- row order is VISUALLY IDENTICAL immediately after this runs. Nothing
-- appears shuffled until a manager actually drags a row.
UPDATE "employees" AS e
SET "sort_order" = ranked.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "name", "id") - 1 AS rn
  FROM "employees"
) AS ranked
WHERE e."id" = ranked."id";