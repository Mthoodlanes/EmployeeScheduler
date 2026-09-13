import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as storeHoursService from '../../../src/main/services/storeHoursService';
import { UnauthorizedStoreHoursActionError } from '../../../src/main/services/storeHoursService';

let employeeActor: { id: number; role: 'employee' };
let managerActor: { id: number; role: 'manager' };

beforeEach(() => {
  const db = initDb(':memory:');
  db.exec('DELETE FROM store_hours;');
  employeeActor = { id: 1, role: 'employee' };
  managerActor = { id: 2, role: 'manager' };
});

describe('storeHoursService', () => {
  describe('upsertStoreHours', () => {
    it('lets a manager set a day-of-week to open hours', () => {
      const result = storeHoursService.upsertStoreHours(managerActor, {
        dayOfWeek: 2,
        openTime: '10:00',
        closeTime: '22:00',
        isClosed: false,
      });

      expect(result.openTime).toBe('10:00');
      expect(result.isClosed).toBe(false);
    });

    it('lets a manager mark a day fully closed', () => {
      const result = storeHoursService.upsertStoreHours(managerActor, {
        dayOfWeek: 1,
        openTime: null,
        closeTime: null,
        isClosed: true,
      });

      expect(result.isClosed).toBe(true);
      expect(result.openTime).toBeNull();
    });

    it('refuses a non-manager from setting store hours', () => {
      expect(() =>
        storeHoursService.upsertStoreHours(employeeActor, {
          dayOfWeek: 2,
          openTime: '10:00',
          closeTime: '22:00',
          isClosed: false,
        }),
      ).toThrow(UnauthorizedStoreHoursActionError);
    });

    it('rejects an open day missing an open or close time', () => {
      expect(() =>
        storeHoursService.upsertStoreHours(managerActor, {
          dayOfWeek: 2,
          openTime: null,
          closeTime: '22:00',
          isClosed: false,
        }),
      ).toThrow();
    });

    it('rejects an identical open and close time (ambiguous — could mean 0 or 24 hours)', () => {
      expect(() =>
        storeHoursService.upsertStoreHours(managerActor, {
          dayOfWeek: 2,
          openTime: '10:00',
          closeTime: '10:00',
          isClosed: false,
        }),
      ).toThrow();
    });

    it('allows a close time at/before the open time as a midnight-crossing day (e.g. the real Wednesday hours: 14:00-00:00)', () => {
      const result = storeHoursService.upsertStoreHours(managerActor, {
        dayOfWeek: 3,
        openTime: '14:00',
        closeTime: '00:00',
        isClosed: false,
      });

      expect(result.openTime).toBe('14:00');
      expect(result.closeTime).toBe('00:00');
    });

    it('allows a close time earlier in the clock than open (e.g. 22:00-10:00, closing well past midnight)', () => {
      const result = storeHoursService.upsertStoreHours(managerActor, {
        dayOfWeek: 2,
        openTime: '22:00',
        closeTime: '10:00',
        isClosed: false,
      });

      expect(result.openTime).toBe('22:00');
      expect(result.closeTime).toBe('10:00');
    });
  });

  describe('listStoreHours', () => {
    it('is readable without a manager role', () => {
      storeHoursService.upsertStoreHours(managerActor, {
        dayOfWeek: 2,
        openTime: '10:00',
        closeTime: '22:00',
        isClosed: false,
      });

      expect(storeHoursService.listStoreHours()).toHaveLength(1);
    });
  });
});
