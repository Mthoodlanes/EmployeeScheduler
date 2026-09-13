import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations/runMigrations';
import { seedDefaults } from './seedDefaults';

let dbInstance: Database.Database | null = null;

/**
 * Opens (creating if necessary) the SQLite database at `dbFilePath` and runs
 * any pending migrations. Safe to call multiple times; subsequent calls
 * return the existing singleton connection.
 */
export function initDb(dbFilePath: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

  const db = new Database(dbFilePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  seedDefaults(db);

  dbInstance = db;
  return db;
}

/** Returns the already-initialized database connection. */
export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return dbInstance;
}

export function closeDb(): void {
  dbInstance?.close();
  dbInstance = null;
}
