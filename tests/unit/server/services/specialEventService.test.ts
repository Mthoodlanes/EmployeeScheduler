import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as specialEventService from '../../../../server/src/services/specialEventService.js';
import {
  SpecialEventNotFoundError,
  UnauthorizedSpecialEventActionError,
} from '../../../../server/src/services/specialEventService.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

const employeeActor: RequestingActor = { id: 1, role: 'employee' };
const managerActor: RequestingActor = { id: 2, role: 'manager' };

beforeEach(async () => {
  await truncateAllTables();
});

describe('specialEventService', () => {
  describe('createSpecialEvent', () => {
    it('lets a manager create an override with custom hours', async () => {
      const created = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      expect(created.label).toBe('League Night');
      expect(created.openTime).toBe('08:00');
    });

    it('lets a manager create a fully-closed override', async () => {
      const created = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'Private Party',
        isClosed: true,
        openTime: null,
        closeTime: null,
      });

      expect(created.isClosed).toBe(true);
    });

    it('refuses a non-manager from creating an override', async () => {
      await expect(
        specialEventService.createSpecialEvent(employeeActor, {
          eventDate: '2026-09-20',
          label: 'League Night',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).rejects.toThrow(UnauthorizedSpecialEventActionError);
    });

    it('requires a label', async () => {
      await expect(
        specialEventService.createSpecialEvent(managerActor, {
          eventDate: '2026-09-20',
          label: '   ',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).rejects.toThrow();
    });

    it('requires both times unless fully closed', async () => {
      await expect(
        specialEventService.createSpecialEvent(managerActor, {
          eventDate: '2026-09-20',
          label: 'League Night',
          isClosed: false,
          openTime: null,
          closeTime: '22:00',
        }),
      ).rejects.toThrow();
    });

    it('allows a close time at/before the open time as a midnight-crossing override', async () => {
      const created = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night — extended',
        isClosed: false,
        openTime: '14:00',
        closeTime: '01:00',
      });

      expect(created.openTime).toBe('14:00');
      expect(created.closeTime).toBe('01:00');
    });

    it('rejects an identical open and close time', async () => {
      await expect(
        specialEventService.createSpecialEvent(managerActor, {
          eventDate: '2026-09-20',
          label: 'League Night',
          isClosed: false,
          openTime: '14:00',
          closeTime: '14:00',
        }),
      ).rejects.toThrow();
    });

    it('rejects a second override on the same date with a friendly error', async () => {
      await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      await expect(
        specialEventService.createSpecialEvent(managerActor, {
          eventDate: '2026-09-20',
          label: 'Another Event',
          isClosed: false,
          openTime: '09:00',
          closeTime: '21:00',
        }),
      ).rejects.toThrow(/already exists/);
    });
  });

  describe('updateSpecialEvent', () => {
    it('lets a manager update an override', async () => {
      const created = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      const updated = await specialEventService.updateSpecialEvent(managerActor, {
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

    it('refuses a non-manager from updating an override', async () => {
      const created = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      await expect(
        specialEventService.updateSpecialEvent(employeeActor, {
          id: created.id,
          eventDate: '2026-09-20',
          label: 'Hacked',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).rejects.toThrow(UnauthorizedSpecialEventActionError);
    });

    it('throws when the override does not exist', async () => {
      await expect(
        specialEventService.updateSpecialEvent(managerActor, {
          id: 999999,
          eventDate: '2026-09-20',
          label: 'League Night',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).rejects.toThrow(SpecialEventNotFoundError);
    });

    it('rejects moving an override onto a date another override already owns', async () => {
      const first = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });
      await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-21',
        label: 'Tournament',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      await expect(
        specialEventService.updateSpecialEvent(managerActor, {
          id: first.id,
          eventDate: '2026-09-21',
          label: 'League Night',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).rejects.toThrow(/already exists/);
    });

    it('allows saving an override without changing its own date', async () => {
      const created = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      await expect(
        specialEventService.updateSpecialEvent(managerActor, {
          id: created.id,
          eventDate: '2026-09-20',
          label: 'League Night — renamed',
          isClosed: false,
          openTime: '08:00',
          closeTime: '22:00',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('removeSpecialEvent', () => {
    it('lets a manager remove an override', async () => {
      const created = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      await specialEventService.removeSpecialEvent(managerActor, created.id);
      expect(await specialEventService.listSpecialEvents()).toHaveLength(0);
    });

    it('refuses a non-manager from removing an override', async () => {
      const created = await specialEventService.createSpecialEvent(managerActor, {
        eventDate: '2026-09-20',
        label: 'League Night',
        isClosed: false,
        openTime: '08:00',
        closeTime: '22:00',
      });

      await expect(
        specialEventService.removeSpecialEvent(employeeActor, created.id),
      ).rejects.toThrow(UnauthorizedSpecialEventActionError);
    });

    it('throws when the override does not exist', async () => {
      await expect(specialEventService.removeSpecialEvent(managerActor, 999999)).rejects.toThrow(
        SpecialEventNotFoundError,
      );
    });
  });
});
