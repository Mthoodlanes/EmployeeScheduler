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

  it('lists all employees ordered by sort_order (creation order), not alphabetically', () => {
    // "Zoe Last" is created FIRST, so despite sorting after "Amy First"
    // alphabetically, it must appear first in listAll() — the Schedule
    // Board's manual drag-and-drop order, not name order (see
    // EmployeesAdminPage for the page that still sorts by name).
    const zoe = employeeRepo.create({
      name: 'Zoe Last',
      username: `zoe-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    const amy = employeeRepo.create({
      name: 'Amy First',
      username: `amy-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    expect(zoe.sortOrder).toBeLessThan(amy.sortOrder);
    const all = employeeRepo.listAll();
    const ids = all.map((e) => e.id);
    expect(ids.indexOf(zoe.id)).toBeLessThan(ids.indexOf(amy.id));
  });

  it('appends a newly-created employee after the current max sort_order, never at the top', () => {
    const first = employeeRepo.create({
      name: 'First Employee',
      username: `first-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    const second = employeeRepo.create({
      name: 'Second Employee',
      username: `second-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    const third = employeeRepo.create({
      name: 'Third Employee',
      username: `third-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    expect(second.sortOrder).toBe(first.sortOrder + 1);
    expect(third.sortOrder).toBe(second.sortOrder + 1);

    // Reordering (moving the first-created employee to the very end) must
    // then be reflected the next time an employee is appended.
    const reordered = employeeRepo.reorder([second.id, third.id, first.id]);
    const newMaxSortOrder = Math.max(...reordered.map((e) => e.sortOrder));

    const fourth = employeeRepo.create({
      name: 'Fourth Employee',
      username: `fourth-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    expect(fourth.sortOrder).toBe(newMaxSortOrder + 1);
  });

  describe('reorder', () => {
    it('persists a brand-new global order, reflected immediately by listAll()', () => {
      const a = employeeRepo.create({
        name: 'A Employee',
        username: `reorder-a-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });
      const b = employeeRepo.create({
        name: 'B Employee',
        username: `reorder-b-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });
      const c = employeeRepo.create({
        name: 'C Employee',
        username: `reorder-c-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      const reordered = employeeRepo.reorder([c.id, a.id, b.id]);
      expect(reordered.map((e) => e.id)).toEqual([c.id, a.id, b.id]);
      expect(reordered.map((e) => e.sortOrder)).toEqual([0, 1, 2]);

      // And it's durable — a fresh read reflects the same order.
      expect(employeeRepo.listAll().map((e) => e.id)).toEqual([c.id, a.id, b.id]);
    });

    it('does not touch updated_at — purely an ordering concern, not a profile edit', () => {
      const a = employeeRepo.create({
        name: 'Untouched Employee',
        username: `untouched-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });
      const before = employeeRepo.getById(a.id)?.updatedAt;

      employeeRepo.reorder([a.id]);

      expect(employeeRepo.getById(a.id)?.updatedAt).toBe(before);
    });

    it('rejects a partial list that omits an existing employee', () => {
      const a = employeeRepo.create({
        name: 'Kept Employee',
        username: `kept-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });
      employeeRepo.create({
        name: 'Omitted Employee',
        username: `omitted-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      expect(() => employeeRepo.reorder([a.id])).toThrow();
    });

    it('rejects a list containing an unknown employee id', () => {
      const a = employeeRepo.create({
        name: 'Real Employee',
        username: `real-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      expect(() => employeeRepo.reorder([a.id, 999999])).toThrow();
    });

    it('rejects a list containing a duplicate id', () => {
      const a = employeeRepo.create({
        name: 'Dup Employee',
        username: `dup-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      expect(() => employeeRepo.reorder([a.id, a.id])).toThrow();
    });
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
