import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as unavailabilityRepo from '../../../../server/src/db/repositories/unavailabilityRepo.js';
import * as unavailabilityService from '../../../../server/src/services/unavailabilityService.js';
import {
  InvalidApprovalTransitionError,
  UnauthorizedUnavailabilityActionError,
  UnavailabilityRequestNotFoundError,
} from '../../../../server/src/services/unavailabilityService.js';
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
  employeeActor = { id: employee.id, role: 'employee' };

  const otherEmployee = await employeeRepo.create({
    name: 'Other Employee',
    username: `other-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  otherEmployeeActor = { id: otherEmployee.id, role: 'employee' };

  const manager = await employeeRepo.create({
    name: 'Dana Manager',
    username: `dana-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  managerActor = { id: manager.id, role: 'manager' };
});

describe('unavailabilityService', () => {
  describe('createOwnRequest / listOwnRequests', () => {
    it('creates a request under the acting employee, starting pending', async () => {
      const created = await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
        reason: 'Church',
      });
      expect(created.employeeId).toBe(employeeActor.id);
      expect(created.requestedBy).toBe(employeeActor.id);
      expect(created.status).toBe('pending');
    });

    it('rejects an out-of-range day of week', async () => {
      await expect(
        unavailabilityService.createOwnRequest(employeeActor, {
          dayOfWeek: 7,
          startTime: '09:00',
          endTime: '17:00',
        }),
      ).rejects.toThrow();
      await expect(
        unavailabilityService.createOwnRequest(employeeActor, {
          dayOfWeek: -1,
          startTime: '09:00',
          endTime: '17:00',
        }),
      ).rejects.toThrow();
    });

    it('rejects a missing start or end time', async () => {
      await expect(
        unavailabilityService.createOwnRequest(employeeActor, {
          dayOfWeek: 0,
          startTime: '',
          endTime: '17:00',
        }),
      ).rejects.toThrow();
      await expect(
        unavailabilityService.createOwnRequest(employeeActor, {
          dayOfWeek: 0,
          startTime: '09:00',
          endTime: '',
        }),
      ).rejects.toThrow();
    });

    it('only returns the acting employee own requests, never another employee requests', async () => {
      await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
      });
      await unavailabilityService.createOwnRequest(otherEmployeeActor, {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
      });

      const mine = await unavailabilityService.listOwnRequests(employeeActor);
      expect(mine).toHaveLength(1);
      expect(mine.every((r) => r.employeeId === employeeActor.id)).toBe(true);
    });
  });

  describe('createForEmployee', () => {
    it('lets a manager create an auto-approved entry for another employee', async () => {
      const created = await unavailabilityService.createForEmployee(managerActor, {
        employeeId: employeeActor.id,
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
        reason: 'Cannot work Sundays',
      });

      expect(created.employeeId).toBe(employeeActor.id);
      expect(created.requestedBy).toBe(managerActor.id);
      expect(created.status).toBe('approved');
      expect(created.decidedBy).toBe(managerActor.id);
      expect(created.decidedAt).not.toBeNull();
    });

    it('refuses a non-manager from submitting on another employee behalf', async () => {
      await expect(
        unavailabilityService.createForEmployee(employeeActor, {
          employeeId: otherEmployeeActor.id,
          dayOfWeek: 0,
          startTime: '00:00',
          endTime: '23:59',
        }),
      ).rejects.toThrow(UnauthorizedUnavailabilityActionError);
    });

    it('still validates the day-of-week/time window for a manager submission', async () => {
      await expect(
        unavailabilityService.createForEmployee(managerActor, {
          employeeId: employeeActor.id,
          dayOfWeek: 9,
          startTime: '00:00',
          endTime: '23:59',
        }),
      ).rejects.toThrow();
    });
  });

  describe('listAllRequests', () => {
    it('allows a manager to list every request', async () => {
      await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
      });
      await unavailabilityService.createOwnRequest(otherEmployeeActor, {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
      });

      const all = await unavailabilityService.listAllRequests(managerActor);
      expect(all).toHaveLength(2);
    });

    it('refuses a non-manager, even for their own request list', async () => {
      await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
      });
      await expect(unavailabilityService.listAllRequests(employeeActor)).rejects.toThrow(
        UnauthorizedUnavailabilityActionError,
      );
    });
  });

  describe('decideRequest', () => {
    it('lets a manager approve a pending request', async () => {
      const created = await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });

      const decided = await unavailabilityService.decideRequest(managerActor, {
        id: created.id,
        status: 'approved',
      });

      expect(decided.status).toBe('approved');
      expect(decided.decidedBy).toBe(managerActor.id);
    });

    it('lets a manager deny a pending request with a decision note', async () => {
      const created = await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });

      const decided = await unavailabilityService.decideRequest(managerActor, {
        id: created.id,
        status: 'denied',
        decisionNote: 'Need evening coverage',
      });

      expect(decided.status).toBe('denied');
      expect(decided.decisionNote).toBe('Need evening coverage');
    });

    it('refuses a non-manager from approving or denying', async () => {
      const created = await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });

      await expect(
        unavailabilityService.decideRequest(employeeActor, { id: created.id, status: 'approved' }),
      ).rejects.toThrow(UnauthorizedUnavailabilityActionError);
    });

    it('throws when the request does not exist', async () => {
      await expect(
        unavailabilityService.decideRequest(managerActor, { id: 999999, status: 'approved' }),
      ).rejects.toThrow(UnavailabilityRequestNotFoundError);
    });

    it('refuses to re-decide an already-approved (terminal) request', async () => {
      const created = await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });
      await unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'approved' });

      await expect(
        unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'denied' }),
      ).rejects.toThrow(InvalidApprovalTransitionError);
    });

    it('refuses to re-decide an already-denied (terminal) request', async () => {
      const created = await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });
      await unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'denied' });

      await expect(
        unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'approved' }),
      ).rejects.toThrow(InvalidApprovalTransitionError);
    });
  });

  describe('listApprovedAll', () => {
    it('returns only approved entries across every employee', async () => {
      const created = await unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
      });
      await unavailabilityService.createOwnRequest(otherEmployeeActor, {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
      });
      await unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'approved' });

      const results = await unavailabilityService.listApprovedAll();
      expect(results).toHaveLength(1);
      expect(results[0].employeeId).toBe(employeeActor.id);
    });
  });

  // Sanity check that the repo layer itself never leaks another employee's
  // data — the service relies on this for the "own requests only" guarantee.
  it('repo listByEmployee stays scoped even if the service is bypassed', async () => {
    await unavailabilityRepo.create({
      employeeId: employeeActor.id,
      requestedBy: employeeActor.id,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
    });
    await unavailabilityRepo.create({
      employeeId: otherEmployeeActor.id,
      requestedBy: otherEmployeeActor.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });
    expect(await unavailabilityRepo.listByEmployee(employeeActor.id)).toHaveLength(1);
  });
});
