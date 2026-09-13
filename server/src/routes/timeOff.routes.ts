/**
 * Milestone 18: HTTP port of `src/main/ipc/timeOff.ipc.ts`'s 6 channels onto
 * `timeOffService` (Milestone 16), mounted at `/api/time-off`. All 6 routes
 * require `requireAuth`; own-request create/list and the approved-range read
 * are open to any logged-in role, the on-behalf create, the full list, and
 * the decide action are manager-only (enforced inside `timeOffService`).
 *
 * Channel -> route mapping:
 *   timeOff:createRequest        -> POST /api/time-off
 *   timeOff:createForEmployee    -> POST /api/time-off/for-employee
 *   timeOff:listOwn              -> GET  /api/time-off/own
 *   timeOff:listAll              -> GET  /api/time-off
 *   timeOff:decide               -> POST /api/time-off/:id/decide
 *   timeOff:listApprovedForRange -> GET  /api/time-off/approved?startDate=&endDate=
 */
import { Router } from 'express';
import * as timeOffService from '../services/timeOffService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  optionalStringOrNull,
  requireDateString,
  requireIdParam,
  requireInteger,
  requireOneOf,
  requireQueryDateString,
} from './validation.js';
import type { RequestingActor } from '../db/domain-types.js';

const DECISIONS = ['approved', 'denied'] as const;

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  handleRoute((req) => {
    const body = bodyOf(req);
    return timeOffService.createOwnRequest(req.actor as RequestingActor, {
      startDate: requireDateString(body.startDate, 'startDate'),
      endDate: requireDateString(body.endDate, 'endDate'),
      reason: optionalStringOrNull(body.reason, 'reason'),
    });
  }, 201),
);

router.post(
  '/for-employee',
  handleRoute((req) => {
    const body = bodyOf(req);
    return timeOffService.createForEmployee(req.actor as RequestingActor, {
      employeeId: requireInteger(body.employeeId, 'employeeId'),
      startDate: requireDateString(body.startDate, 'startDate'),
      endDate: requireDateString(body.endDate, 'endDate'),
      reason: optionalStringOrNull(body.reason, 'reason'),
    });
  }, 201),
);

router.get(
  '/own',
  handleRoute((req) => timeOffService.listOwnRequests(req.actor as RequestingActor)),
);

router.get(
  '/',
  handleRoute((req) => timeOffService.listAllRequests(req.actor as RequestingActor)),
);

router.post(
  '/:id/decide',
  handleRoute((req) => {
    const body = bodyOf(req);
    return timeOffService.decideRequest(req.actor as RequestingActor, {
      id: requireIdParam(req),
      status: requireOneOf(body.status, 'status', DECISIONS),
      decisionNote: optionalStringOrNull(body.decisionNote, 'decisionNote'),
    });
  }),
);

router.get(
  '/approved',
  handleRoute((req) =>
    timeOffService.listApprovedForRange(
      requireQueryDateString(req, 'startDate'),
      requireQueryDateString(req, 'endDate'),
    ),
  ),
);

export default router;
