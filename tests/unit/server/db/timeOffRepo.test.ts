import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as timeOffRepo from '../../../../server/src/db/repositories/timeOffRepo.js';

let employeeId: number;
let managerId: number;

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
  employeeId = employee.id;

  const manager = await employeeRepo.create({
    name: 'Dana Manager',
    username: `dana-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  managerId = manager.id;
});

describe('timeOffRepo', () => {
  it('creates a request defaulting to pending status', async () => {
    const created = await timeOffRepo.create({
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

  it('creates a request with a null reason when none is given', async () => {
    const created = await timeOffRepo.create({
      employeeId,
      startDate: '2026-09-14',
      endDate: '2026-09-14',
    });
    expect(created.reason).toBeNull();
  });

  it('lists requests for one employee only, most recent start date first', async () => {
    const otherEmployee = await employeeRepo.create({
      name: 'Other Employee',
      username: `other-${Date.now()}-${Math.random()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      isSecretaryTagged: false,
      departments: [],
    });

    await timeOffRepo.create({ employeeId, startDate: '2026-09-01', endDate: '2026-09-01' });
    await timeOffRepo.create({ employeeId, startDate: '2026-09-20', endDate: '2026-09-21' });
    await timeOffRepo.create({
      employeeId: otherEmployee.id,
      startDate: '2026-09-10',
      endDate: '2026-09-10',
    });

    const mine = await timeOffRepo.listByEmployee(employeeId);
    expect(mine).toHaveLength(2);
    expect(mine[0].startDate).toBe('2026-09-20');
    expect(mine[1].startDate).toBe('2026-09-01');
  });

  it('lists every request across employees, pending first', async () => {
    const first = await timeOffRepo.create({
      employeeId,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
    });
    const second = await timeOffRepo.create({
      employeeId,
      startDate: '2026-09-05',
      endDate: '2026-09-05',
    });
    await timeOffRepo.updateStatus({ id: first.id, status: 'approved', decidedBy: managerId });

    const all = await timeOffRepo.listAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(second.id);
    expect(all[0].status).toBe('pending');
  });

  it('finds approved requests overlapping a date range and excludes non-overlapping/pending ones', async () => {
    const approvedInRange = await timeOffRepo.create({
      employeeId,
      startDate: '2026-09-08',
      endDate: '2026-09-10',
    });
    await timeOffRepo.updateStatus({ id: approvedInRange.id, status: 'approved', decidedBy: managerId });

    const approvedOutsideRange = await timeOffRepo.create({
      employeeId,
      startDate: '2026-10-01',
      endDate: '2026-10-02',
    });
    await timeOffRepo.updateStatus({
      id: approvedOutsideRange.id,
      status: 'approved',
      decidedBy: managerId,
    });

    const stillPendingInRange = await timeOffRepo.create({
      employeeId,
      startDate: '2026-09-09',
      endDate: '2026-09-09',
    });

    const results = await timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
    expect(results.map((r) => r.id)).toEqual([approvedInRange.id]);
    expect(results.map((r) => r.id)).not.toContain(approvedOutsideRange.id);
    expect(results.map((r) => r.id)).not.toContain(stillPendingInRange.id);
  });

  describe('listApprovedInDateRange — multi-day span partial overlaps', () => {
    it('includes a multi-day request that starts before the range and ends inside it', async () => {
      const spanning = await timeOffRepo.create({
        employeeId,
        startDate: '2026-09-05',
        endDate: '2026-09-09',
      });
      await timeOffRepo.updateStatus({ id: spanning.id, status: 'approved', decidedBy: managerId });

      const results = await timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
      expect(results.map((r) => r.id)).toEqual([spanning.id]);
    });

    it('includes a multi-day request that starts inside the range and ends after it', async () => {
      const spanning = await timeOffRepo.create({
        employeeId,
        startDate: '2026-09-12',
        endDate: '2026-09-16',
      });
      await timeOffRepo.updateStatus({ id: spanning.id, status: 'approved', decidedBy: managerId });

      const results = await timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
      expect(results.map((r) => r.id)).toEqual([spanning.id]);
    });

    it('includes a multi-day request that entirely contains the queried range (starts before, ends after)', async () => {
      const spanning = await timeOffRepo.create({
        employeeId,
        startDate: '2026-08-01',
        endDate: '2026-10-01',
      });
      await timeOffRepo.updateStatus({ id: spanning.id, status: 'approved', decidedBy: managerId });

      const results = await timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
      expect(results.map((r) => r.id)).toEqual([spanning.id]);
    });

    it('excludes a multi-day request that ends the day before the range starts (adjacent, not overlapping)', async () => {
      const adjacent = await timeOffRepo.create({
        employeeId,
        startDate: '2026-09-03',
        endDate: '2026-09-06',
      });
      await timeOffRepo.updateStatus({ id: adjacent.id, status: 'approved', decidedBy: managerId });

      const results = await timeOffRepo.listApprovedInDateRange('2026-09-07', '2026-09-13');
      expect(results.map((r) => r.id)).not.toContain(adjacent.id);
    });
  });

  it('updates status, decidedBy, decisionNote and stamps decidedAt', async () => {
    const created = await timeOffRepo.create({
      employeeId,
      startDate: '2026-09-14',
      endDate: '2026-09-14',
    });

    const denied = await timeOffRepo.updateStatus({
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
