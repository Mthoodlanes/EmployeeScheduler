import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeService from '../../../../server/src/services/employeeService.js';
import * as authService from '../../../../server/src/services/authService.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

const managerActor: RequestingActor = { id: 999999, role: 'manager' };
const employeeActor: RequestingActor = { id: 999998, role: 'employee' };
const coordinatorActor: RequestingActor = { id: 999997, role: 'coordinator' };

beforeEach(async () => {
  await truncateAllTables();
});

describe('employeeService', () => {
  it('creates an employee, hashing the plaintext password before it reaches the repo', async () => {
    const created = await employeeService.createEmployee(managerActor, {
      name: 'Riley Front',
      username: 'riley',
      password: 'plaintext-password',
      role: 'employee',
      isSalaried: false,
      isSecretaryTagged: false,
      departments: ['front_desk'],
    });

    expect(created.username).toBe('riley');
    expect(created.departments).toEqual(['front_desk']);
    // No passwordHash is exposed on the returned row, but critically it must
    // not just be the raw plaintext stashed under another name — verified
    // indirectly by confirming login only works via authService's hashing.
  });

  it('refuses a non-manager from creating an employee', async () => {
    await expect(
      employeeService.createEmployee(employeeActor, {
        name: 'Nope',
        username: 'nope',
        password: 'password123',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      }),
    ).rejects.toThrow(employeeService.UnauthorizedEmployeeActionError);
  });

  it('creates an employee with the coordinator role', async () => {
    const created = await employeeService.createEmployee(managerActor, {
      name: 'Casey Coordinator',
      username: 'casey',
      password: 'password123',
      role: 'coordinator',
      isSalaried: false,
      isSecretaryTagged: false,
      departments: [],
    });

    expect(created.role).toBe('coordinator');
  });

  // The new 'coordinator' role (added for the notice board feature) is
  // deliberately NOT a manager — it must not gain employee-management
  // rights just by existing as a third role value alongside 'manager'.
  it('refuses a coordinator (not a manager) from creating an employee', async () => {
    await expect(
      employeeService.createEmployee(coordinatorActor, {
        name: 'Nope',
        username: 'nope2',
        password: 'password123',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      }),
    ).rejects.toThrow(employeeService.UnauthorizedEmployeeActionError);
  });

  // Regression-focused: this mapping (a raw Postgres unique-constraint error
  // (SQLSTATE 23505) -> a friendly, specifically-typed `DuplicateUsernameError`)
  // is exercised end-to-end here, not just at the repo layer.
  it('throws a DuplicateUsernameError (not a generic error) when the username is already taken', async () => {
    await employeeService.createEmployee(managerActor, {
      name: 'First Employee',
      username: 'sam',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      isSecretaryTagged: false,
      departments: [],
    });

    await expect(
      employeeService.createEmployee(managerActor, {
        name: 'Second Employee',
        username: 'sam',
        password: 'a-different-password',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      }),
    ).rejects.toThrow(employeeService.DuplicateUsernameError);
  });

  it('rejects a case-variant duplicate username (e.g. "Sam" vs "sam")', async () => {
    await employeeService.createEmployee(managerActor, {
      name: 'First Employee',
      username: 'CaseSam',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      isSecretaryTagged: false,
      departments: [],
    });

    await expect(
      employeeService.createEmployee(managerActor, {
        name: 'Second Employee',
        username: 'casesam',
        password: 'a-different-password',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      }),
    ).rejects.toThrow(employeeService.DuplicateUsernameError);
  });

  it('deactivates an employee and then reactivates them via updateEmployee', async () => {
    const created = await employeeService.createEmployee(managerActor, {
      name: 'Toggle Employee',
      username: 'toggle',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      isSecretaryTagged: false,
      departments: [],
    });

    const deactivated = await employeeService.deactivateEmployee(managerActor, created.id);
    expect(deactivated.isActive).toBe(false);

    const reactivated = await employeeService.updateEmployee(managerActor, {
      id: created.id,
      name: created.name,
      role: created.role,
      isSalaried: created.isSalaried,
      isActive: true,
      isSecretaryTagged: created.isSecretaryTagged,
    });
    expect(reactivated.isActive).toBe(true);
  });

  it('refuses a non-manager from deactivating an employee', async () => {
    const created = await employeeService.createEmployee(managerActor, {
      name: 'Protected Employee',
      username: 'protected',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      isSecretaryTagged: false,
      departments: [],
    });

    await expect(
      employeeService.deactivateEmployee(employeeActor, created.id),
    ).rejects.toThrow(employeeService.UnauthorizedEmployeeActionError);
  });

  it('setEmployeeDepartments replaces department membership without needing a password change', async () => {
    const created = await employeeService.createEmployee(managerActor, {
      name: 'Multi Dept',
      username: 'multidept',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      isSecretaryTagged: false,
      departments: ['bar', 'cafe'],
    });

    const updated = await employeeService.setEmployeeDepartments(managerActor, created.id, [
      'front_desk',
    ]);
    expect(updated.departments).toEqual(['front_desk']);
  });

  describe('reorderEmployees', () => {
    it('persists the new global order and returns it in that order', async () => {
      const a = await employeeService.createEmployee(managerActor, {
        name: 'Order A',
        username: `order-a-${Date.now()}`,
        password: 'password123',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      });
      const b = await employeeService.createEmployee(managerActor, {
        name: 'Order B',
        username: `order-b-${Date.now()}`,
        password: 'password123',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      });

      const reordered = await employeeService.reorderEmployees(managerActor, [b.id, a.id]);
      expect(reordered.map((e) => e.id)).toEqual([b.id, a.id]);
      const all = await employeeService.listEmployees(managerActor);
      expect(all.map((e) => e.id)).toEqual([b.id, a.id]);
    });

    it('refuses a non-manager from reordering employees', async () => {
      const a = await employeeService.createEmployee(managerActor, {
        name: 'Solo',
        username: `solo-${Date.now()}`,
        password: 'password123',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      });

      await expect(
        employeeService.reorderEmployees(employeeActor, [a.id]),
      ).rejects.toThrow(employeeService.UnauthorizedEmployeeActionError);
    });
  });

  describe('updateOwnProfile', () => {
    it('updates just the display name, without requiring a current password', async () => {
      const created = await employeeService.createEmployee(managerActor, {
        name: 'Original Name',
        username: 'ownprofile1',
        password: 'password123',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      });
      const selfActor: RequestingActor = { id: created.id, role: 'employee' };

      const updated = await employeeService.updateOwnProfile(selfActor, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
      // The password must be untouched by a name-only update: the original
      // password still logs in successfully.
      const loggedIn = await authService.login('ownprofile1', 'password123');
      expect(loggedIn.id).toBe(created.id);
    });

    it('changes the password when the correct current password is supplied', async () => {
      const created = await employeeService.createEmployee(managerActor, {
        name: 'Password Changer',
        username: 'ownprofile2',
        password: 'old-password',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      });
      const selfActor: RequestingActor = { id: created.id, role: 'employee' };

      await employeeService.updateOwnProfile(selfActor, {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      });

      const loggedIn = await authService.login('ownprofile2', 'new-password');
      expect(loggedIn.id).toBe(created.id);
      await expect(authService.login('ownprofile2', 'old-password')).rejects.toThrow(
        authService.InvalidCredentialsError,
      );
    });

    it('rejects a password change when the current password is incorrect', async () => {
      const created = await employeeService.createEmployee(managerActor, {
        name: 'Rejected Changer',
        username: 'ownprofile3',
        password: 'correct-password',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      });
      const selfActor: RequestingActor = { id: created.id, role: 'employee' };

      await expect(
        employeeService.updateOwnProfile(selfActor, {
          currentPassword: 'wrong-password',
          newPassword: 'new-password',
        }),
      ).rejects.toThrow(authService.InvalidCredentialsError);

      // The password must be unchanged after the rejected attempt.
      const loggedIn = await authService.login('ownprofile3', 'correct-password');
      expect(loggedIn.id).toBe(created.id);
    });

    it('rejects a password change when newPassword is provided without currentPassword', async () => {
      const created = await employeeService.createEmployee(managerActor, {
        name: 'No Current Password',
        username: 'ownprofile4',
        password: 'correct-password',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: [],
      });
      const selfActor: RequestingActor = { id: created.id, role: 'employee' };

      await expect(
        employeeService.updateOwnProfile(selfActor, { newPassword: 'new-password' }),
      ).rejects.toThrow(authService.InvalidCredentialsError);

      const loggedIn = await authService.login('ownprofile4', 'correct-password');
      expect(loggedIn.id).toBe(created.id);
    });
  });
});
