import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';
import * as timeOffRepo from '../../../src/main/db/repositories/timeOffRepo';

let employeeId: number;
let managerId: number;

beforeEach(() => {
  // Fresh in-memory database per test: initDb() memoizes a singleton keyed
  // by process, so reach past it here to guarantee isolation between tests.
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

describe('timeOffRepo', () => {
  it('creates a request defaulting to pending status', () => {
    const created = timeOffRepo.create({
      employeeId,
      startDate: '2026-09-14',
      endDate: '2026-09-15',
      reason: 'Family trip',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.status).toBe('pending');
    expect(created.reason).toBe('Family trip');
    expect(created.decidedBy).toBeNull();
    expect(created.decidedAt).toBeNull();
    expect(created.decisionNote).toBeNull();
  });

  it('creates a request with a null reason when none is given', () => {
    const created = timeOffRepo.create({
      employeeId,
      startDate: '2026-09-14',
      endDate: '2026-09-14',
    });
    expect(created.reason).toBeNull();
  });

  it('lists requests for one employee only, most recent start date first', () => {
    const otherEmployee = employeeRepo.create({
      name: 'Other Employee',
      username: `other-${Date.now()}-${Math.random()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    timeOffRepo.create({ employeeId, startDate: '2026-09-01', endDate: '2026-09-01' });
    timeOffRepo.create({ employeeId, startDate: '2026-09-20', endDate: '2026-09-21' });
    timeOffRepo.create({
      employeeId: otherEmployee.id,
      startDate: '2026-09-10',
      endDate: '2026-09-10',
    });

    const mine = timeOffRepo.listByEmployee(employeeId);
    expect(mine).toHaveLength(2);
    expect(mine[0].startDate).toBe('2026-09-20');
    expect(mine[1].startDate).toBe('2026-09-01');
  });

  it('lists every request across employees, pending first', () => {
    const first = timeOffRepo.create({
      employeeId,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
    });
    const second = timeOffRepo.create({
      employeeId,
      startDate: '2026-09-05',
      endDate: '2026-09-05',
    });
    timeOffRepo.updateStatus({ id: first.id, status: 'approved', decidedBy: managerId });

    const all = timeOffRepo.listAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(second.id);
    expect(all[0].status).toBe('pending');
  });

  it('finds approved requests overlapping a date range and excludes non-overlapping/pending ones', () => {
    const approvedInRange = timeOffRepo.create({
      employeeId,
      startDate: '2026-09-08',
      endDate: '2026-09-10',
    });
    timeOffRepo.updateStatus({ id: approvedInRange.id, status: 'approved', decidedBy: managerId });

    const approvedOutsideRange = timeOffRepo.create({
      employeeId,
      startDate: '2026-10-01',
      endDate: '2026-10-02',
    });
    timeOffRepo.updateStatus({
      id: approvedOutsideRange.id,
      status: 'approved',
      decidedBy: managerId,
    });

    const stillPendingInRange = timeOffRepo.create({
      employeeId,
      startDate: '2026-09-09',
      endDate: '2026-09-09',
    });

    const results = timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
    expect(results.map((r) => r.id)).toEqual([approvedInRange.id]);
    expect(results.map((r) => r.id)).not.toContain(approvedOutsideRange.id);
    expect(results.map((r) => r.id)).not.toContain(stillPendingInRange.id);
  });

  describe('listApprovedInDateRange — multi-day span partial overlaps', () => {
    // A multi-day request only needs to partially overlap the queried range
    // to be returned — it need not be fully contained by it. These cover the
    // three ways a span can straddle a range boundary, beyond the
    // fully-inside/fully-outside cases above.
    it('includes a multi-day request that starts before the range and ends inside it', () => {
      const spanning = timeOffRepo.create({
        employeeId,
        startDate: '2026-09-05',
        endDate: '2026-09-09',
      });
      timeOffRepo.updateStatus({ id: spanning.id, status: 'approved', decidedBy: managerId });

      const results = timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
      expect(results.map((r) => r.id)).toEqual([spanning.id]);
    });

    it('includes a multi-day request that starts inside the range and ends after it', () => {
      const spanning = timeOffRepo.create({
        employeeId,
        startDate: '2026-09-12',
        endDate: '2026-09-16',
      });
      timeOffRepo.updateStatus({ id: spanning.id, status: 'approved', decidedBy: managerId });

      const results = timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
      expect(results.map((r) => r.id)).toEqual([spanning.id]);
    });

    it('includes a multi-day request that entirely contains the queried range (starts before, ends after)', () => {
      const spanning = timeOffRepo.create({
        employeeId,
        startDate: '2026-08-01',
        endDate: '2026-10-01',
      });
      timeOffRepo.updateStatus({ id: spanning.id, status: 'approved', decidedBy: managerId });

      const results = timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
      expect(results.map((r) => r.id)).toEqual([spanning.id]);
    });

    it('excludes a multi-day request that ends the day before the range starts (adjacent, not overlapping)', () => {
      const adjacent = timeOffRepo.create({
        employeeId,
        startDate: '2026-09-03',
        endDate: '2026-09-06',
      });
      timeOffRepo.updateStatus({ id: adjacent.id, status: 'approved', decidedBy: managerId });

      const results = timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
      expect(results.map((r) => r.id)).not.toContain(adjacent.id);
    });
  });

  it('updates status, decidedBy, decisionNote and stamps decidedAt', () => {
    const created = timeOffRepo.create({
      employeeId,
      startDate: '2026-09-14',
      endDate: '2026-09-14',
    });

    const denied = timeOffRepo.updateStatus({
      id: created.id,
      status: 'denied',
      decidedBy: managerId,
      decisionNote: 'Short-staffed that week',
    });

    expect(denied.status).toBe('denied');
    expect(denied.decidedBy).toBe(managerId);
    expect(denied.decisionNote).toBe('Short-staffed that week');
    expect(denied.decidedAt).not.toBeNull();
  });
});
