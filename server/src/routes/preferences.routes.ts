/**
 * Milestone 18: HTTP port of `src/main/ipc/preferences.ipc.ts`'s 5 channels
 * onto `preferenceService` (Milestone 16), mounted at `/api/preferences`.
 * All 5 routes require `requireAuth`; the two reads are open to any
 * logged-in role, the 3 writes are manager-only (enforced inside
 * `preferenceService`).
 *
 * Channel -> route mapping:
 *   preferences:listAll          -> GET    /api/preferences
 *   preferences:listForEmployee  -> GET    /api/preferences/employee/:employeeId
 *   preferences:create           -> POST   /api/preferences
 *   preferences:update           -> PUT    /api/preferences/:id
 *   preferences:remove           -> DELETE /api/preferences/:id
 */
import { Router } from 'express';
import * as preferenceService from '../services/preferenceService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  optionalStringOrNull,
  requireIdParam,
  requireInteger,
  requireString,
} from './validation.js';
import type { RequestingActor } from '../db/domain-types.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  handleRoute(() => preferenceService.listAllPreferences()),
);

router.get(
  '/employee/:employeeId',
  handleRoute((req) =>
    preferenceService.listPreferencesForEmployee(requireIdParam(req, 'employeeId')),
  ),
);

router.post(
  '/',
  handleRoute((req) => {
    const body = bodyOf(req);
    return preferenceService.createPreference(req.actor as RequestingActor, {
      employeeId: requireInteger(body.employeeId, 'employeeId'),
      dayOfWeek: requireInteger(body.dayOfWeek, 'dayOfWeek'),
      preferredStartTime: requireString(body.preferredStartTime, 'preferredStartTime'),
      preferredEndTime: requireString(body.preferredEndTime, 'preferredEndTime'),
      note: optionalStringOrNull(body.note, 'note'),
    });
  }, 201),
);

router.put(
  '/:id',
  handleRoute((req) => {
    const body = bodyOf(req);
    return preferenceService.updatePreference(req.actor as RequestingActor, {
      id: requireIdParam(req),
      dayOfWeek: requireInteger(body.dayOfWeek, 'dayOfWeek'),
      preferredStartTime: requireString(body.preferredStartTime, 'preferredStartTime'),
      preferredEndTime: requireString(body.preferredEndTime, 'preferredEndTime'),
      note: optionalStringOrNull(body.note, 'note'),
    });
  }),
);

router.delete(
  '/:id',
  handleRoute(async (req) => {
    await preferenceService.removePreference(req.actor as RequestingActor, requireIdParam(req));
    return { success: true };
  }),
);

export default router;
