/**
 * Milestone 18: HTTP port of `src/main/ipc/specialEvents.ipc.ts`'s 4 channels
 * onto `specialEventService` (Milestone 16), mounted at `/api/special-events`.
 * All 4 routes require `requireAuth`; the list read is open to any logged-in
 * role, the 3 writes are manager-only (enforced inside `specialEventService`).
 *
 * Channel -> route mapping:
 *   specialEvents:list   -> GET    /api/special-events
 *   specialEvents:create -> POST   /api/special-events
 *   specialEvents:update -> PUT    /api/special-events/:id
 *   specialEvents:remove -> DELETE /api/special-events/:id
 */
import { Router } from 'express';
import * as specialEventService from '../services/specialEventService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  requireBoolean,
  requireDateString,
  requireIdParam,
  requireString,
  requireStringOrNull,
} from './validation.js';
import type { RequestingActor } from '../db/domain-types.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  handleRoute(() => specialEventService.listSpecialEvents()),
);

router.post(
  '/',
  handleRoute((req) => {
    const body = bodyOf(req);
    return specialEventService.createSpecialEvent(req.actor as RequestingActor, {
      eventDate: requireDateString(body.eventDate, 'eventDate'),
      label: requireString(body.label, 'label'),
      isClosed: requireBoolean(body.isClosed, 'isClosed'),
      openTime: requireStringOrNull(body.openTime, 'openTime'),
      closeTime: requireStringOrNull(body.closeTime, 'closeTime'),
    });
  }, 201),
);

router.put(
  '/:id',
  handleRoute((req) => {
    const body = bodyOf(req);
    return specialEventService.updateSpecialEvent(req.actor as RequestingActor, {
      id: requireIdParam(req),
      eventDate: requireDateString(body.eventDate, 'eventDate'),
      label: requireString(body.label, 'label'),
      isClosed: requireBoolean(body.isClosed, 'isClosed'),
      openTime: requireStringOrNull(body.openTime, 'openTime'),
      closeTime: requireStringOrNull(body.closeTime, 'closeTime'),
    });
  }),
);

router.delete(
  '/:id',
  handleRoute(async (req) => {
    await specialEventService.removeSpecialEvent(req.actor as RequestingActor, requireIdParam(req));
    return { success: true };
  }),
);

export default router;
