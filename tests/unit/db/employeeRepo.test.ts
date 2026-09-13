import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';

beforeEach(() => {
  // Fresh in-memory database per test: initDb() memoizes a singleton keyed
  // by process, so reach past it here to guarantee isolation between tests.
  const db = initDb(':memory:');
  db.exec('DELETE FROM employee_departments; DELETE FROM employees;');
});

describe('employeeRepo', () => {
  it('creates an employee with departments and reads it back', () => {
    const created = employeeRepo.create({
      name: 'Riley Front',
      username: `riley-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: ['front_desk', 'cafe'],
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.departments.sort()).toEqual(['cafe', 'front_desk']);
    expect(created.isActive).toBe(true);
  });

  it('lists all employees ordered by name', () => {
    employeeRepo.create({
      name: 'Zoe Last',
      username: `zoe-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    employeeRepo.create({
      name: 'Amy First',
      username: `amy-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    const all = employeeRepo.listAll();
    const names = all.map((e) => e.name);
    expect(names.indexOf('Amy First')).toBeLessThan(names.indexOf('Zoe Last'));
  });

  it('updates employee fields', () => {
    const created = employeeRepo.create({
      name: 'Original Name',
      username: `orig-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    const updated = employeeRepo.update({
      id: created.id,
      name: 'Updated Name',
      role: 'manager',
      isSalaried: true,
      isActive: true,
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.role).toBe('manager');
    expect(updated.isSalaried).toBe(true);
  });

  it('deactivates an employee', () => {
    const created = employeeRepo.create({
      name: 'To Deactivate',
      username: `deact-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    const deactivated = employeeRepo.deactivate(created.id);
    expect(deactivated.isActive).toBe(false);
  });

  it('reactivates a previously-deactivated employee via update()', () => {
    const created = employeeRepo.create({
      name: 'To Reactivate',
      username: `react-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    employeeRepo.deactivate(created.id);
    expect(employeeRepo.getById(created.id)?.isActive).toBe(false);

    const reactivated = employeeRepo.update({
      id: created.id,
      name: created.name,
      role: created.role,
      isSalaried: created.isSalaried,
      isActive: true,
    });

    expect(reactivated.isActive).toBe(true);
    expect(employeeRepo.getById(created.id)?.isActive).toBe(true);
  });

  it('throws when creating an employee with a username that is already taken', () => {
    const username = `dupe-${Date.now()}`;
    employeeRepo.create({
      name: 'First',
      username,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    expect(() =>
      employeeRepo.create({
        name: 'Second',
        username,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      }),
    ).toThrow();
  });

  it('finds an employee by username regardless of case', () => {
    const username = `CaseTest-${Date.now()}`;
    employeeRepo.create({
      name: 'Case Test',
      username,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    expect(employeeRepo.findByUsername(username.toUpperCase())?.username).toBe(username);
    expect(employeeRepo.findByUsername(username.toLowerCase())?.username).toBe(username);
  });

  it('replaces department assignments', () => {
    const created = employeeRepo.create({
      name: 'Dept Swap',
      username: `swap-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: ['bar'],
    });

    const updated = employeeRepo.setDepartments(created.id, ['front_desk', 'cafe']);
    expect(updated.departments.sort()).toEqual(['cafe', 'front_desk']);
  });
});
