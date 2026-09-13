import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migrations/runMigrations';
import { seedDefaults } from '../../../src/main/db/seedDefaults';

interface CountRow {
  count: number;
}

interface ShiftTemplateRow {
  department: string | null;
  start_time: string | null;
  end_time: string | null;
  start_anchor: string;
  end_anchor: string;
}

interface StoreHoursRow {
  open_time: string;
  close_time: string;
  is_closed: number;
}

describe('seedDefaults', () => {
  it('creates exactly the 10 default shift templates (all shared, department NULL) and 7 store-hours rows', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedDefaults(db);

    const templateCount = db
      .prepare('SELECT COUNT(*) as count FROM shift_templates')
      .get() as CountRow;
    expect(templateCount.count).toBe(10);

    const sharedCount = db
      .prepare('SELECT COUNT(*) as count FROM shift_templates WHERE department IS NULL')
      .get() as CountRow;
    expect(sharedCount.count).toBe(10);

    const storeHoursCount = db
      .prepare('SELECT COUNT(*) as count FROM store_hours')
      .get() as CountRow;
    expect(storeHoursCount.count).toBe(7);

    db.close();
  });

  it('is idempotent — running it again does not create duplicates', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedDefaults(db);
    seedDefaults(db);
    seedDefaults(db);

    const templateCount = db
      .prepare('SELECT COUNT(*) as count FROM shift_templates')
      .get() as CountRow;
    expect(templateCount.count).toBe(10);

    const storeHoursCount = db
      .prepare('SELECT COUNT(*) as count FROM store_hours')
      .get() as CountRow;
    expect(storeHoursCount.count).toBe(7);

    db.close();
  });

  it('seeds "2pm–Close" anchored to close, with no literal end time, usable from any department', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedDefaults(db);

    const template = db
      .prepare("SELECT * FROM shift_templates WHERE name = '2pm–Close'")
      .get() as ShiftTemplateRow;
    expect(template.department).toBeNull();
    expect(template.start_anchor).toBe('fixed');
    expect(template.start_time).toBe('14:00');
    expect(template.end_anchor).toBe('close');
    expect(template.end_time).toBeNull();

    db.close();
  });

  it('seeds the real weekly hours, including midnight-crossing Wednesday/Friday/Saturday closes', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedDefaults(db);

    const byDay = (dayOfWeek: number): StoreHoursRow =>
      db
        .prepare('SELECT open_time, close_time, is_closed FROM store_hours WHERE day_of_week = ?')
        .get(dayOfWeek) as StoreHoursRow;

    expect(byDay(0)).toEqual({ open_time: '11:00', close_time: '23:00', is_closed: 0 });
    expect(byDay(3)).toEqual({ open_time: '14:00', close_time: '00:00', is_closed: 0 });
    expect(byDay(5)).toEqual({ open_time: '14:00', close_time: '00:00', is_closed: 0 });
    expect(byDay(6)).toEqual({ open_time: '12:00', close_time: '00:00', is_closed: 0 });

    db.close();
  });
});
