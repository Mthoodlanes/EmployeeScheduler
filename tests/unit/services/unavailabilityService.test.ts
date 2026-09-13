import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';
import * as unavailabilityRepo from '../../../src/main/db/repositories/unavailabilityRepo';
import * as unavailabilityService from '../../../src/main/services/unavailabilityService';
import {
  InvalidApprovalTransitionError,
  UnauthorizedUnavailabilityActionError,
  UnavailabilityRequestNotFoundError,
} from '../../../src/main/services/unavailabilityService';

let employeeActor: { id: number; role: 'employee' };
let otherEmployeeActor: { id: number; role: 'employee' };
let managerActor: { id: number; role: 'manager' };

beforeEach(() => {
  const db = initDb(':memory:');
  db.exec(
    'DELETE FROM employee_unavailability; DELETE FROM employee_departments; DELETE FROM employees;',
  );

  const employee = employeeRepo.create({
    name: 'Riley Front',
    username: `riley-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    departments: ['front_desk'],
  });
  employeeActor = { id: employee.id, role: 'employee' };

  const otherEmployee = employeeRepo.create({
    name: 'Other Employee',
    username: `other-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    departments: [],
  });
  otherEmployeeActor = { id: otherEmployee.id, role: 'employee' };

  const manager = employeeRepo.create({
    name: 'Dana Manager',
    username: `dana-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: false,
    departments: [],
  });
  managerActor = { id: manager.id, role: 'manager' };
});

describe('unavailabilityService', () => {
  describe('createOwnRequest / listOwnRequests', () => {
    it('creates a request under the acting employee, starting pending', () => {
      const created = unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
        reason: 'Church',
      });
      expect(created.employeeId).toBe(employeeActor.id);
      expect(created.requestedBy).toBe(employeeActor.id);
      expect(created.status).toBe('pending');
    });

    it('rejects an out-of-range day of week', () => {
      expect(() =>
        unavailabilityService.createOwnRequest(employeeActor, {
          dayOfWeek: 7,
          startTime: '09:00',
          endTime: '17:00',
        }),
      ).toThrow();
      expect(() =>
        unavailabilityService.createOwnRequest(employeeActor, {
          dayOfWeek: -1,
          startTime: '09:00',
          endTime: '17:00',
        }),
      ).toThrow();
    });

    it('rejects a missing start or end time', () => {
      expect(() =>
        unavailabilityService.createOwnRequest(employeeActor, {
          dayOfWeek: 0,
          startTime: '',
          endTime: '17:00',
        }),
      ).toThrow();
      expect(() =>
        unavailabilityService.createOwnRequest(employeeActor, {
          dayOfWeek: 0,
          startTime: '09:00',
          endTime: '',
        }),
      ).toThrow();
    });

    it('only returns the acting employee own requests, never another employee requests', () => {
      unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
      });
      unavailabilityService.createOwnRequest(otherEmployeeActor, {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
      });

      const mine = unavailabilityService.listOwnRequests(employeeActor);
      expect(mine).toHaveLength(1);
      expect(mine.every((r) => r.employeeId === employeeActor.id)).toBe(true);
    });
  });

  describe('createForEmployee', () => {
    it('lets a manager create an auto-approved entry for another employee', () => {
      const created = unavailabilityService.createForEmployee(managerActor, {
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

    it('refuses a non-manager from submitting on another employee behalf', () => {
      expect(() =>
        unavailabilityService.createForEmployee(employeeActor, {
          employeeId: otherEmployeeActor.id,
          dayOfWeek: 0,
          startTime: '00:00',
          endTime: '23:59',
        }),
      ).toThrow(UnauthorizedUnavailabilityActionError);
    });

    it('still validates the day-of-week/time window for a manager submission', () => {
      expect(() =>
        unavailabilityService.createForEmployee(managerActor, {
          employeeId: employeeActor.id,
          dayOfWeek: 9,
          startTime: '00:00',
          endTime: '23:59',
        }),
      ).toThrow();
    });
  });

  describe('listAllRequests', () => {
    it('allows a manager to list every request', () => {
      unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
      });
      unavailabilityService.createOwnRequest(otherEmployeeActor, {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
      });

      const all = unavailabilityService.listAllRequests(managerActor);
      expect(all).toHaveLength(2);
    });

    it('refuses a non-manager, even for their own request list', () => {
      unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
      });
      expect(() => unavailabilityService.listAllRequests(employeeActor)).toThrow(
        UnauthorizedUnavailabilityActionError,
      );
    });
  });

  describe('decideRequest', () => {
    it('lets a manager approve a pending request', () => {
      const created = unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });

      const decided = unavailabilityService.decideRequest(managerActor, {
        id: created.id,
        status: 'approved',
      });

      expect(decided.status).toBe('approved');
      expect(decided.decidedBy).toBe(managerActor.id);
    });

    it('lets a manager deny a pending request with a decision note', () => {
      const created = unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });

      const decided = unavailabilityService.decideRequest(managerActor, {
        id: created.id,
        status: 'denied',
        decisionNote: 'Need evening coverage',
      });

      expect(decided.status).toBe('denied');
      expect(decided.decisionNote).toBe('Need evening coverage');
    });

    it('refuses a non-manager from approving or denying', () => {
      const created = unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });

      expect(() =>
        unavailabilityService.decideRequest(employeeActor, { id: created.id, status: 'approved' }),
      ).toThrow(UnauthorizedUnavailabilityActionError);
    });

    it('throws when the request does not exist', () => {
      expect(() =>
        unavailabilityService.decideRequest(managerActor, { id: 999999, status: 'approved' }),
      ).toThrow(UnavailabilityRequestNotFoundError);
    });

    it('refuses to re-decide an already-approved (terminal) request', () => {
      const created = unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });
      unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'approved' });

      expect(() =>
        unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'denied' }),
      ).toThrow(InvalidApprovalTransitionError);
    });

    it('refuses to re-decide an already-denied (terminal) request', () => {
      const created = unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '23:59',
      });
      unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'denied' });

      expect(() =>
        unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'approved' }),
      ).toThrow(InvalidApprovalTransitionError);
    });
  });

  describe('listApprovedAll', () => {
    it('returns only approved entries across every employee', () => {
      const created = unavailabilityService.createOwnRequest(employeeActor, {
        dayOfWeek: 0,
        startTime: '00:00',
        endTime: '23:59',
      });
      unavailabilityService.createOwnRequest(otherEmployeeActor, {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
      });
      unavailabilityService.decideRequest(managerActor, { id: created.id, status: 'approved' });

      const results = unavailabilityService.listApprovedAll();
      expect(results).toHaveLength(1);
      expect(results[0].employeeId).toBe(employeeActor.id);
    });
  });

  // Sanity check that the repo layer itself never leaks another employee's
  // data — the service relies on this for the "own requests only" guarantee.
  it('repo listByEmployee stays scoped even if the service is bypassed', () => {
    unavailabilityRepo.create({
      employeeId: employeeActor.id,
      requestedBy: employeeActor.id,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
    });
    unavailabilityRepo.create({
      employeeId: otherEmployeeActor.id,
      requestedBy: otherEmployeeActor.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });
    expect(unavailabilityRepo.listByEmployee(employeeActor.id)).toHaveLength(1);
  });
});
