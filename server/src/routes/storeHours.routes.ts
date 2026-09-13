/**
 * Milestone 18: HTTP port of `src/main/ipc/storeHours.ipc.ts`'s 2 channels
 * onto `storeHoursService` (Milestone 16), mounted at `/api/store-hours`.
 * Both routes require `requireAuth`; the read is open to any logged-in role,
 * the write is manager-only (enforced inside `storeHoursService`).
 *
 * `dayOfWeek` is taken from the URL (rather than the body) since `upsert` is
 * keyed on it — one row per day-of-week, 0 (Sunday) - 6 (Saturday) — matching
 * REST's "PUT replaces the resource at this URL" convention.
 *
 * Channel -> route mapping:
 *   storeHours:list   -> GET /api/store-hours
 *   storeHours:upsert -> PUT /api/store-hours/:dayOfWeek
 */
import { Router } from 'express';
import * as storeHoursService from '../services/storeHoursService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import { bodyOf, requireBoolean, requireDayOfWeekParam, requireStringOrNull } from './validation.js';
import type { RequestingActor } from '../db/domain-types.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  handleRoute(() => storeHoursService.listStoreHours()),
);

router.put(
  '/:dayOfWeek',
  handleRoute((req) => {
    const body = bodyOf(req);
    return storeHoursService.upsertStoreHours(req.actor as RequestingActor, {
      dayOfWeek: requireDayOfWeekParam(req),
      openTime: requireStringOrNull(body.openTime, 'openTime'),
      closeTime: requireStringOrNull(body.closeTime, 'closeTime'),
      isClosed: requireBoolean(body.isClosed, 'isClosed'),
    });
  }),
);

export default router;
