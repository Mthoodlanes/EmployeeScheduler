import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as leagueService from '../../../../server/src/services/leagueService.js';
import * as duesTeamService from '../../../../server/src/services/duesTeamService.js';
import * as bowlerService from '../../../../server/src/services/bowlerService.js';
import {
  BowlerNotFoundError,
  UnauthorizedBowlerActionError,
} from '../../../../server/src/services/bowlerService.js';
import type { LeagueInput } from '../../../../server/src/db/repositories/leagueRepo.js';
import type { DuesTeamInput } from '../../../../server/src/db/repositories/duesTeamRepo.js';
import type { BowlerInput } from '../../../../server/src/db/repositories/bowlerRepo.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

// `leagues.createdByEmployeeId` carries a real FK to `employees` — see
// leagueService.test.ts's identical note.
let secretaryActor: RequestingActor;
let employeeActor: RequestingActor;

const leagueInput: LeagueInput = {
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

const teamInput: DuesTeamInput = { name: 'The Pin Pals', folded: false, sponsorPaid: 0 };

const bowlerInput: BowlerInput = {
  name: 'Walter Sobchak',
  status: 'active',
  phone: '555-1212',
  lineageDiscount: false,
  prizeFundDiscount: false,
  dropNoticeWeek: '',
  notes: '',
  depositPaid: 0,
  depositOptOut: false,
  usbcCardPaid: false,
};

async function makeTeam() {
  const league = await leagueService.createLeague(secretaryActor, leagueInput);
  return duesTeamService.createTeam(secretaryActor, league.id, teamInput);
}

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

describe('bowlerService', () => {
  describe('createBowler', () => {
    it('lets a secretary add a bowler to a team', async () => {
      const team = await makeTeam();
      const bowler = await bowlerService.createBowler(secretaryActor, team.id, bowlerInput);
      expect(bowler.teamId).toBe(team.id);
      expect(bowler.name).toBe('Walter Sobchak');
      expect(bowler.status).toBe('active');
    });

    it('refuses a plain employee', async () => {
      const team = await makeTeam();
      await expect(
        bowlerService.createBowler(employeeActor, team.id, bowlerInput),
      ).rejects.toThrow(UnauthorizedBowlerActionError);
    });

    it('requires a non-blank name', async () => {
      const team = await makeTeam();
      await expect(
        bowlerService.createBowler(secretaryActor, team.id, { ...bowlerInput, name: '   ' }),
      ).rejects.toThrow();
    });

    it('throws when the team does not exist', async () => {
      await expect(
        bowlerService.createBowler(secretaryActor, 999999, bowlerInput),
      ).rejects.toThrow();
    });
  });

  describe('listBowlersForTeam / listBowlersForTeams', () => {
    it('lists bowlers scoped to one team', async () => {
      const team = await makeTeam();
      await bowlerService.createBowler(secretaryActor, team.id, bowlerInput);
      await bowlerService.createBowler(secretaryActor, team.id, {
        ...bowlerInput,
        name: 'Donny Kerabatsos',
      });

      const bowlers = await bowlerService.listBowlersForTeam(secretaryActor, team.id);
      expect(bowlers).toHaveLength(2);
    });

    it('lists bowlers across multiple teams at once', async () => {
      const teamA = await makeTeam();
      const league = await leagueService.getLeague(secretaryActor, teamA.leagueId);
      const teamB = await duesTeamService.createTeam(secretaryActor, league.id, {
        ...teamInput,
        name: 'Gutter Balls',
      });
      await bowlerService.createBowler(secretaryActor, teamA.id, bowlerInput);
      await bowlerService.createBowler(secretaryActor, teamB.id, {
        ...bowlerInput,
        name: 'Jesus Quintana',
      });

      const bowlers = await bowlerService.listBowlersForTeams(secretaryActor, [teamA.id, teamB.id]);
      expect(bowlers).toHaveLength(2);
    });
  });

  describe('updateBowler / removeBowler', () => {
    it('updates a bowler, e.g. marking them left', async () => {
      const team = await makeTeam();
      const bowler = await bowlerService.createBowler(secretaryActor, team.id, bowlerInput);
      const updated = await bowlerService.updateBowler(secretaryActor, bowler.id, {
        ...bowlerInput,
        status: 'left',
      });
      expect(updated.status).toBe('left');
    });

    it('throws BowlerNotFoundError updating a missing bowler', async () => {
      await expect(
        bowlerService.updateBowler(secretaryActor, 999999, bowlerInput),
      ).rejects.toThrow(BowlerNotFoundError);
    });

    it('removes a bowler', async () => {
      const team = await makeTeam();
      const bowler = await bowlerService.createBowler(secretaryActor, team.id, bowlerInput);
      await bowlerService.removeBowler(secretaryActor, bowler.id);
      expect(await bowlerService.listBowlersForTeam(secretaryActor, team.id)).toHaveLength(0);
    });

    it('refuses a plain employee from removing a bowler', async () => {
      const team = await makeTeam();
      const bowler = await bowlerService.createBowler(secretaryActor, team.id, bowlerInput);
      await expect(bowlerService.removeBowler(employeeActor, bowler.id)).rejects.toThrow(
        UnauthorizedBowlerActionError,
      );
    });
  });
});
