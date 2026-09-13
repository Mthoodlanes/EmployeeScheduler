import type { Migration } from './types';

/**
 * Milestone 4: extends `employee_preferences` with an optional free-text
 * `note` (e.g. "prefers closing shifts") and drops the
 * `UNIQUE (employee_id, day_of_week)` constraint from migration 001 — a
 * manager needs to record more than one preferred window per employee per
 * day (or simply multiple non-contiguous windows across days), which the
 * original single-row-per-day constraint would have blocked.
 *
 * SQLite has no `ALTER TABLE ... DROP CONSTRAINT`, so the standard pattern
 * (recreate table without the constraint, copy data, swap) is used here.
 */
export const migration004PreferenceNotes: Migration = {
  id: 4,
  name: 'preference_notes',
  up: (db) => {
    db.exec(`
      CREATE TABLE employee_preferences_new (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id          INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        day_of_week          INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        preferred_start_time TEXT,
        preferred_end_time   TEXT,
        note                 TEXT,
        created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      INSERT INTO employee_preferences_new
        (id, employee_id, day_of_week, preferred_start_time, preferred_end_time, created_at, updated_at)
      SELECT id, employee_id, day_of_week, preferred_start_time, preferred_end_time, created_at, updated_at
      FROM employee_preferences;

      DROP TABLE employee_preferences;
      ALTER TABLE employee_preferences_new RENAME TO employee_preferences;

      CREATE INDEX idx_employee_preferences_employee_id ON employee_preferences(employee_id);
    `);
  },
};
