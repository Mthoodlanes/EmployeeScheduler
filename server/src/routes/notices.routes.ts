/**
 * Milestone 26: HTTP routes for the notice board, mounted at `/api/notices`.
 * All routes require `requireAuth`; reads (list, unread status) and
 * mark-read are open to any logged-in role, the 3 writes are
 * manager-or-coordinator-only (enforced inside `noticeService`).
 */
import { Router } from 'express';
import * as noticeService from '../services/noticeService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import { bodyOf, nullableDateString, requireIdParam, requireString } from './validation.js';
import type { RequestingActor } from '../db/domain-types.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  handleRoute(() => noticeService.listNotices()),
);

router.get(
  '/unread-status',
  handleRoute(async (req) => ({
    hasUnread: await noticeService.hasUnreadNotices(req.actor as RequestingActor),
  })),
);

router.post(
  '/mark-read',
  handleRoute(async (req) => {
    await noticeService.markNoticesRead(req.actor as RequestingActor);
    return { success: true };
  }),
);

router.post(
  '/',
  handleRoute((req) => {
    const body = bodyOf(req);
    return noticeService.createNotice(req.actor as RequestingActor, {
      title: requireString(body.title, 'title'),
      body: requireString(body.body, 'body'),
      expiresAt: nullableDateString(body.expiresAt, 'expiresAt'),
    });
  }, 201),
);

router.put(
  '/:id',
  handleRoute((req) => {
    const body = bodyOf(req);
    return noticeService.updateNotice(req.actor as RequestingActor, {
      id: requireIdParam(req),
      title: requireString(body.title, 'title'),
      body: requireString(body.body, 'body'),
      expiresAt: nullableDateString(body.expiresAt, 'expiresAt'),
    });
  }),
);

router.delete(
  '/:id',
  handleRoute(async (req) => {
    await noticeService.removeNotice(req.actor as RequestingActor, requireIdParam(req));
    return { success: true };
  }),
);

export default router;
