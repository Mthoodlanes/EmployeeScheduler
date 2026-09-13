import type { Migration } from './types';

/**
 * Milestone 2: extends the shift-template/scheduled-shift tables created in
 * migration 001 with fields milestone 1 did not yet need — an `is_active`
 * flag for templates (so a manager can retire an old template without
 * deleting the shift history that still references it) and a free-text
 * `notes` field on scheduled shifts (surfaced when a manager overrides an
 * individual shift's time).
 */
export const migration002ScheduleExtras: Migration = {
  id: 2,
  name: 'schedule_extras',
  up: (db) => {
    db.exec(`
      ALTER TABLE shift_templates ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
      ALTER TABLE scheduled_shifts ADD COLUMN notes TEXT;
    `);
  },
};
