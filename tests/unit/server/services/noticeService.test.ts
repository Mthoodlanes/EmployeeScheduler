import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as noticeService from '../../../../server/src/services/noticeService.js';
import {
  NoticeNotFoundError,
  UnauthorizedNoticeActionError,
} from '../../../../server/src/services/noticeService.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

// `postedByEmployeeId` carries a real FK to `employees`, so every actor here
// must be a real row — unlike specialEventService's tests, which don't
// reference employees at all and can use arbitrary hardcoded actor ids.
let managerActor: RequestingActor;
let coordinatorActor: RequestingActor;
let employeeActor: RequestingActor;

beforeEach(async () => {
  await truncateAllTables();

  const manager = await employeeRepo.create({
    name: 'Jesse Manager',
    username: `jesse-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: true,
    departments: [],
  });
  managerActor = { id: manager.id, role: 'manager' };

  const coordinator = await employeeRepo.create({
    name: 'Casey Coordinator',
    username: `casey-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'coordinator',
    isSalaried: false,
    departments: ['front_desk'],
  });
  coordinatorActor = { id: coordinator.id, role: 'coordinator' };

  const employee = await employeeRepo.create({
    name: 'Riley Front',
    username: `riley-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    departments: ['front_desk'],
  });
  employeeActor = { id: employee.id, role: 'employee' };
});

describe('noticeService', () => {
  describe('createNotice', () => {
    it('lets a manager post a notice', async () => {
      const created = await noticeService.createNotice(managerActor, {
        title: 'New special',
        body: 'Tuesday Taco Night starting this week.',
        expiresAt: null,
      });

      expect(created.title).toBe('New special');
      expect(created.postedByEmployeeId).toBe(managerActor.id);
      expect(created.postedByName).toBe('Jesse Manager');
      expect(created.expiresAt).toBeNull();
    });

    it('lets a coordinator post a notice', async () => {
      const created = await noticeService.createNotice(coordinatorActor, {
        title: 'League night',
        body: 'Extended hours this Friday.',
        expiresAt: '2026-09-25',
      });

      expect(created.postedByEmployeeId).toBe(coordinatorActor.id);
      expect(created.expiresAt).not.toBeNull();
    });

    it('refuses a plain employee from posting a notice', async () => {
      await expect(
        noticeService.createNotice(employeeActor, {
          title: 'Not allowed',
          body: 'This should fail.',
          expiresAt: null,
        }),
      ).rejects.toThrow(UnauthorizedNoticeActionError);
    });

    it('requires a title', async () => {
      await expect(
        noticeService.createNotice(managerActor, {
          title: '   ',
          body: 'Body text',
          expiresAt: null,
        }),
      ).rejects.toThrow();
    });

    it('requires a body', async () => {
      await expect(
        noticeService.createNotice(managerActor, {
          title: 'Title',
          body: '',
          expiresAt: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateNotice', () => {
    it('lets a manager edit a notice posted by someone else (a coordinator)', async () => {
      const created = await noticeService.createNotice(coordinatorActor, {
        title: 'Original',
        body: 'Original body',
        expiresAt: null,
      });

      const updated = await noticeService.updateNotice(managerActor, {
        id: created.id,
        title: 'Edited by manager',
        body: 'Updated body',
        expiresAt: null,
      });

      expect(updated.title).toBe('Edited by manager');
      // The author reference doesn't change just because someone else edited it.
      expect(updated.postedByEmployeeId).toBe(coordinatorActor.id);
    });

    it('refuses a plain employee from editing a notice', async () => {
      const created = await noticeService.createNotice(managerActor, {
        title: 'Original',
        body: 'Original body',
        expiresAt: null,
      });

      await expect(
        noticeService.updateNotice(employeeActor, {
          id: created.id,
          title: 'Hacked',
          body: 'Hacked body',
          expiresAt: null,
        }),
      ).rejects.toThrow(UnauthorizedNoticeActionError);
    });

    it('throws when the notice does not exist', async () => {
      await expect(
        noticeService.updateNotice(managerActor, {
          id: 999999,
          title: 'Title',
          body: 'Body',
          expiresAt: null,
        }),
      ).rejects.toThrow(NoticeNotFoundError);
    });
  });

  describe('removeNotice', () => {
    it('lets a coordinator remove a notice', async () => {
      const created = await noticeService.createNotice(managerActor, {
        title: 'To remove',
        body: 'Body',
        expiresAt: null,
      });

      await noticeService.removeNotice(coordinatorActor, created.id);
      expect(await noticeService.listNotices()).toHaveLength(0);
    });

    it('refuses a plain employee from removing a notice', async () => {
      const created = await noticeService.createNotice(managerActor, {
        title: 'Protected',
        body: 'Body',
        expiresAt: null,
      });

      await expect(noticeService.removeNotice(employeeActor, created.id)).rejects.toThrow(
        UnauthorizedNoticeActionError,
      );
    });

    it('throws when the notice does not exist', async () => {
      await expect(noticeService.removeNotice(managerActor, 999999)).rejects.toThrow(
        NoticeNotFoundError,
      );
    });
  });

  describe('listNotices', () => {
    it('is readable by any role, newest first', async () => {
      const first = await noticeService.createNotice(managerActor, {
        title: 'First',
        body: 'Body',
        expiresAt: null,
      });
      const second = await noticeService.createNotice(coordinatorActor, {
        title: 'Second',
        body: 'Body',
        expiresAt: null,
      });

      const all = await noticeService.listNotices();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe(second.id);
      expect(all[1].id).toBe(first.id);
    });
  });

  describe('hasUnreadNotices / markNoticesRead', () => {
    it('is unread by default when a notice exists and the employee has never read the board', async () => {
      await noticeService.createNotice(managerActor, {
        title: 'New special',
        body: 'Body',
        expiresAt: null,
      });

      expect(await noticeService.hasUnreadNotices(employeeActor)).toBe(true);
    });

    it('is not unread when there are no notices at all', async () => {
      expect(await noticeService.hasUnreadNotices(employeeActor)).toBe(false);
    });

    it('clears to not-unread after marking read, then flips back once a newer notice is posted', async () => {
      await noticeService.createNotice(managerActor, {
        title: 'First',
        body: 'Body',
        expiresAt: null,
      });

      await noticeService.markNoticesRead(employeeActor);
      expect(await noticeService.hasUnreadNotices(employeeActor)).toBe(false);

      await noticeService.createNotice(managerActor, {
        title: 'Second',
        body: 'Body',
        expiresAt: null,
      });
      expect(await noticeService.hasUnreadNotices(employeeActor)).toBe(true);
    });

    it('ignores an expired notice when computing unread status', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await noticeService.createNotice(managerActor, {
        title: 'Expired special',
        body: 'Body',
        expiresAt: yesterday,
      });

      expect(await noticeService.hasUnreadNotices(employeeActor)).toBe(false);
    });

    it("marking read is per-employee — one employee's read status doesn't affect another's", async () => {
      await noticeService.createNotice(managerActor, {
        title: 'New special',
        body: 'Body',
        expiresAt: null,
      });

      await noticeService.markNoticesRead(employeeActor);

      expect(await noticeService.hasUnreadNotices(employeeActor)).toBe(false);
      expect(await noticeService.hasUnreadNotices(coordinatorActor)).toBe(true);
    });
  });
});
