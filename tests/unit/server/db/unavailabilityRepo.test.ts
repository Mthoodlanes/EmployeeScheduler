import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as unavailabilityRepo from '../../../../server/src/db/repositories/unavailabilityRepo.js';

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
    departments: ['front_desk'],
  });
  employeeId = employee.id;

  const manager = await employeeRepo.create({
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
  it('creates a request defaulting to pending status', async () => {
    const created = await unavailabilityRepo.create({
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

  it('creates a request with a null reason when none is given', async () => {
    const created = await unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '23:59',
    });
    expect(created.reason).toBeNull();
  });

  it('records requestedBy separately from employeeId for manager-submitted entries', async () => {
    const created = await unavailabilityRepo.create({
      employeeId,
      requestedBy: managerId,
      dayOfWeek: 2,
      startTime: '00:00',
      endTime: '23:59',
    });
    expect(created.employeeId).toBe(employeeId);
    expect(created.requestedBy).toBe(managerId);
  });

  it('lists requests for one employee only, ordered by day of week', async () => {
    const otherEmployee = await employeeRepo.create({
      name: 'Other Employee',
      username: `other-${Date.now()}-${Math.random()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    await unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 5,
      startTime: '18:00',
      endTime: '23:59',
    });
    await unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
    });
    await unavailabilityRepo.create({
      employeeId: otherEmployee.id,
      requestedBy: otherEmployee.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });

    const mine = await unavailabilityRepo.listByEmployee(employeeId);
    expect(mine).toHaveLength(2);
    expect(mine[0].dayOfWeek).toBe(0);
    expect(mine[1].dayOfWeek).toBe(5);
  });

  it('lists every request across employees, pending first', async () => {
    const first = await unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
    });
    const second = await unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 3,
      startTime: '18:00',
      endTime: '22:00',
    });
    await unavailabilityRepo.updateStatus({ id: first.id, status: 'approved', decidedBy: managerId });

    const all = await unavailabilityRepo.listAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(second.id);
    expect(all[0].status).toBe('pending');
  });

  it('lists only approved entries across all employees', async () => {
    const approved = await unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 0,
      startTime: '00:00',
      endTime: '23:59',
    });
    await unavailabilityRepo.updateStatus({ id: approved.id, status: 'approved', decidedBy: managerId });

    await unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });

    const results = await unavailabilityRepo.listApproved();
    expect(results.map((r) => r.id)).toEqual([approved.id]);
  });

  it('updates status, decidedBy, decisionNote and stamps decidedAt', async () => {
    const created = await unavailabilityRepo.create({
      employeeId,
      requestedBy: employeeId,
      dayOfWeek: 6,
      startTime: '00:00',
      endTime: '23:59',
    });

    const denied = await unavailabilityRepo.updateStatus({
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

  it('getById returns undefined for an unknown id', async () => {
    expect(await unavailabilityRepo.getById(999999)).toBeUndefined();
  });
});
