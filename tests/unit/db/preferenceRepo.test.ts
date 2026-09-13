import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';
import * as preferenceRepo from '../../../src/main/db/repositories/preferenceRepo';

let employeeId: number;
let otherEmployeeId: number;

beforeEach(() => {
  // Fresh in-memory database per test: initDb() memoizes a singleton keyed
  // by process, so reach past it here to guarantee isolation between tests.
  const db = initDb(':memory:');
  db.exec(
    'DELETE FROM employee_preferences; DELETE FROM employee_departments; DELETE FROM employees;',
  );

  const employee = employeeRepo.create({
    name: 'Alex Chen',
    username: `alex-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    departments: ['front_desk'],
  });
  employeeId = employee.id;

  const otherEmployee = employeeRepo.create({
    name: 'Other Employee',
    username: `other-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    departments: [],
  });
  otherEmployeeId = otherEmployee.id;
});

describe('preferenceRepo', () => {
  it('creates a preference window with an optional note', () => {
    const created = preferenceRepo.create({
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

  it('creates a preference with a null note when none is given', () => {
    const created = preferenceRepo.create({
      employeeId,
      dayOfWeek: 2,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });
    expect(created.note).toBeNull();
  });

  it('allows more than one preference window for the same employee and day of week', () => {
    preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '10:00',
    });
    preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '16:00',
      preferredEndTime: '20:00',
    });

    const mine = preferenceRepo.listByEmployee(employeeId);
    expect(mine).toHaveLength(2);
  });

  it('lists preferences for one employee only, ordered by day of week', () => {
    preferenceRepo.create({
      employeeId,
      dayOfWeek: 3,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });
    preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });
    preferenceRepo.create({
      employeeId: otherEmployeeId,
      dayOfWeek: 2,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });

    const mine = preferenceRepo.listByEmployee(employeeId);
    expect(mine).toHaveLength(2);
    expect(mine.map((p) => p.dayOfWeek)).toEqual([1, 3]);
  });

  it('lists preferences across all employees', () => {
    preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });
    preferenceRepo.create({
      employeeId: otherEmployeeId,
      dayOfWeek: 2,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });

    const all = preferenceRepo.listAll();
    expect(all).toHaveLength(2);
  });

  it('updates a preference window', () => {
    const created = preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });

    const updated = preferenceRepo.update({
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

  it('removes a preference window', () => {
    const created = preferenceRepo.create({
      employeeId,
      dayOfWeek: 1,
      preferredStartTime: '08:00',
      preferredEndTime: '12:00',
    });

    preferenceRepo.remove(created.id);

    expect(preferenceRepo.getById(created.id)).toBeUndefined();
    expect(preferenceRepo.listByEmployee(employeeId)).toHaveLength(0);
  });
});
