/**
 * Secretary Apps Milestone 4: HTTP API surface for the bowling dues tracker,
 * mounted at `/api/secretary`. All routes require `requireAuth`; the
 * Secretary-vs-manager-vs-tagged role check happens inside each service
 * (`assertSecretaryAccess`), mirroring how `requireManager` isn't used here
 * either — every other feature route file enforces role checks inside the
 * service, not the route.
 *
 * Route map:
 *   GET    /api/secretary/leagues
 *   POST   /api/secretary/leagues
 *   GET    /api/secretary/leagues/:id
 *   PUT    /api/secretary/leagues/:id
 *   DELETE /api/secretary/leagues/:id
 *
 *   GET    /api/secretary/leagues/:leagueId/teams
 *   POST   /api/secretary/leagues/:leagueId/teams
 *   POST   /api/secretary/leagues/:leagueId/teams/remove-empty
 *   PUT    /api/secretary/teams/:id
 *   DELETE /api/secretary/teams/:id
 *
 *   GET    /api/secretary/teams/:teamId/bowlers
 *   POST   /api/secretary/teams/:teamId/bowlers
 *   PUT    /api/secretary/bowlers/:id
 *   DELETE /api/secretary/bowlers/:id
 *
 *   GET    /api/secretary/leagues/:leagueId/weekly-entries
 *   PUT    /api/secretary/bowlers/:bowlerId/weekly-entries/:week
 *   DELETE /api/secretary/bowlers/:bowlerId/weekly-entries/:week
 */
import { Router, type Request } from 'express';
import * as leagueService from '../services/leagueService.js';
import * as duesTeamService from '../services/duesTeamService.js';
import * as bowlerService from '../services/bowlerService.js';
import * as weeklyEntryService from '../services/weeklyEntryService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  requireBoolean,
  requireIdParam,
  requireInteger,
  requireNumber,
  requireOneOf,
  requireString,
} from './validation.js';
import type { RequestingActor } from '../db/domain-types.js';

const router = Router();

router.use(requireAuth);

function actorOf(req: Request): RequestingActor {
  return req.actor as RequestingActor;
}

// ---------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------

router.get(
  '/leagues',
  handleRoute((req) => leagueService.listLeagues(actorOf(req))),
);

router.get(
  '/leagues/:id',
  handleRoute((req) => leagueService.getLeague(actorOf(req), requireIdParam(req))),
);

function leagueInputFromBody(body: Record<string, unknown>): leagueService.LeagueInput {
  return {
    name: requireString(body.name, 'name'),
    spotsPerTeam: requireInteger(body.spotsPerTeam, 'spotsPerTeam'),
    numWeeks: requireInteger(body.numWeeks, 'numWeeks'),
    currentWeek: requireInteger(body.currentWeek, 'currentWeek'),
    prizeFund: requireNumber(body.prizeFund, 'prizeFund'),
    lineage: requireNumber(body.lineage, 'lineage'),
    sweeperActive: requireBoolean(body.sweeperActive, 'sweeperActive'),
    sweeperAmount: requireNumber(body.sweeperAmount, 'sweeperAmount'),
    vacancyFee: requireNumber(body.vacancyFee, 'vacancyFee'),
    lineageDiscountAmount: requireNumber(body.lineageDiscountAmount, 'lineageDiscountAmount'),
    prizeFundDiscountAmount: requireNumber(
      body.prizeFundDiscountAmount,
      'prizeFundDiscountAmount',
    ),
    sponsorFeePerTeam: requireNumber(body.sponsorFeePerTeam, 'sponsorFeePerTeam'),
    sponsorFeeActive: requireBoolean(body.sponsorFeeActive, 'sponsorFeeActive'),
    depositFeeActive: requireBoolean(body.depositFeeActive, 'depositFeeActive'),
    depositFeeAmount: requireNumber(body.depositFeeAmount, 'depositFeeAmount'),
    sponsorFeeDueWeek: requireInteger(body.sponsorFeeDueWeek, 'sponsorFeeDueWeek'),
    prizeFundCoverChargeDueWeek: requireInteger(
      body.prizeFundCoverChargeDueWeek,
      'prizeFundCoverChargeDueWeek',
    ),
    lastTwoWeeksDueWeek: requireInteger(body.lastTwoWeeksDueWeek, 'lastTwoWeeksDueWeek'),
    sanctionedLeague: requireBoolean(body.sanctionedLeague, 'sanctionedLeague'),
  };
}

router.post(
  '/leagues',
  handleRoute(
    (req) => leagueService.createLeague(actorOf(req), leagueInputFromBody(bodyOf(req))),
    201,
  ),
);

router.put(
  '/leagues/:id',
  handleRoute((req) =>
    leagueService.updateLeague(actorOf(req), requireIdParam(req), leagueInputFromBody(bodyOf(req))),
  ),
);

router.delete(
  '/leagues/:id',
  handleRoute(async (req) => {
    await leagueService.removeLeague(actorOf(req), requireIdParam(req));
    return { success: true };
  }),
);

// ---------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------

router.get(
  '/leagues/:leagueId/teams',
  handleRoute((req) =>
    duesTeamService.listTeamsForLeague(actorOf(req), requireIdParam(req, 'leagueId')),
  ),
);

function teamInputFromBody(body: Record<string, unknown>): duesTeamService.DuesTeamInput {
  return {
    name: requireString(body.name, 'name'),
    folded: requireBoolean(body.folded, 'folded'),
    sponsorPaid: requireNumber(body.sponsorPaid, 'sponsorPaid'),
  };
}

router.post(
  '/leagues/:leagueId/teams',
  handleRoute(
    (req) =>
      duesTeamService.createTeam(
        actorOf(req),
        requireIdParam(req, 'leagueId'),
        teamInputFromBody(bodyOf(req)),
      ),
    201,
  ),
);

router.post(
  '/leagues/:leagueId/teams/remove-empty',
  handleRoute(async (req) => {
    const removedCount = await duesTeamService.removeEmptyTeams(
      actorOf(req),
      requireIdParam(req, 'leagueId'),
    );
    return { removedCount };
  }),
);

router.put(
  '/teams/:id',
  handleRoute((req) =>
    duesTeamService.updateTeam(actorOf(req), requireIdParam(req), teamInputFromBody(bodyOf(req))),
  ),
);

router.delete(
  '/teams/:id',
  handleRoute(async (req) => {
    await duesTeamService.removeTeam(actorOf(req), requireIdParam(req));
    return { success: true };
  }),
);

// ---------------------------------------------------------------------
// Bowlers
// ---------------------------------------------------------------------

router.get(
  '/teams/:teamId/bowlers',
  handleRoute((req) => bowlerService.listBowlersForTeam(actorOf(req), requireIdParam(req, 'teamId'))),
);

const BOWLER_STATUSES = ['active', 'left'] as const;

function bowlerInputFromBody(body: Record<string, unknown>): bowlerService.BowlerInput {
  return {
    name: requireString(body.name, 'name'),
    status: requireOneOf(body.status, 'status', BOWLER_STATUSES),
    phone: typeof body.phone === 'string' ? body.phone : '',
    lineageDiscount: requireBoolean(body.lineageDiscount, 'lineageDiscount'),
    prizeFundDiscount: requireBoolean(body.prizeFundDiscount, 'prizeFundDiscount'),
    dropNoticeWeek: typeof body.dropNoticeWeek === 'string' ? body.dropNoticeWeek : '',
    notes: typeof body.notes === 'string' ? body.notes : '',
    depositPaid: requireNumber(body.depositPaid, 'depositPaid'),
    depositOptOut: requireBoolean(body.depositOptOut, 'depositOptOut'),
    usbcCardPaid: requireBoolean(body.usbcCardPaid, 'usbcCardPaid'),
  };
}

router.post(
  '/teams/:teamId/bowlers',
  handleRoute(
    (req) =>
      bowlerService.createBowler(
        actorOf(req),
        requireIdParam(req, 'teamId'),
        bowlerInputFromBody(bodyOf(req)),
      ),
    201,
  ),
);

router.put(
  '/bowlers/:id',
  handleRoute((req) =>
    bowlerService.updateBowler(actorOf(req), requireIdParam(req), bowlerInputFromBody(bodyOf(req))),
  ),
);

router.delete(
  '/bowlers/:id',
  handleRoute(async (req) => {
    await bowlerService.removeBowler(actorOf(req), requireIdParam(req));
    return { success: true };
  }),
);

// ---------------------------------------------------------------------
// Weekly entries
// ---------------------------------------------------------------------

router.get(
  '/leagues/:leagueId/weekly-entries',
  handleRoute((req) =>
    weeklyEntryService.listEntriesForLeague(actorOf(req), requireIdParam(req, 'leagueId')),
  ),
);

router.put(
  '/bowlers/:bowlerId/weekly-entries/:week',
  handleRoute((req) => {
    const body = bodyOf(req);
    return weeklyEntryService.recordAmount(
      actorOf(req),
      requireIdParam(req, 'bowlerId'),
      requireIdParam(req, 'week'),
      requireNumber(body.amountPaid, 'amountPaid'),
    );
  }),
);

router.delete(
  '/bowlers/:bowlerId/weekly-entries/:week',
  handleRoute(async (req) => {
    await weeklyEntryService.removeEntry(
      actorOf(req),
      requireIdParam(req, 'bowlerId'),
      requireIdParam(req, 'week'),
    );
    return { success: true };
  }),
);

export default router;
