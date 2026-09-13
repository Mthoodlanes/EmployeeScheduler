import type { Migration } from './types';

/**
 * Milestone 6: two related schema changes to `shift_templates`, both
 * requiring the SQLite recreate-table pattern (same technique as migration
 * 004), so they're bundled into a single recreate rather than two:
 *
 *  - `department` becomes nullable. NULL means the template is "shared" —
 *    usable from any of the three department tabs — needed for the shared
 *    default shift library seeded by `seedDefaults.ts`. A non-null value
 *    keeps restricting the template to that one department tab, as before.
 *  - `start_time`/`end_time` become nullable, and two new columns,
 *    `start_anchor`/`end_anchor`, record whether each edge is a literal
 *    clock time (`'fixed'`, the only value existing rows can have — the
 *    column DEFAULT applies automatically since old rows aren't part of the
 *    INSERT...SELECT's column list) or anchored to that day's resolved
 *    store open/close time instead (e.g. "2pm-Close").
 */
export const migration005ShiftTemplateAnchors: Migration = {
  id: 5,
  name: 'shift_template_anchors',
  up: (db) => {
    db.exec(`
      CREATE TABLE shift_templates_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        department   TEXT CHECK (department IN ('front_desk', 'cafe', 'bar')),
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
        (id, department, name, start_time, end_time, color, is_active, created_at, updated_at)
      SELECT id, department, name, start_time, end_time, color, is_active, created_at, updated_at
      FROM shift_templates;

      DROP TABLE shift_templates;
      ALTER TABLE shift_templates_new RENAME TO shift_templates;
    `);
  },
};
