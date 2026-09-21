import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as timeOffRepo from '../../../../server/src/db/repositories/timeOffRepo.js';
import * as timeOffService from '../../../../server/src/services/timeOffService.js';
import {
  InvalidApprovalTransitionError,
  TimeOffRequestNotFoundError,
  UnauthorizedTimeOffActionError,
} from '../../../../server/src/services/timeOffService.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

let employeeActor: RequestingActor;
let otherEmployeeActor: RequestingActor;
let managerActor: RequestingActor;

beforeEach(async () => {
  await truncateAllTables();

  const employee = await employeeRepo.create({
    name: 'Riley Front',
    username: `riley-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: ['front_desk'],
  });
  employeeActor = { id: employee.id, role: 'employee', isSecretaryTagged: false };

  const otherEmployee = await employeeRepo.create({
    name: 'Other Employee',
    username: `other-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  otherEmployeeActor = { id: otherEmployee.id, role: 'employee', isSecretaryTagged: false };

  const manager = await employeeRepo.create({
    name: 'Dana Manager',
    username: `dana-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  managerActor = { id: manager.id, role: 'manager', isSecretaryTagged: false };
});

describe('timeOffService', () => {
  describe('createOwnRequest / listOwnRequests', () => {
    it('creates a request under the acting employee, ignoring any other employee id', async () => {
      const created = await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-15',
        reason: 'Family trip',
      });
      expect(created.employeeId).toBe(employeeActor.id);
      expect(created.status).toBe('pending');
    });

    it('rejects an end date before the start date', async () => {
      await expect(
        timeOffService.createOwnRequest(employeeActor, {
          startDate: '2026-09-15',
          endDate: '2026-09-14',
        }),
      ).rejects.toThrow();
    });

    it('only returns the acting employee own requests, never another employee requests', async () => {
      await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });
      await timeOffService.createOwnRequest(otherEmployeeActor, {
        startDate: '2026-09-02',
        endDate: '2026-09-02',
      });

      const mine = await timeOffService.listOwnRequests(employeeActor);
      expect(mine).toHaveLength(1);
      expect(mine.every((r) => r.employeeId === employeeActor.id)).toBe(true);
    });
  });

  describe('createForEmployee', () => {
    it('lets a manager create an auto-approved request for another employee', async () => {
      const created = await timeOffService.createForEmployee(managerActor, {
        employeeId: employeeActor.id,
        startDate: '2026-09-14',
        endDate: '2026-09-15',
        reason: "Can't get in themselves",
      });

      expect(created.employeeId).toBe(employeeActor.id);
      expect(created.status).toBe('approved');
      expect(created.decidedBy).toBe(managerActor.id);
      expect(created.decidedAt).not.toBeNull();
    });

    it('refuses a non-manager from submitting on another employee behalf', async () => {
      await expect(
        timeOffService.createForEmployee(employeeActor, {
          employeeId: otherEmployeeActor.id,
          startDate: '2026-09-14',
          endDate: '2026-09-15',
        }),
      ).rejects.toThrow(UnauthorizedTimeOffActionError);
    });

    it('still rejects an end date before the start date for a manager submission', async () => {
      await expect(
        timeOffService.createForEmployee(managerActor, {
          employeeId: employeeActor.id,
          startDate: '2026-09-15',
          endDate: '2026-09-14',
        }),
      ).rejects.toThrow();
    });
  });

  describe('listAllRequests', () => {
    it('allows a manager to list every request', async () => {
      await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });
      await timeOffService.createOwnRequest(otherEmployeeActor, {
        startDate: '2026-09-02',
        endDate: '2026-09-02',
      });

      const all = await timeOffService.listAllRequests(managerActor);
      expect(all).toHaveLength(2);
    });

    it('refuses a non-manager, even for their own request list', async () => {
      await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });
      await expect(timeOffService.listAllRequests(employeeActor)).rejects.toThrow(
        UnauthorizedTimeOffActionError,
      );
    });
  });

  describe('decideRequest', () => {
    it('lets a manager approve a pending request', async () => {
      const created = await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });

      const decided = await timeOffService.decideRequest(managerActor, {
        id: created.id,
        status: 'approved',
      });

      expect(decided.status).toBe('approved');
      expect(decided.decidedBy).toBe(managerActor.id);
    });

    it('lets a manager deny a pending request with a decision note', async () => {
      const created = await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });

      const decided = await timeOffService.decideRequest(managerActor, {
        id: created.id,
        status: 'denied',
        decisionNote: 'Short-staffed that week',
      });

      expect(decided.status).toBe('denied');
      expect(decided.decisionNote).toBe('Short-staffed that week');
    });

    it('refuses a non-manager from approving or denying', async () => {
      const created = await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });

      await expect(
        timeOffService.decideRequest(employeeActor, { id: created.id, status: 'approved' }),
      ).rejects.toThrow(UnauthorizedTimeOffActionError);
    });

    it('throws when the request does not exist', async () => {
      await expect(
        timeOffService.decideRequest(managerActor, { id: 999999, status: 'approved' }),
      ).rejects.toThrow(TimeOffRequestNotFoundError);
    });

    it('refuses to re-decide an already-approved (terminal) request', async () => {
      const created = await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });
      await timeOffService.decideRequest(managerActor, { id: created.id, status: 'approved' });

      await expect(
        timeOffService.decideRequest(managerActor, { id: created.id, status: 'denied' }),
      ).rejects.toThrow(InvalidApprovalTransitionError);
    });

    it('refuses to re-decide an already-denied (terminal) request', async () => {
      const created = await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });
      await timeOffService.decideRequest(managerActor, { id: created.id, status: 'denied' });

      await expect(
        timeOffService.decideRequest(managerActor, { id: created.id, status: 'approved' }),
      ).rejects.toThrow(InvalidApprovalTransitionError);
    });
  });

  describe('listApprovedForRange', () => {
    it('returns only approved requests overlapping the range', async () => {
      const created = await timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-08',
        endDate: '2026-09-09',
      });
      await timeOffService.createOwnRequest(otherEmployeeActor, {
        startDate: '2026-09-08',
        endDate: '2026-09-09',
      });
      await timeOffService.decideRequest(managerActor, { id: created.id, status: 'approved' });

      const results = await timeOffService.listApprovedForRange('2026-09-07', '2026-09-13');
      expect(results).toHaveLength(1);
      expect(results[0].employeeId).toBe(employeeActor.id);
    });
  });

  // Sanity check that the repo layer itself never leaks another employee's
  // data — the service relies on this for the "own requests only" guarantee.
  it('repo listByEmployee stays scoped even if the service is bypassed', async () => {
    await timeOffRepo.create({
      employeeId: employeeActor.id,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
    });
    await timeOffRepo.create({
      employeeId: otherEmployeeActor.id,
      startDate: '2026-09-02',
      endDate: '2026-09-02',
    });
    expect(await timeOffRepo.listByEmployee(employeeActor.id)).toHaveLength(1);
  });
});
