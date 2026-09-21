import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as preferenceRepo from '../../../../server/src/db/repositories/preferenceRepo.js';

let employeeId: number;
let otherEmployeeId: number;

beforeEach(async () => {
  await truncateAllTables();

  const employee = await employeeRepo.create({
    name: 'Alex Chen',
    username: `alex-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: ['front_desk'],
  });
  employeeId = employee.id;

  const otherEmployee = await employeeRepo.create({
    name: 'Other Employee',
    username: `other-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  otherEmployeeId = otherEmployee.id;
});

describe('preferenceRepo', () => {
  it('creates a preference window with an optional note', async () => {
    const created = await preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
      note: 'Prefers mornings',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.employeeId).toBe(employeeId);
    expect(created.dayOfWeek).toBe(1);
    expect(created.preferredStartTime).toBe('08:00');
    expect(created.preferredEndTime).toBe('12:00');
    expect(created.note).toBe('Prefers mornings');
  });

  it('creates a preference with a null note when none is given', async () => {
    const created = await preferenceRepo.create({
      employeeId,
      dayOfWeek: 2,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });
    expect(created.note).toBeNull();
  });

  it('allows more than one preference window for the same employee and day of week', async () => {
    await preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '10:00',
    });
    await preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '16:00',
      preferredEndTime: '20:00',
    });

    const mine = await preferenceRepo.listByEmployee(employeeId);
    expect(mine).toHaveLength(2);
  });

  it('lists preferences for one employee only, ordered by day of week', async () => {
    await preferenceRepo.create({
      employeeId,
      dayOfWeek: 3,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });
    await preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });
    await preferenceRepo.create({
      employeeId: otherEmployeeId,
      dayOfWeek: 2,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });

    const mine = await preferenceRepo.listByEmployee(employeeId);
    expect(mine).toHaveLength(2);
    expect(mine.map((p) => p.dayOfWeek)).toEqual([1, 3]);
  });

  it('lists preferences across all employees', async () => {
    await preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });
    await preferenceRepo.create({
      employeeId: otherEmployeeId,
      dayOfWeek: 2,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });

    const all = await preferenceRepo.listAll();
    expect(all).toHaveLength(2);
  });

  it('updates a preference window', async () => {
    const created = await preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });

    const updated = await preferenceRepo.update({
      id: created.id,
      dayOfWeek: 5,
      preferredStartTime: '14:00',
      preferredEndTime: '20:00',
      note: 'Now prefers evenings',
    });

    expect(updated.dayOfWeek).toBe(5);
    expect(updated.preferredStartTime).toBe('14:00');
    expect(updated.preferredEndTime).toBe('20:00');
    expect(updated.note).toBe('Now prefers evenings');
  });

  it('removes a preference window', async () => {
    const created = await preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });

    await preferenceRepo.remove(created.id);

    expect(await preferenceRepo.getById(created.id)).toBeUndefined();
    expect(await preferenceRepo.listByEmployee(employeeId)).toHaveLength(0);
  });
});
