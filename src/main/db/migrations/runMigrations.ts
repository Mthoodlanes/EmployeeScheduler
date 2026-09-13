import type Database from 'better-sqlite3';
import { migrations } from './index';

/**
 * Hand-rolled migration runner. Ensures a `schema_migrations` tracking
 * table exists, then applies (in a transaction) every migration whose id
 * has not already been recorded, in ascending id order.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const appliedIds = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: number }).id),
  );

  const pending = [...migrations].sort((a, b) => a.id - b.id).filter((m) => !appliedIds.has(m.id));

  const recordMigration = db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)');

  pending.forEach((migration) => {
    const applyMigration = db.transaction(() => {
      migration.up(db);
      recordMigration.run(migration.id, migration.name);
    });
    applyMigration();
  });
}
