import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as leagueService from '../../../../server/src/services/leagueService.js';
import * as duesTeamService from '../../../../server/src/services/duesTeamService.js';
import {
  DuesTeamNotFoundError,
  UnauthorizedDuesTeamActionError,
} from '../../../../server/src/services/duesTeamService.js';
import * as bowlerService from '../../../../server/src/services/bowlerService.js';
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
  phone: '',
  lineageDiscount: false,
  prizeFundDiscount: false,
  dropNoticeWeek: '',
  notes: '',
  depositPaid: 0,
  depositOptOut: false,
  usbcCardPaid: false,
  lastTwoWeeksPaid: 0,
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

describe('duesTeamService', () => {
  describe('createTeam', () => {
    it('lets a secretary create a team under a league', async () => {
      const league = await leagueService.createLeague(secretaryActor, leagueInput);
      const team = await duesTeamService.createTeam(secretaryActor, league.id, teamInput);
      expect(team.leagueId).toBe(league.id);
      expect(team.name).toBe('The Pin Pals');
    });

    it('refuses a plain employee', async () => {
      const league = await leagueService.createLeague(secretaryActor, leagueInput);
      await expect(
        duesTeamService.createTeam(employeeActor, league.id, teamInput),
      ).rejects.toThrow(UnauthorizedDuesTeamActionError);
    });

    it('requires a non-blank name', async () => {
      const league = await leagueService.createLeague(secretaryActor, leagueInput);
      await expect(
        duesTeamService.createTeam(secretaryActor, league.id, { ...teamInput, name: '  ' }),
      ).rejects.toThrow();
    });

    it('throws when the league does not exist', async () => {
      await expect(
        duesTeamService.createTeam(secretaryActor, 999999, teamInput),
      ).rejects.toThrow();
    });
  });

  describe('listTeamsForLeague', () => {
    it('lists only teams for the given league', async () => {
      const league = await leagueService.createLeague(secretaryActor, leagueInput);
      const otherLeague = await leagueService.createLeague(secretaryActor, {
        ...leagueInput,
        name: 'Wednesday Trio',
      });
      await duesTeamService.createTeam(secretaryActor, league.id, teamInput);
      await duesTeamService.createTeam(secretaryActor, otherLeague.id, {
        ...teamInput,
        name: 'Gutter Balls',
      });

      const teams = await duesTeamService.listTeamsForLeague(secretaryActor, league.id);
      expect(teams).toHaveLength(1);
      expect(teams[0]?.name).toBe('The Pin Pals');
    });
  });

  describe('updateTeam / removeTeam', () => {
    it('updates a team', async () => {
      const league = await leagueService.createLeague(secretaryActor, leagueInput);
      const team = await duesTeamService.createTeam(secretaryActor, league.id, teamInput);
      const updated = await duesTeamService.updateTeam(secretaryActor, team.id, {
        ...teamInput,
        folded: true,
      });
      expect(updated.folded).toBe(true);
    });

    it('throws DuesTeamNotFoundError updating a missing team', async () => {
      await expect(
        duesTeamService.updateTeam(secretaryActor, 999999, teamInput),
      ).rejects.toThrow(DuesTeamNotFoundError);
    });

    it('removes a team', async () => {
      const league = await leagueService.createLeague(secretaryActor, leagueInput);
      const team = await duesTeamService.createTeam(secretaryActor, league.id, teamInput);
      await duesTeamService.removeTeam(secretaryActor, team.id);
      expect(await duesTeamService.listTeamsForLeague(secretaryActor, league.id)).toHaveLength(0);
    });
  });

  describe('removeEmptyTeams', () => {
    it('removes only teams with zero bowlers', async () => {
      const league = await leagueService.createLeague(secretaryActor, leagueInput);
      const staffed = await duesTeamService.createTeam(secretaryActor, league.id, teamInput);
      await duesTeamService.createTeam(secretaryActor, league.id, {
        ...teamInput,
        name: 'Empty Lane',
      });
      await bowlerService.createBowler(secretaryActor, staffed.id, bowlerInput);

      const removedCount = await duesTeamService.removeEmptyTeams(secretaryActor, league.id);

      expect(removedCount).toBe(1);
      const remaining = await duesTeamService.listTeamsForLeague(secretaryActor, league.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe(staffed.id);
    });
  });
});
