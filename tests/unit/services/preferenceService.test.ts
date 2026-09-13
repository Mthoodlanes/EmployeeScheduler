import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';
import * as preferenceService from '../../../src/main/services/preferenceService';
import {
  PreferenceNotFoundError,
  UnauthorizedPreferenceActionError,
} from '../../../src/main/services/preferenceService';

let employeeId: number;
let otherEmployeeId: number;
let employeeActor: { id: number; role: 'employee' };
let managerActor: { id: number; role: 'manager' };

beforeEach(() => {
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
  employeeActor = { id: employee.id, role: 'employee' };

  const otherEmployee = employeeRepo.create({
    name: 'Other Employee',
    username: `other-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    departments: [],
  });
  otherEmployeeId = otherEmployee.id;

  const manager = employeeRepo.create({
    name: 'Dana Manager',
    username: `dana-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: false,
    departments: [],
  });
  managerActor = { id: manager.id, role: 'manager' };
});

describe('preferenceService', () => {
  describe('createPreference', () => {
    it('lets a manager create a preference window for an employee', () => {
      const created = preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
        note: 'Prefers mornings',
      });

      expect(created.employeeId).toBe(employeeId);
      expect(created.note).toBe('Prefers mornings');
    });

    it('refuses a non-manager from creating a preference', () => {
      expect(() =>
        preferenceService.createPreference(employeeActor, {
          employeeId,
          dayOfWeek: 1,
          preferredStartTime: '08:00',
          preferredEndTime: '12:00',
        }),
      ).toThrow(UnauthorizedPreferenceActionError);
    });

    it('rejects an end time that is not after the start time', () => {
      expect(() =>
        preferenceService.createPreference(managerActor, {
          employeeId,
          dayOfWeek: 1,
          preferredStartTime: '12:00',
          preferredEndTime: '08:00',
        }),
      ).toThrow();
    });
  });

  describe('listAllPreferences / listPreferencesForEmployee', () => {
    it('lists preferences across every employee', () => {
      preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });
      preferenceService.createPreference(managerActor, {
        employeeId: otherEmployeeId,
        dayOfWeek: 2,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      expect(preferenceService.listAllPreferences()).toHaveLength(2);
    });

    it('scopes listPreferencesForEmployee to just that employee', () => {
      preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });
      preferenceService.createPreference(managerActor, {
        employeeId: otherEmployeeId,
        dayOfWeek: 2,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      const mine = preferenceService.listPreferencesForEmployee(employeeId);
      expect(mine).toHaveLength(1);
      expect(mine[0].employeeId).toBe(employeeId);
    });
  });

  describe('updatePreference', () => {
    it('lets a manager update an existing preference', () => {
      const created = preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      const updated = preferenceService.updatePreference(managerActor, {
        id: created.id,
        dayOfWeek: 5,
        preferredStartTime: '14:00',
        preferredEndTime: '20:00',
        note: 'Now evenings',
      });

      expect(updated.dayOfWeek).toBe(5);
      expect(updated.note).toBe('Now evenings');
    });

    it('refuses a non-manager from updating a preference', () => {
      const created = preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      expect(() =>
        preferenceService.updatePreference(employeeActor, {
          id: created.id,
          dayOfWeek: 5,
          preferredStartTime: '14:00',
          preferredEndTime: '20:00',
        }),
      ).toThrow(UnauthorizedPreferenceActionError);
    });

    it('throws when the preference does not exist', () => {
      expect(() =>
        preferenceService.updatePreference(managerActor, {
          id: 999999,
          dayOfWeek: 1,
          preferredStartTime: '08:00',
          preferredEndTime: '12:00',
        }),
      ).toThrow(PreferenceNotFoundError);
    });
  });

  describe('removePreference', () => {
    it('lets a manager remove a preference', () => {
      const created = preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      preferenceService.removePreference(managerActor, created.id);
      expect(preferenceService.listPreferencesForEmployee(employeeId)).toHaveLength(0);
    });

    it('refuses a non-manager from removing a preference', () => {
      const created = preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      expect(() => preferenceService.removePreference(employeeActor, created.id)).toThrow(
        UnauthorizedPreferenceActionError,
      );
    });

    it('throws when the preference does not exist', () => {
      expect(() => preferenceService.removePreference(managerActor, 999999)).toThrow(
        PreferenceNotFoundError,
      );
    });
  });
});
