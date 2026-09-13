/**
 * Milestone 18: HTTP port of `src/main/ipc/unavailability.ipc.ts`'s 6
 * channels onto `unavailabilityService` (Milestone 16), mounted at
 * `/api/unavailability`. All 6 routes require `requireAuth`; own-request
 * create/list and the approved-all read are open to any logged-in role, the
 * on-behalf create, the full list, and the decide action are manager-only
 * (enforced inside `unavailabilityService`).
 *
 * Channel -> route mapping:
 *   unavailability:createOwnRequest   -> POST /api/unavailability
 *   unavailability:createForEmployee  -> POST /api/unavailability/for-employee
 *   unavailability:listOwn            -> GET  /api/unavailability/own
 *   unavailability:listAll            -> GET  /api/unavailability
 *   unavailability:listApprovedAll    -> GET  /api/unavailability/approved
 *   unavailability:decide             -> POST /api/unavailability/:id/decide
 */
import { Router } from 'express';
import * as unavailabilityService from '../services/unavailabilityService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  optionalStringOrNull,
  requireIdParam,
  requireInteger,
  requireOneOf,
  requireString,
} from './validation.js';
import type { RequestingActor } from '../db/domain-types.js';

const DECISIONS = ['approved', 'denied'] as const;

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  handleRoute((req) => {
    const body = bodyOf(req);
    return unavailabilityService.createOwnRequest(req.actor as RequestingActor, {
      dayOfWeek: requireInteger(body.dayOfWeek, 'dayOfWeek'),
      startTime: requireString(body.startTime, 'startTime'),
      endTime: requireString(body.endTime, 'endTime'),
      reason: optionalStringOrNull(body.reason, 'reason'),
    });
  }, 201),
);

router.post(
  '/for-employee',
  handleRoute((req) => {
    const body = bodyOf(req);
    return unavailabilityService.createForEmployee(req.actor as RequestingActor, {
      employeeId: requireInteger(body.employeeId, 'employeeId'),
      dayOfWeek: requireInteger(body.dayOfWeek, 'dayOfWeek'),
      startTime: requireString(body.startTime, 'startTime'),
      endTime: requireString(body.endTime, 'endTime'),
      reason: optionalStringOrNull(body.reason, 'reason'),
    });
  }, 201),
);

router.get(
  '/own',
  handleRoute((req) => unavailabilityService.listOwnRequests(req.actor as RequestingActor)),
);

router.get(
  '/',
  handleRoute((req) => unavailabilityService.listAllRequests(req.actor as RequestingActor)),
);

router.get(
  '/approved',
  handleRoute(() => unavailabilityService.listApprovedAll()),
);

router.post(
  '/:id/decide',
  handleRoute((req) => {
    const body = bodyOf(req);
    return unavailabilityService.decideRequest(req.actor as RequestingActor, {
      id: requireIdParam(req),
      status: requireOneOf(body.status, 'status', DECISIONS),
      decisionNote: optionalStringOrNull(body.decisionNote, 'decisionNote'),
    });
  }),
);

export default router;
