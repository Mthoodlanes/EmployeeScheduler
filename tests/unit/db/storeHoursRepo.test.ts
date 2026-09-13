import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as storeHoursRepo from '../../../src/main/db/repositories/storeHoursRepo';

beforeEach(() => {
  // Fresh in-memory database per test: initDb() memoizes a singleton keyed
  // by process, so reach past it here to guarantee isolation between tests.
  const db = initDb(':memory:');
  db.exec('DELETE FROM store_hours;');
});

describe('storeHoursRepo', () => {
  it('lists no rows when nothing has been configured yet', () => {
    expect(storeHoursRepo.listAll()).toEqual([]);
  });

  it('creates a row for a day-of-week that has no row yet', () => {
    const created = storeHoursRepo.upsert({
      dayOfWeek: 2,
      openTime: '10:00',
      closeTime: '22:00',
      isClosed: false,
    });

    expect(created.dayOfWeek).toBe(2);
    expect(created.openTime).toBe('10:00');
    expect(created.closeTime).toBe('22:00');
    expect(created.isClosed).toBe(false);
    expect(storeHoursRepo.listAll()).toHaveLength(1);
  });

  it('replaces the existing row for a day-of-week rather than duplicating it', () => {
    storeHoursRepo.upsert({ dayOfWeek: 2, openTime: '10:00', closeTime: '22:00', isClosed: false });
    const updated = storeHoursRepo.upsert({
      dayOfWeek: 2,
      openTime: '08:00',
      closeTime: '20:00',
      isClosed: false,
    });

    expect(updated.openTime).toBe('08:00');
    expect(updated.closeTime).toBe('20:00');
    const all = storeHoursRepo.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].openTime).toBe('08:00');
  });

  it('nulls out open/close times when marking a day closed', () => {
    const closed = storeHoursRepo.upsert({
      dayOfWeek: 1,
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: true,
    });

    expect(closed.isClosed).toBe(true);
    expect(closed.openTime).toBeNull();
    expect(closed.closeTime).toBeNull();
  });

  it('finds a row by day-of-week, and returns undefined when there is none', () => {
    storeHoursRepo.upsert({ dayOfWeek: 3, openTime: '10:00', closeTime: '22:00', isClosed: false });

    expect(storeHoursRepo.getByDayOfWeek(3)?.dayOfWeek).toBe(3);
    expect(storeHoursRepo.getByDayOfWeek(4)).toBeUndefined();
  });

  it('lists rows ordered by day-of-week', () => {
    storeHoursRepo.upsert({ dayOfWeek: 5, openTime: '10:00', closeTime: '22:00', isClosed: false });
    storeHoursRepo.upsert({ dayOfWeek: 0, openTime: '11:00', closeTime: '20:00', isClosed: false });
    storeHoursRepo.upsert({ dayOfWeek: 2, openTime: '10:00', closeTime: '22:00', isClosed: false });

    const all = storeHoursRepo.listAll();
    expect(all.map((row) => row.dayOfWeek)).toEqual([0, 2, 5]);
  });
});
