import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';

beforeEach(async () => {
  await truncateAllTables();
});

describe('employeeRepo', () => {
  it('creates an employee with departments and reads it back', async () => {
    const created = await employeeRepo.create({
      name: 'Riley Front',
      username: `riley-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: ['front_desk', 'cafe'],
    });

    expect(created.id).toBeGreaterThan(0);
    expect([...created.departments].sort()).toEqual(['cafe', 'front_desk']);
    expect(created.isActive).toBe(true);
  });

  it('lists all employees ordered by sort_order (creation order), not alphabetically', async () => {
    // "Zoe Last" is created FIRST, so despite sorting after "Amy First"
    // alphabetically, it must appear first in listAll() — the Schedule
    // Board's manual drag-and-drop order, not name order.
    const zoe = await employeeRepo.create({
      name: 'Zoe Last',
      username: `zoe-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    const amy = await employeeRepo.create({
      name: 'Amy First',
      username: `amy-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    expect(zoe.sortOrder).toBeLessThan(amy.sortOrder);
    const all = await employeeRepo.listAll();
    const ids = all.map((e) => e.id);
    expect(ids.indexOf(zoe.id)).toBeLessThan(ids.indexOf(amy.id));
  });

  it('appends a newly-created employee after the current max sort_order, never at the top', async () => {
    const first = await employeeRepo.create({
      name: 'First Employee',
      username: `first-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    const second = await employeeRepo.create({
      name: 'Second Employee',
      username: `second-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    const third = await employeeRepo.create({
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
    const reordered = await employeeRepo.reorder([second.id, third.id, first.id]);
    const newMaxSortOrder = Math.max(...reordered.map((e) => e.sortOrder));

    const fourth = await employeeRepo.create({
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
    it('persists a brand-new global order, reflected immediately by listAll()', async () => {
      const a = await employeeRepo.create({
        name: 'A Employee',
        username: `reorder-a-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });
      const b = await employeeRepo.create({
        name: 'B Employee',
        username: `reorder-b-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });
      const c = await employeeRepo.create({
        name: 'C Employee',
        username: `reorder-c-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      const reordered = await employeeRepo.reorder([c.id, a.id, b.id]);
      expect(reordered.map((e) => e.id)).toEqual([c.id, a.id, b.id]);
      expect(reordered.map((e) => e.sortOrder)).toEqual([0, 1, 2]);

      // And it's durable — a fresh read reflects the same order.
      const all = await employeeRepo.listAll();
      expect(all.map((e) => e.id)).toEqual([c.id, a.id, b.id]);
    });

    it('does not touch updated_at — purely an ordering concern, not a profile edit', async () => {
      const a = await employeeRepo.create({
        name: 'Untouched Employee',
        username: `untouched-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });
      const before = (await employeeRepo.getById(a.id))?.updatedAt;

      await employeeRepo.reorder([a.id]);

      expect((await employeeRepo.getById(a.id))?.updatedAt).toBe(before);
    });

    it('rejects a partial list that omits an existing employee', async () => {
      const a = await employeeRepo.create({
        name: 'Kept Employee',
        username: `kept-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });
      await employeeRepo.create({
        name: 'Omitted Employee',
        username: `omitted-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      await expect(employeeRepo.reorder([a.id])).rejects.toThrow();
    });

    it('rejects a list containing an unknown employee id', async () => {
      const a = await employeeRepo.create({
        name: 'Real Employee',
        username: `real-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      await expect(employeeRepo.reorder([a.id, 999999])).rejects.toThrow();
    });

    it('rejects a list containing a duplicate id', async () => {
      const a = await employeeRepo.create({
        name: 'Dup Employee',
        username: `dup-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      await expect(employeeRepo.reorder([a.id, a.id])).rejects.toThrow();
    });
  });

  it('updates employee fields', async () => {
    const created = await employeeRepo.create({
      name: 'Original Name',
      username: `orig-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    const updated = await employeeRepo.update({
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

  it('deactivates an employee', async () => {
    const created = await employeeRepo.create({
      name: 'To Deactivate',
      username: `deact-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    const deactivated = await employeeRepo.deactivate(created.id);
    expect(deactivated.isActive).toBe(false);
  });

  it('reactivates a previously-deactivated employee via update()', async () => {
    const created = await employeeRepo.create({
      name: 'To Reactivate',
      username: `react-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    await employeeRepo.deactivate(created.id);
    expect((await employeeRepo.getById(created.id))?.isActive).toBe(false);

    const reactivated = await employeeRepo.update({
      id: created.id,
      name: created.name,
      role: created.role,
      isSalaried: created.isSalaried,
      isActive: true,
    });

    expect(reactivated.isActive).toBe(true);
    expect((await employeeRepo.getById(created.id))?.isActive).toBe(true);
  });

  it('throws when creating an employee with a username that is already taken', async () => {
    const username = `dupe-${Date.now()}`;
    await employeeRepo.create({
      name: 'First',
      username,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    await expect(
      employeeRepo.create({
        name: 'Second',
        username,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      }),
    ).rejects.toThrow();
  });

  it('finds an employee by username regardless of case', async () => {
    const username = `CaseTest-${Date.now()}`;
    await employeeRepo.create({
      name: 'Case Test',
      username,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    expect((await employeeRepo.findByUsername(username.toUpperCase()))?.username).toBe(username);
    expect((await employeeRepo.findByUsername(username.toLowerCase()))?.username).toBe(username);
  });

  it('replaces department assignments', async () => {
    const created = await employeeRepo.create({
      name: 'Dept Swap',
      username: `swap-${Date.now()}`,
      passwordHash: 'hash',
      role: 'employee',
      isSalaried: false,
      departments: ['bar'],
    });

    const updated = await employeeRepo.setDepartments(created.id, ['front_desk', 'cafe']);
    expect([...updated.departments].sort()).toEqual(['cafe', 'front_desk']);
  });

  it('creates an employee with the coordinator role', async () => {
    const created = await employeeRepo.create({
      name: 'Casey Coordinator',
      username: `casey-${Date.now()}`,
      passwordHash: 'hash',
      role: 'coordinator',
      isSalaried: false,
      departments: [],
    });

    expect(created.role).toBe('coordinator');
  });

  describe('getLastReadNoticesAt / markNoticesRead', () => {
    it('is null until the employee has never had it set', async () => {
      const created = await employeeRepo.create({
        name: 'Notice Reader',
        username: `reader-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      expect(await employeeRepo.getLastReadNoticesAt(created.id)).toBeNull();
    });

    it('sets the timestamp to roughly now', async () => {
      const created = await employeeRepo.create({
        name: 'Notice Reader',
        username: `reader-${Date.now()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      const before = Date.now();
      await employeeRepo.markNoticesRead(created.id);
      const after = Date.now();

      const lastReadAt = await employeeRepo.getLastReadNoticesAt(created.id);
      expect(lastReadAt).not.toBeNull();
      expect(lastReadAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(lastReadAt!.getTime()).toBeLessThanOrEqual(after + 1000);
    });
  });
});
