import type { Migration } from './types';

/**
 * Milestone 6: mirrors migration 005's anchor columns onto `scheduled_shifts`
 * (copied from the template at assignment time, or set directly for a
 * from-scratch "custom time" entry). `start_time`/`end_time` become nullable
 * too — an anchored shift resolves its actual clock time live from that
 * date's effective store hours (`hoursResolution#resolveShiftTime`) rather
 * than storing a frozen literal, so there is nothing to write into those
 * columns for the anchored edge. Requires the same recreate-table pattern as
 * migration 005/004 since SQLite can't relax a `NOT NULL` in place.
 */
export const migration006ScheduledShiftAnchors: Migration = {
  id: 6,
  name: 'scheduled_shift_anchors',
  up: (db) => {
    db.exec(`
      CREATE TABLE scheduled_shifts_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        department   TEXT NOT NULL CHECK (department IN ('front_desk', 'cafe', 'bar')),
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
        (id, employee_id, department, shift_date, start_time, end_time, template_id, is_override, notes, created_at, updated_at)
      SELECT id, employee_id, department, shift_date, start_time, end_time, template_id, is_override, notes, created_at, updated_at
      FROM scheduled_shifts;

      DROP TABLE scheduled_shifts;
      ALTER TABLE scheduled_shifts_new RENAME TO scheduled_shifts;

      CREATE INDEX idx_scheduled_shifts_employee_id ON scheduled_shifts(employee_id);
      CREATE INDEX idx_scheduled_shifts_shift_date ON scheduled_shifts(shift_date);
    `);
  },
};
