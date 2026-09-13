import type { Migration } from './types';

/**
 * Adds `mechanic` as a 4th valid department value, alongside the existing
 * `front_desk`/`cafe`/`bar`. Every table with a `department` CHECK
 * constraint needs it widened: `employee_departments` (untouched since
 * migration 001), `shift_templates` (nullable department, per migration
 * 005), and `scheduled_shifts` (per migration 006). SQLite has no
 * `ALTER TABLE ... DROP CONSTRAINT`/way to modify a CHECK in place, so each
 * table uses the same recreate-table pattern as migrations 004/005/006:
 * create a `_new` table with the widened CHECK, copy all rows across
 * unchanged, drop the old table, rename the new one into place, then
 * recreate any indexes (which are dropped along with the old table).
 */
export const migration008AddMechanicDepartment: Migration = {
  id: 8,
  name: 'add_mechanic_department',
  up: (db) => {
    db.exec(`
      CREATE TABLE employee_departments_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        department  TEXT NOT NULL CHECK (department IN ('front_desk', 'cafe', 'bar', 'mechanic')),
        UNIQUE (employee_id, department)
      );

      INSERT INTO employee_departments_new (id, employee_id, department)
      SELECT id, employee_id, department
      FROM employee_departments;

      DROP TABLE employee_departments;
      ALTER TABLE employee_departments_new RENAME TO employee_departments;

      CREATE INDEX idx_employee_departments_employee_id ON employee_departments(employee_id);

      CREATE TABLE shift_templates_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        department   TEXT CHECK (department IN ('front_desk', 'cafe', 'bar', 'mechanic')),
        name         TEXT NOT NULL,
        start_time   TEXT,
        end_time     TEXT,
        start_anchor TEXT NOT NULL DEFAULT 'fixed' CHECK (start_anchor IN ('fixed', 'open')),
        end_anchor   TEXT NOT NULL DEFAULT 'fixed' CHECK (end_anchor IN ('fixed', 'close')),
        color        TEXT NOT NULL DEFAULT '#D97706',
        is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      INSERT INTO shift_templates_new
        (id, department, name, start_time, end_time, start_anchor, end_anchor, color, is_active, created_at, updated_at)
      SELECT id, department, name, start_time, end_time, start_anchor, end_anchor, color, is_active, created_at, updated_at
      FROM shift_templates;

      DROP TABLE shift_templates;
      ALTER TABLE shift_templates_new RENAME TO shift_templates;

      CREATE TABLE scheduled_shifts_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        department   TEXT NOT NULL CHECK (department IN ('front_desk', 'cafe', 'bar', 'mechanic')),
        shift_date   TEXT NOT NULL,
        start_time   TEXT,
        end_time     TEXT,
        start_anchor TEXT NOT NULL DEFAULT 'fixed' CHECK (start_anchor IN ('fixed', 'open')),
        end_anchor   TEXT NOT NULL DEFAULT 'fixed' CHECK (end_anchor IN ('fixed', 'close')),
        template_id  INTEGER REFERENCES shift_templates(id) ON DELETE SET NULL,
        is_override  INTEGER NOT NULL DEFAULT 0 CHECK (is_override IN (0, 1)),
        notes        TEXT,
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      INSERT INTO scheduled_shifts_new
        (id, employee_id, department, shift_date, start_time, end_time, start_anchor, end_anchor, template_id, is_override, notes, created_at, updated_at)
      SELECT id, employee_id, department, shift_date, start_time, end_time, start_anchor, end_anchor, template_id, is_override, notes, created_at, updated_at
      FROM scheduled_shifts;

      DROP TABLE scheduled_shifts;
      ALTER TABLE scheduled_shifts_new RENAME TO scheduled_shifts;

      CREATE INDEX idx_scheduled_shifts_employee_id ON scheduled_shifts(employee_id);
      CREATE INDEX idx_scheduled_shifts_shift_date ON scheduled_shifts(shift_date);
    `);
  },
};
