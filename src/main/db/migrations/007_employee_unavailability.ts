import type { Migration } from './types';

/**
 * Milestone 8: adds `employee_unavailability` — a recurring day-of-week +
 * time-window HARD constraint, distinct from `time_off_requests` (one-off
 * date range) and `employee_preferences` (soft, non-blocking). Mirrors
 * `time_off_requests`' pending/approved/denied workflow columns
 * (status/decided_by/decided_at/decision_note), plus `requested_by` to
 * record who submitted it — usually the employee themselves, but a manager
 * may submit on an employee's behalf (auto-approved at the service layer).
 */
export const migration007EmployeeUnavailability: Migration = {
  id: 7,
  name: 'employee_unavailability',
  up: (db) => {
    db.exec(`
      CREATE TABLE employee_unavailability (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_time    TEXT NOT NULL,
        end_time      TEXT NOT NULL,
        reason        TEXT,
        status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
        requested_by  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        decided_by    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        decided_at    TEXT,
        decision_note TEXT,
        created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX idx_employee_unavailability_employee_id ON employee_unavailability(employee_id);
      CREATE INDEX idx_employee_unavailability_status ON employee_unavailability(status);
    `);
  },
};
