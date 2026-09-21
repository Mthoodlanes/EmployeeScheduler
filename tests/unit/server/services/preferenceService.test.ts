import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as preferenceService from '../../../../server/src/services/preferenceService.js';
import {
  PreferenceNotFoundError,
  UnauthorizedPreferenceActionError,
} from '../../../../server/src/services/preferenceService.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

let employeeId: number;
let otherEmployeeId: number;
let employeeActor: RequestingActor;
let managerActor: RequestingActor;

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
  employeeActor = { id: employee.id, role: 'employee' };

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

  const manager = await employeeRepo.create({
    name: 'Dana Manager',
    username: `dana-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  managerActor = { id: manager.id, role: 'manager' };
});

describe('preferenceService', () => {
  describe('createPreference', () => {
    it('lets a manager create a preference window for an employee', async () => {
      const created = await preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
        note: 'Prefers mornings',
      });

      expect(created.employeeId).toBe(employeeId);
      expect(created.note).toBe('Prefers mornings');
    });

    it('refuses a non-manager from creating a preference', async () => {
      await expect(
        preferenceService.createPreference(employeeActor, {
          employeeId,
          dayOfWeek: 1,
          preferredStartTime: '08:00',
          preferredEndTime: '12:00',
        }),
      ).rejects.toThrow(UnauthorizedPreferenceActionError);
    });

    it('rejects an end time that is not after the start time', async () => {
      await expect(
        preferenceService.createPreference(managerActor, {
          employeeId,
          dayOfWeek: 1,
          preferredStartTime: '12:00',
          preferredEndTime: '08:00',
        }),
      ).rejects.toThrow();
    });
  });

  describe('listAllPreferences / listPreferencesForEmployee', () => {
    it('lists preferences across every employee', async () => {
      await preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });
      await preferenceService.createPreference(managerActor, {
        employeeId: otherEmployeeId,
        dayOfWeek: 2,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      expect(await preferenceService.listAllPreferences()).toHaveLength(2);
    });

    it('scopes listPreferencesForEmployee to just that employee', async () => {
      await preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });
      await preferenceService.createPreference(managerActor, {
        employeeId: otherEmployeeId,
        dayOfWeek: 2,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      const mine = await preferenceService.listPreferencesForEmployee(employeeId);
      expect(mine).toHaveLength(1);
      expect(mine[0].employeeId).toBe(employeeId);
    });
  });

  describe('updatePreference', () => {
    it('lets a manager update an existing preference', async () => {
      const created = await preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      const updated = await preferenceService.updatePreference(managerActor, {
        id: created.id,
        dayOfWeek: 5,
        preferredStartTime: '14:00',
        preferredEndTime: '20:00',
        note: 'Now evenings',
      });

      expect(updated.dayOfWeek).toBe(5);
      expect(updated.note).toBe('Now evenings');
    });

    it('refuses a non-manager from updating a preference', async () => {
      const created = await preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      await expect(
        preferenceService.updatePreference(employeeActor, {
          id: created.id,
          dayOfWeek: 5,
          preferredStartTime: '14:00',
          preferredEndTime: '20:00',
        }),
      ).rejects.toThrow(UnauthorizedPreferenceActionError);
    });

    it('throws when the preference does not exist', async () => {
      await expect(
        preferenceService.updatePreference(managerActor, {
          id: 999999,
          dayOfWeek: 1,
          preferredStartTime: '08:00',
          preferredEndTime: '12:00',
        }),
      ).rejects.toThrow(PreferenceNotFoundError);
    });
  });

  describe('removePreference', () => {
    it('lets a manager remove a preference', async () => {
      const created = await preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      await preferenceService.removePreference(managerActor, created.id);
      expect(await preferenceService.listPreferencesForEmployee(employeeId)).toHaveLength(0);
    });

    it('refuses a non-manager from removing a preference', async () => {
      const created = await preferenceService.createPreference(managerActor, {
        employeeId,
        dayOfWeek: 1,
        preferredStartTime: '08:00',
        preferredEndTime: '12:00',
      });

      await expect(
        preferenceService.removePreference(employeeActor, created.id),
      ).rejects.toThrow(UnauthorizedPreferenceActionError);
    });

    it('throws when the preference does not exist', async () => {
      await expect(preferenceService.removePreference(managerActor, 999999)).rejects.toThrow(
        PreferenceNotFoundError,
      );
    });
  });
});
