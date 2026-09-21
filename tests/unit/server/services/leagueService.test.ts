import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as leagueService from '../../../../server/src/services/leagueService.js';
import { LeagueNotFoundError, UnauthorizedLeagueActionError } from '../../../../server/src/services/leagueService.js';
import type { LeagueInput } from '../../../../server/src/db/repositories/leagueRepo.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

// `createdByEmployeeId` carries a real FK to `employees`, so every actor that
// can reach a `create` call must be a real row (see noticeService.test.ts's
// identical note) — a hardcoded id fails with a foreign-key violation.
let secretaryActor: RequestingActor;
let managerActor: RequestingActor;
let taggedCoordinatorActor: RequestingActor;
let employeeActor: RequestingActor;

const validInput: LeagueInput = {
  name: 'Tuesday Night Mixed',
  spotsPerTeam: 4,
  numWeeks: 33,
  currentWeek: 1,
  prizeFund: 3,
  lineage: 2.5,
  sweeperActive: false,
  sweeperAmount: 0,
  vacancyFee: 2,
  lineageDiscountAmount: 1,
  prizeFundDiscountAmount: 1,
  sponsorFeePerTeam: 100,
  sponsorFeeActive: true,
  depositFeeActive: true,
  depositFeeAmount: 20,
  sponsorFeeDueWeek: 3,
  prizeFundCoverChargeDueWeek: 5,
  lastTwoWeeksDueWeek: 32,
  sanctionedLeague: true,
};

beforeEach(async () => {
  await truncateAllTables();

  const secretary = await employeeRepo.create({
    name: 'Sam Secretary',
    username: `sam-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'secretary',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  secretaryActor = { id: secretary.id, role: 'secretary', isSecretaryTagged: false };

  const manager = await employeeRepo.create({
    name: 'Jesse Manager',
    username: `jesse-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: true,
    isSecretaryTagged: false,
    departments: [],
  });
  managerActor = { id: manager.id, role: 'manager', isSecretaryTagged: false };

  const taggedCoordinator = await employeeRepo.create({
    name: 'Casey Coordinator',
    username: `casey-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'coordinator',
    isSalaried: false,
    isSecretaryTagged: true,
    departments: ['front_desk'],
  });
  taggedCoordinatorActor = { id: taggedCoordinator.id, role: 'coordinator', isSecretaryTagged: true };

  const employee = await employeeRepo.create({
    name: 'Riley Front',
    username: `riley-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: ['front_desk'],
  });
  employeeActor = { id: employee.id, role: 'employee', isSecretaryTagged: false };
});

describe('leagueService', () => {
  describe('createLeague', () => {
    it('lets a secretary create a league', async () => {
      const created = await leagueService.createLeague(secretaryActor, validInput);
      expect(created.name).toBe('Tuesday Night Mixed');
      expect(created.createdByEmployeeId).toBe(secretaryActor.id);
    });

    it('lets a manager create a league', async () => {
      const created = await leagueService.createLeague(managerActor, validInput);
      expect(created.name).toBe('Tuesday Night Mixed');
    });

    it('lets a Secretary-tagged coordinator create a league', async () => {
      const created = await leagueService.createLeague(taggedCoordinatorActor, validInput);
      expect(created.name).toBe('Tuesday Night Mixed');
    });

    it('refuses a plain employee from creating a league', async () => {
      await expect(leagueService.createLeague(employeeActor, validInput)).rejects.toThrow(
        UnauthorizedLeagueActionError,
      );
    });

    it('requires a non-blank name', async () => {
      await expect(
        leagueService.createLeague(secretaryActor, { ...validInput, name: '   ' }),
      ).rejects.toThrow();
    });

    it('requires at least 1 spot per team', async () => {
      await expect(
        leagueService.createLeague(secretaryActor, { ...validInput, spotsPerTeam: 0 }),
      ).rejects.toThrow();
    });

    it('requires the current week to fall within the season length', async () => {
      await expect(
        leagueService.createLeague(secretaryActor, {
          ...validInput,
          numWeeks: 10,
          currentWeek: 11,
        }),
      ).rejects.toThrow();
    });
  });

  describe('listLeagues / getLeague', () => {
    it('lists every league regardless of who created it', async () => {
      await leagueService.createLeague(secretaryActor, validInput);
      await leagueService.createLeague(managerActor, { ...validInput, name: 'Wednesday Trio' });

      const leagues = await leagueService.listLeagues(secretaryActor);
      expect(leagues).toHaveLength(2);
    });

    it('refuses a plain employee from listing leagues', async () => {
      await expect(leagueService.listLeagues(employeeActor)).rejects.toThrow(
        UnauthorizedLeagueActionError,
      );
    });

    it('throws LeagueNotFoundError for a missing id', async () => {
      await expect(leagueService.getLeague(secretaryActor, 999999)).rejects.toThrow(
        LeagueNotFoundError,
      );
    });
  });

  describe('updateLeague', () => {
    it('updates fields and advances the current week', async () => {
      const created = await leagueService.createLeague(secretaryActor, validInput);
      const updated = await leagueService.updateLeague(secretaryActor, created.id, {
        ...validInput,
        currentWeek: 2,
      });
      expect(updated.currentWeek).toBe(2);
    });

    it('throws LeagueNotFoundError for a missing id', async () => {
      await expect(
        leagueService.updateLeague(secretaryActor, 999999, validInput),
      ).rejects.toThrow(LeagueNotFoundError);
    });
  });

  describe('removeLeague', () => {
    it('removes a league', async () => {
      const created = await leagueService.createLeague(secretaryActor, validInput);
      await leagueService.removeLeague(secretaryActor, created.id);
      expect(await leagueService.listLeagues(secretaryActor)).toHaveLength(0);
    });

    it('refuses a plain employee from removing a league', async () => {
      const created = await leagueService.createLeague(secretaryActor, validInput);
      await expect(leagueService.removeLeague(employeeActor, created.id)).rejects.toThrow(
        UnauthorizedLeagueActionError,
      );
    });
  });
});
