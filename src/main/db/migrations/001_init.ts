import type { Migration } from './types';

/**
 * Creates the full schema for the app (all milestones), per the Data Model
 * section of the architecture plan. Milestone 1 only reads/writes
 * `employees` and `employee_departments`; the remaining tables are created
 * now so later milestones do not need additional structural migrations.
 */
export const migration001Init: Migration = {
  id: 1,
  name: 'init',
  up: (db) => {
    db.exec(`
      CREATE TABLE employees (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('manager', 'employee')),
        is_salaried   INTEGER NOT NULL DEFAULT 0 CHECK (is_salaried IN (0, 1)),
        is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE employee_departments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        department  TEXT NOT NULL CHECK (department IN ('front_desk', 'cafe', 'bar')),
        UNIQUE (employee_id, department)
      );

      CREATE TABLE shift_templates (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        department TEXT NOT NULL CHECK (department IN ('front_desk', 'cafe', 'bar')),
        name       TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time   TEXT NOT NULL,
        color      TEXT NOT NULL DEFAULT '#D97706',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE scheduled_shifts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        department  TEXT NOT NULL CHECK (department IN ('front_desk', 'cafe', 'bar')),
        shift_date  TEXT NOT NULL,
        start_time  TEXT NOT NULL,
        end_time    TEXT NOT NULL,
        template_id INTEGER REFERENCES shift_templates(id) ON DELETE SET NULL,
        is_override INTEGER NOT NULL DEFAULT 0 CHECK (is_override IN (0, 1)),
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE time_off_requests (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        start_date  TEXT NOT NULL,
        end_date    TEXT NOT NULL,
        reason      TEXT,
        status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
        decided_by  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        decided_at  TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE employee_preferences (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id         INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        day_of_week         INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        preferred_start_time TEXT,
        preferred_end_time   TEXT,
        created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (employee_id, day_of_week)
      );

      CREATE TABLE store_hours (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
        open_time  TEXT,
        close_time TEXT,
        is_closed  INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1))
      );

      CREATE TABLE special_event_overrides (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        event_date TEXT NOT NULL UNIQUE,
        label      TEXT NOT NULL,
        is_closed  INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
        open_time  TEXT,
        close_time TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX idx_employee_departments_employee_id ON employee_departments(employee_id);
      CREATE INDEX idx_scheduled_shifts_employee_id ON scheduled_shifts(employee_id);
      CREATE INDEX idx_scheduled_shifts_shift_date ON scheduled_shifts(shift_date);
      CREATE INDEX idx_time_off_requests_employee_id ON time_off_requests(employee_id);
      CREATE INDEX idx_time_off_requests_status ON time_off_requests(status);
    `);
  },
};
