import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as specialEventService from '../../../src/main/services/specialEventService';
import {
  SpecialEventNotFoundError,
  UnauthorizedSpecialEventActionError,
} from '../../../src/main/services/specialEventService';

let employeeActor: { id: number; role: 'employee' };
let managerActor: { id: number; role: 'manager' };

beforeEach(() => {
  const db = initDb(':memory:');
  db.exec('DELETE FROM special_event_overrides;');
  employeeActor = { id: 1, role: 'employee' };
  managerActor = { id: 2, role: 'manager' };
});

describe('specialEventService', () => {
  describe('createSpecialEvent', () => {
    it('lets a manager create an override with custom hours', () => {
      const created = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      expect(created.label).toBe('League Night');
      expect(created.openTime).toBe('08:00');
    });

    it('lets a manager create a fully-closed override', () => {
      const created = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'Private Party',
        isClosed: true,
        openTime: null,
        closeTime: null,
      });

      expect(created.isClosed).toBe(true);
    });

    it('refuses a non-manager from creating an override', () => {
      expect(() =>
        specialEventService.createSpecialEvent(employeeActor, {
          eventDate: '2026-09-20',
          label: 'League Night',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).toThrow(UnauthorizedSpecialEventActionError);
    });

    it('requires a label', () => {
      expect(() =>
        specialEventService.createSpecialEvent(managerActor, {
          eventDate: '2026-09-20',
          label: '   ',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).toThrow();
    });

    it('requires both times unless fully closed', () => {
      expect(() =>
        specialEventService.createSpecialEvent(managerActor, {
          eventDate: '2026-09-20',
          label: 'League Night',
          isClosed: false,
          openTime: null,
          closeTime: '22:00',
        }),
      ).toThrow();
    });

    it('allows a close time at/before the open time as a midnight-crossing override', () => {
      const created = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night — extended',
        isClosed: false,
        openTime: '14:00',
        closeTime: '01:00',
      });

      expect(created.openTime).toBe('14:00');
      expect(created.closeTime).toBe('01:00');
    });

    it('rejects an identical open and close time', () => {
      expect(() =>
        specialEventService.createSpecialEvent(managerActor, {
          eventDate: '2026-09-20',
          label: 'League Night',
          isClosed: false,
          openTime: '14:00',
          closeTime: '14:00',
        }),
      ).toThrow();
    });

    it('rejects a second override on the same date with a friendly error', () => {
      specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      expect(() =>
        specialEventService.createSpecialEvent(managerActor, {
          eventDate: '2026-09-20',
          label: 'Another Event',
          isClosed: false,
          openTime: '09:00',
          closeTime: '21:00',
        }),
      ).toThrow(/already exists/);
    });
  });

  describe('updateSpecialEvent', () => {
    it('lets a manager update an override', () => {
      const created = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      const updated = specialEventService.updateSpecialEvent(managerActor, {
        id: created.id,
        eventDate: '2026-09-20',
        label: 'League Night — updated',
        isClosed: false,
        openTime: '07:00',
        closeTime: '23:00',
      });

      expect(updated.label).toBe('League Night — updated');
      expect(updated.openTime).toBe('07:00');
    });

    it('refuses a non-manager from updating an override', () => {
      const created = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      expect(() =>
        specialEventService.updateSpecialEvent(employeeActor, {
          id: created.id,
          eventDate: '2026-09-20',
          label: 'Hacked',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).toThrow(UnauthorizedSpecialEventActionError);
    });

    it('throws when the override does not exist', () => {
      expect(() =>
        specialEventService.updateSpecialEvent(managerActor, {
          id: 999999,
          eventDate: '2026-09-20',
          label: 'League Night',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).toThrow(SpecialEventNotFoundError);
    });

    it('rejects moving an override onto a date another override already owns', () => {
      const first = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });
      specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-21',
        label: 'Tournament',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      expect(() =>
        specialEventService.updateSpecialEvent(managerActor, {
          id: first.id,
          eventDate: '2026-09-21',
          label: 'League Night',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).toThrow(/already exists/);
    });

    it('allows saving an override without changing its own date', () => {
      const created = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      expect(() =>
        specialEventService.updateSpecialEvent(managerActor, {
          id: created.id,
          eventDate: '2026-09-20',
          label: 'League Night — renamed',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).not.toThrow();
    });
  });

  describe('removeSpecialEvent', () => {
    it('lets a manager remove an override', () => {
      const created = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      specialEventService.removeSpecialEvent(managerActor, created.id);
      expect(specialEventService.listSpecialEvents()).toHaveLength(0);
    });

    it('refuses a non-manager from removing an override', () => {
      const created = specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      expect(() => specialEventService.removeSpecialEvent(employeeActor, created.id)).toThrow(
        UnauthorizedSpecialEventActionError,
      );
    });

    it('throws when the override does not exist', () => {
      expect(() => specialEventService.removeSpecialEvent(managerActor, 999999)).toThrow(
        SpecialEventNotFoundError,
      );
    });
  });
});
