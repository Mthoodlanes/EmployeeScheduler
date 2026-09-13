import type Database from 'better-sqlite3';

export interface Migration {
  /** Sequential id, also used as the sortable/tracking key, e.g. 1. */
  id: number;
  /** Short human-readable name, e.g. 'init'. */
  name: string;
  /** Applies the migration. Runs inside a transaction managed by the runner. */
  up: (db: Database.Database) => void;
}
