import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migrations/runMigrations';

describe('runMigrations', () => {
  it('creates all expected tables and records the applied migration', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map((row) => row.name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'employees',
        'employee_departments',
        'shift_templates',
        'scheduled_shifts',
        'time_off_requests',
        'employee_preferences',
        'employee_unavailability',
        'store_hours',
        'special_event_overrides',
        'schema_migrations',
      ]),
    );

    const applied = db.prepare('SELECT id, name FROM schema_migrations').all();
    expect(applied).toEqual([
      { id: 1, name: 'init' },
      { id: 2, name: 'schedule_extras' },
      { id: 3, name: 'time_off_extras' },
      { id: 4, name: 'preference_notes' },
      { id: 5, name: 'shift_template_anchors' },
      { id: 6, name: 'scheduled_shift_anchors' },
      { id: 7, name: 'employee_unavailability' },
    ]);

    db.close();
  });

  it('is idempotent — running twice does not re-apply migrations', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();

    const { count } = db.prepare('SELECT COUNT(*) as count FROM schema_migrations').get() as {
      count: number;
    };
    expect(count).toBe(7);

    db.close();
  });
});
