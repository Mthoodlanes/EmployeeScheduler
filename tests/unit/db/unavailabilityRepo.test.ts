import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';
import * as unavailabilityRepo from '../../../src/main/db/repositories/unavailabilityRepo';

let employeeId: number;
let managerId: number;

beforeEach(() => {
  // Fresh in-memory database per test: initDb() memoizes a singleton keyed
  // by process, so reach past it here to guarantee isolation between tests.
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
  employeeId = employee.id;

  const manager = employeeRepo.create({
    name: 'Dana Manager',
    username: `dana-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: false,
    departments: [],
  });
  managerId = manager.id;
});

describe('unavailabilityRepo', () => {
  it('creates a request defaulting to pending status', () => {
    const created = unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
      reason: 'Church',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.status).toBe('pending');
    expect(created.reason).toBe('Church');
    expect(created.requestedBy).toBe(employeeId);
    expect(created.decidedBy).toBeNull();
    expect(created.decidedAt).toBeNull();
    expect(created.decisionNote).toBeNull();
  });

  it('creates a request with a null reason when none is given', () => {
    const created = unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '23:59',
    });
    expect(created.reason).toBeNull();
  });

  it('records requestedBy separately from employeeId for manager-submitted entries', () => {
    const created = unavailabilityRepo.create({
      employeeId,
      requestedBy: managerId,
      dayOfWeek: 2,
      startTime: '00:00',
      endTime: '23:59',
    });
    expect(created.employeeId).toBe(employeeId);
    expect(created.requestedBy).toBe(managerId);
  });

  it('lists requests for one employee only, ordered by day of week', () => {
    const otherEmployee = employeeRepo.create({
      name: 'Other Employee',
      username: `other-${Date.now()}-${Math.random()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 5,
      startTime: '18:00',
      endTime: '23:59',
    });
    unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
    });
    unavailabilityRepo.create({
      employeeId: otherEmployee.id,
      requestedBy: otherEmployee.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });

    const mine = unavailabilityRepo.listByEmployee(employeeId);
    expect(mine).toHaveLength(2);
    expect(mine[0].dayOfWeek).toBe(0);
    expect(mine[1].dayOfWeek).toBe(5);
  });

  it('lists every request across employees, pending first', () => {
    const first = unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
    });
    const second = unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 3,
      startTime: '18:00',
      endTime: '22:00',
    });
    unavailabilityRepo.updateStatus({ id: first.id, status: 'approved', decidedBy: managerId });

    const all = unavailabilityRepo.listAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(second.id);
    expect(all[0].status).toBe('pending');
  });

  it('lists only approved entries across all employees', () => {
    const approved = unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
    });
    unavailabilityRepo.updateStatus({ id: approved.id, status: 'approved', decidedBy: managerId });

    unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });

    const results = unavailabilityRepo.listApproved();
    expect(results.map((r) => r.id)).toEqual([approved.id]);
  });

  it('updates status, decidedBy, decisionNote and stamps decidedAt', () => {
    const created = unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 6,
      startTime: '00:00',
      endTime: '23:59',
    });

    const denied = unavailabilityRepo.updateStatus({
      id: created.id,
      status: 'denied',
      decidedBy: managerId,
      decisionNote: 'Need weekend coverage',
    });

    expect(denied.status).toBe('denied');
    expect(denied.decidedBy).toBe(managerId);
    expect(denied.decisionNote).toBe('Need weekend coverage');
    expect(denied.decidedAt).not.toBeNull();
  });

  it('getById returns undefined for an unknown id', () => {
    expect(unavailabilityRepo.getById(999999)).toBeUndefined();
  });
});
