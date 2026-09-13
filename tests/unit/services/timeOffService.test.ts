import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';
import * as timeOffRepo from '../../../src/main/db/repositories/timeOffRepo';
import * as timeOffService from '../../../src/main/services/timeOffService';
import {
  InvalidApprovalTransitionError,
  TimeOffRequestNotFoundError,
  UnauthorizedTimeOffActionError,
} from '../../../src/main/services/timeOffService';

let employeeActor: { id: number; role: 'employee' };
let otherEmployeeActor: { id: number; role: 'employee' };
let managerActor: { id: number; role: 'manager' };

beforeEach(() => {
  const db = initDb(':memory:');
  db.exec(
    'DELETE FROM time_off_requests; DELETE FROM employee_departments; DELETE FROM employees;',
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

describe('timeOffService', () => {
  describe('createOwnRequest / listOwnRequests', () => {
    it('creates a request under the acting employee, ignoring any other employee id', () => {
      const created = timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-15',
        reason: 'Family trip',
      });
      expect(created.employeeId).toBe(employeeActor.id);
      expect(created.status).toBe('pending');
    });

    it('rejects an end date before the start date', () => {
      expect(() =>
        timeOffService.createOwnRequest(employeeActor, {
          startDate: '2026-09-15',
          endDate: '2026-09-14',
        }),
      ).toThrow();
    });

    it('only returns the acting employee own requests, never another employee requests', () => {
      timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });
      timeOffService.createOwnRequest(otherEmployeeActor, {
        startDate: '2026-09-02',
        endDate: '2026-09-02',
      });

      const mine = timeOffService.listOwnRequests(employeeActor);
      expect(mine).toHaveLength(1);
      expect(mine.every((r) => r.employeeId === employeeActor.id)).toBe(true);
    });
  });

  describe('createForEmployee', () => {
    it('lets a manager create an auto-approved request for another employee', () => {
      const created = timeOffService.createForEmployee(managerActor, {
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

    it('refuses a non-manager from submitting on another employee behalf', () => {
      expect(() =>
        timeOffService.createForEmployee(employeeActor, {
          employeeId: otherEmployeeActor.id,
          startDate: '2026-09-14',
          endDate: '2026-09-15',
        }),
      ).toThrow(UnauthorizedTimeOffActionError);
    });

    it('still rejects an end date before the start date for a manager submission', () => {
      expect(() =>
        timeOffService.createForEmployee(managerActor, {
          employeeId: employeeActor.id,
          startDate: '2026-09-15',
          endDate: '2026-09-14',
        }),
      ).toThrow();
    });
  });

  describe('listAllRequests', () => {
    it('allows a manager to list every request', () => {
      timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });
      timeOffService.createOwnRequest(otherEmployeeActor, {
        startDate: '2026-09-02',
        endDate: '2026-09-02',
      });

      const all = timeOffService.listAllRequests(managerActor);
      expect(all).toHaveLength(2);
    });

    it('refuses a non-manager, even for their own request list', () => {
      timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });
      expect(() => timeOffService.listAllRequests(employeeActor)).toThrow(
        UnauthorizedTimeOffActionError,
      );
    });
  });

  describe('decideRequest', () => {
    it('lets a manager approve a pending request', () => {
      const created = timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });

      const decided = timeOffService.decideRequest(managerActor, {
        id: created.id,
        status: 'approved',
      });

      expect(decided.status).toBe('approved');
      expect(decided.decidedBy).toBe(managerActor.id);
    });

    it('lets a manager deny a pending request with a decision note', () => {
      const created = timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });

      const decided = timeOffService.decideRequest(managerActor, {
        id: created.id,
        status: 'denied',
        decisionNote: 'Short-staffed that week',
      });

      expect(decided.status).toBe('denied');
      expect(decided.decisionNote).toBe('Short-staffed that week');
    });

    it('refuses a non-manager from approving or denying', () => {
      const created = timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });

      expect(() =>
        timeOffService.decideRequest(employeeActor, { id: created.id, status: 'approved' }),
      ).toThrow(UnauthorizedTimeOffActionError);
    });

    it('throws when the request does not exist', () => {
      expect(() =>
        timeOffService.decideRequest(managerActor, { id: 999999, status: 'approved' }),
      ).toThrow(TimeOffRequestNotFoundError);
    });

    it('refuses to re-decide an already-approved (terminal) request', () => {
      const created = timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });
      timeOffService.decideRequest(managerActor, { id: created.id, status: 'approved' });

      expect(() =>
        timeOffService.decideRequest(managerActor, { id: created.id, status: 'denied' }),
      ).toThrow(InvalidApprovalTransitionError);
    });

    it('refuses to re-decide an already-denied (terminal) request', () => {
      const created = timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-14',
        endDate: '2026-09-14',
      });
      timeOffService.decideRequest(managerActor, { id: created.id, status: 'denied' });

      expect(() =>
        timeOffService.decideRequest(managerActor, { id: created.id, status: 'approved' }),
      ).toThrow(InvalidApprovalTransitionError);
    });
  });

  describe('listApprovedForRange', () => {
    it('returns only approved requests overlapping the range', () => {
      const created = timeOffService.createOwnRequest(employeeActor, {
        startDate: '2026-09-08',
        endDate: '2026-09-09',
      });
      timeOffService.createOwnRequest(otherEmployeeActor, {
        startDate: '2026-09-08',
        endDate: '2026-09-09',
      });
      timeOffService.decideRequest(managerActor, { id: created.id, status: 'approved' });

      const results = timeOffService.listApprovedForRange('2026-09-07', '2026-09-13');
      expect(results).toHaveLength(1);
      expect(results[0].employeeId).toBe(employeeActor.id);
    });
  });

  // Sanity check that the repo layer itself never leaks another employee's
  // data — the service relies on this for the "own requests only" guarantee.
  it('repo listByEmployee stays scoped even if the service is bypassed', () => {
    timeOffRepo.create({
      employeeId: employeeActor.id,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
    });
    timeOffRepo.create({
      employeeId: otherEmployeeActor.id,
      startDate: '2026-09-02',
      endDate: '2026-09-02',
    });
    expect(timeOffRepo.listByEmployee(employeeActor.id)).toHaveLength(1);
  });
});
