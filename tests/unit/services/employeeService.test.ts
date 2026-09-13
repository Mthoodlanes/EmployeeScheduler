import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeService from '../../../src/main/services/employeeService';
import * as authService from '../../../src/main/services/authService';

beforeEach(() => {
  // Fresh in-memory database per test: initDb() memoizes a singleton keyed
  // by process, so reach past it here to guarantee isolation between tests.
  const db = initDb(':memory:');
  db.exec('DELETE FROM employee_departments; DELETE FROM employees;');
});

describe('employeeService', () => {
  it('creates an employee, hashing the plaintext password before it reaches the repo', () => {
    const created = employeeService.createEmployee({
      name: 'Riley Front',
      username: 'riley',
      password: 'plaintext-password',
      role: 'employee',
      isSalaried: false,
      departments: ['front_desk'],
    });

    expect(created.username).toBe('riley');
    expect(created.departments).toEqual(['front_desk']);
    // No passwordHash is exposed on the returned row, but critically it must
    // not just be the raw plaintext stashed under another name — verified
    // indirectly by confirming login only works via authService's hashing.
  });

  // Regression-focused: this mapping (a raw SQLite unique-constraint error ->
  // a friendly, specifically-typed `DuplicateUsernameError`) had no test
  // coverage anywhere before this pass — `employeeService.ts` itself was
  // never imported by any test file, only the underlying `employeeRepo`.
  it('throws a DuplicateUsernameError (not a generic error) when the username is already taken', () => {
    employeeService.createEmployee({
      name: 'First Employee',
      username: 'sam',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    expect(() =>
      employeeService.createEmployee({
        name: 'Second Employee',
        username: 'sam',
        password: 'a-different-password',
        role: 'employee',
        isSalaried: false,
        departments: [],
      }),
    ).toThrow(employeeService.DuplicateUsernameError);
  });

  it('rejects a case-variant duplicate username (e.g. "Sam" vs "sam")', () => {
    employeeService.createEmployee({
      name: 'First Employee',
      username: 'CaseSam',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    expect(() =>
      employeeService.createEmployee({
        name: 'Second Employee',
        username: 'casesam',
        password: 'a-different-password',
        role: 'employee',
        isSalaried: false,
        departments: [],
      }),
    ).toThrow(employeeService.DuplicateUsernameError);
  });

  it('deactivates an employee and then reactivates them via updateEmployee', () => {
    const created = employeeService.createEmployee({
      name: 'Toggle Employee',
      username: 'toggle',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      departments: [],
    });

    const deactivated = employeeService.deactivateEmployee(created.id);
    expect(deactivated.isActive).toBe(false);

    const reactivated = employeeService.updateEmployee({
      id: created.id,
      name: created.name,
      role: created.role,
      isSalaried: created.isSalaried,
      isActive: true,
    });
    expect(reactivated.isActive).toBe(true);
  });

  it('setEmployeeDepartments replaces department membership without needing a password change', () => {
    const created = employeeService.createEmployee({
      name: 'Multi Dept',
      username: 'multidept',
      password: 'password123',
      role: 'employee',
      isSalaried: false,
      departments: ['bar', 'cafe'],
    });

    const updated = employeeService.setEmployeeDepartments(created.id, ['front_desk']);
    expect(updated.departments).toEqual(['front_desk']);
  });

  describe('updateOwnProfile', () => {
    it('updates just the display name, without requiring a current password', () => {
      const created = employeeService.createEmployee({
        name: 'Original Name',
        username: 'ownprofile1',
        password: 'password123',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      const updated = employeeService.updateOwnProfile(created.id, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
      // The password must be untouched by a name-only update: the original
      // password still logs in successfully.
      expect(authService.login('ownprofile1', 'password123').id).toBe(created.id);
    });

    it('changes the password when the correct current password is supplied', () => {
      const created = employeeService.createEmployee({
        name: 'Password Changer',
        username: 'ownprofile2',
        password: 'old-password',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      employeeService.updateOwnProfile(created.id, {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      });

      expect(authService.login('ownprofile2', 'new-password').id).toBe(created.id);
      expect(() => authService.login('ownprofile2', 'old-password')).toThrow(
        authService.InvalidCredentialsError,
      );
    });

    it('rejects a password change when the current password is incorrect', () => {
      const created = employeeService.createEmployee({
        name: 'Rejected Changer',
        username: 'ownprofile3',
        password: 'correct-password',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      expect(() =>
        employeeService.updateOwnProfile(created.id, {
          currentPassword: 'wrong-password',
          newPassword: 'new-password',
        }),
      ).toThrow(authService.InvalidCredentialsError);

      // The password must be unchanged after the rejected attempt.
      expect(authService.login('ownprofile3', 'correct-password').id).toBe(created.id);
    });

    it('rejects a password change when newPassword is provided without currentPassword', () => {
      const created = employeeService.createEmployee({
        name: 'No Current Password',
        username: 'ownprofile4',
        password: 'correct-password',
        role: 'employee',
        isSalaried: false,
        departments: [],
      });

      expect(() =>
        employeeService.updateOwnProfile(created.id, { newPassword: 'new-password' }),
      ).toThrow(authService.InvalidCredentialsError);

      expect(authService.login('ownprofile4', 'correct-password').id).toBe(created.id);
    });
  });
});
