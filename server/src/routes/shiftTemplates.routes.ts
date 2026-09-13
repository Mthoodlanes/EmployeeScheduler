/**
 * Milestone 18: HTTP port of `src/main/ipc/shiftTemplates.ipc.ts`'s 4
 * channels onto `shiftTemplateService` (Milestone 16), mounted at
 * `/api/shift-templates`. All 4 routes require `requireAuth`; the list read
 * is open to any logged-in role, the 3 writes are manager-only (enforced
 * inside `shiftTemplateService`).
 *
 * Channel -> route mapping:
 *   shiftTemplates:list       -> GET  /api/shift-templates
 *   shiftTemplates:create     -> POST /api/shift-templates
 *   shiftTemplates:update     -> PUT  /api/shift-templates/:id
 *   shiftTemplates:deactivate -> POST /api/shift-templates/:id/deactivate
 */
import { Router } from 'express';
import * as shiftTemplateService from '../services/shiftTemplateService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  optionalString,
  requireBoolean,
  requireIdParam,
  requireOneOf,
  requireOneOfOrNull,
  requireString,
  requireStringOrNull,
} from './validation.js';
import type { Department, EndAnchor, RequestingActor, StartAnchor } from '../db/domain-types.js';

const DEPARTMENTS = ['front_desk', 'cafe', 'bar', 'mechanic'] as const satisfies readonly Department[];
const START_ANCHORS = ['fixed', 'open'] as const satisfies readonly StartAnchor[];
const END_ANCHORS = ['fixed', 'close'] as const satisfies readonly EndAnchor[];

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  handleRoute((req) => shiftTemplateService.listShiftTemplates(req.actor as RequestingActor)),
);

router.post(
  '/',
  handleRoute((req) => {
    const body = bodyOf(req);
    return shiftTemplateService.createShiftTemplate(req.actor as RequestingActor, {
      department: requireOneOfOrNull(body.department, 'department', DEPARTMENTS),
      name: requireString(body.name, 'name'),
      startTime: requireStringOrNull(body.startTime, 'startTime'),
      endTime: requireStringOrNull(body.endTime, 'endTime'),
      startAnchor: requireOneOf(body.startAnchor, 'startAnchor', START_ANCHORS),
      endAnchor: requireOneOf(body.endAnchor, 'endAnchor', END_ANCHORS),
      color: optionalString(body.color, 'color'),
    });
  }, 201),
);

router.put(
  '/:id',
  handleRoute((req) => {
    const body = bodyOf(req);
    return shiftTemplateService.updateShiftTemplate(req.actor as RequestingActor, {
      id: requireIdParam(req),
      name: requireString(body.name, 'name'),
      startTime: requireStringOrNull(body.startTime, 'startTime'),
      endTime: requireStringOrNull(body.endTime, 'endTime'),
      startAnchor: requireOneOf(body.startAnchor, 'startAnchor', START_ANCHORS),
      endAnchor: requireOneOf(body.endAnchor, 'endAnchor', END_ANCHORS),
      color: requireString(body.color, 'color'),
      isActive: requireBoolean(body.isActive, 'isActive'),
    });
  }),
);

router.post(
  '/:id/deactivate',
  handleRoute((req) =>
    shiftTemplateService.deactivateShiftTemplate(
      req.actor as RequestingActor,
      requireIdParam(req),
    ),
  ),
);

export default router;
