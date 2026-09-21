import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as leagueService from '../../../../server/src/services/leagueService.js';
import * as duesTeamService from '../../../../server/src/services/duesTeamService.js';
import * as bowlerService from '../../../../server/src/services/bowlerService.js';
import * as weeklyEntryService from '../../../../server/src/services/weeklyEntryService.js';
import { UnauthorizedWeeklyEntryActionError } from '../../../../server/src/services/weeklyEntryService.js';
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

async function makeBowler() {
  const league = await leagueService.createLeague(secretaryActor, leagueInput);
  const team = await duesTeamService.createTeam(secretaryActor, league.id, teamInput);
  const bowler = await bowlerService.createBowler(secretaryActor, team.id, bowlerInput);
  return { league, team, bowler };
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

describe('weeklyEntryService', () => {
  describe('recordAmount', () => {
    it('records a new weekly payment', async () => {
      const { bowler } = await makeBowler();
      const entry = await weeklyEntryService.recordAmount(secretaryActor, bowler.id, 1, 5.5);
      expect(entry.week).toBe(1);
      expect(entry.amountPaid).toBe(5.5);
    });

    it('overwrites an existing week rather than duplicating it', async () => {
      const { bowler } = await makeBowler();
      await weeklyEntryService.recordAmount(secretaryActor, bowler.id, 1, 5.5);
      const corrected = await weeklyEntryService.recordAmount(secretaryActor, bowler.id, 1, 6);

      const entries = await weeklyEntryService.listEntriesForBowlers(secretaryActor, [bowler.id]);
      expect(entries).toHaveLength(1);
      expect(corrected.amountPaid).toBe(6);
    });

    it('refuses a plain employee', async () => {
      const { bowler } = await makeBowler();
      await expect(
        weeklyEntryService.recordAmount(employeeActor, bowler.id, 1, 5),
      ).rejects.toThrow(UnauthorizedWeeklyEntryActionError);
    });

    it('rejects a negative amount', async () => {
      const { bowler } = await makeBowler();
      await expect(
        weeklyEntryService.recordAmount(secretaryActor, bowler.id, 1, -5),
      ).rejects.toThrow();
    });

    it('rejects a week below 1', async () => {
      const { bowler } = await makeBowler();
      await expect(
        weeklyEntryService.recordAmount(secretaryActor, bowler.id, 0, 5),
      ).rejects.toThrow();
    });

    it('throws when the bowler does not exist', async () => {
      await expect(
        weeklyEntryService.recordAmount(secretaryActor, 999999, 1, 5),
      ).rejects.toThrow();
    });
  });

  describe('listEntriesForLeague', () => {
    it('gathers every entry across every team/bowler in a league', async () => {
      const { league, team, bowler } = await makeBowler();
      const otherBowler = await bowlerService.createBowler(secretaryActor, team.id, {
        ...bowlerInput,
        name: 'Donny Kerabatsos',
      });
      await weeklyEntryService.recordAmount(secretaryActor, bowler.id, 1, 5);
      await weeklyEntryService.recordAmount(secretaryActor, otherBowler.id, 1, 7.5);

      const entries = await weeklyEntryService.listEntriesForLeague(secretaryActor, league.id);
      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.amountPaid).sort()).toEqual([5, 7.5]);
    });
  });

  describe('removeEntry', () => {
    it('removes a recorded entry', async () => {
      const { bowler } = await makeBowler();
      await weeklyEntryService.recordAmount(secretaryActor, bowler.id, 1, 5);
      await weeklyEntryService.removeEntry(secretaryActor, bowler.id, 1);
      expect(
        await weeklyEntryService.listEntriesForBowlers(secretaryActor, [bowler.id]),
      ).toHaveLength(0);
    });
  });
});
