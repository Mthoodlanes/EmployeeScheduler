import type { Migration } from './types';

/**
 * Milestone 3: adds the manager's optional decision note, shown to the
 * employee when a time-off request is denied. Migration 001 created
 * `time_off_requests` without it since milestone 1/2 had no time-off UI yet.
 */
export const migration003TimeOffExtras: Migration = {
  id: 3,
  name: 'time_off_extras',
  up: (db) => {
    db.exec(`
      ALTER TABLE time_off_requests ADD COLUMN decision_note TEXT;
    `);
  },
};
