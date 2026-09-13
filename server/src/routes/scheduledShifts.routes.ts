/**
 * Milestone 18: HTTP port of `src/main/ipc/scheduledShifts.ipc.ts`'s 5
 * channels onto `scheduledShiftService` (Milestone 16), mounted at
 * `/api/scheduled-shifts`. All 5 routes require `requireAuth`; the week read
 * is open to any logged-in role, the 4 writes are manager-only (enforced
 * inside `scheduledShiftService`).
 *
 * Channel -> route mapping:
 *   scheduledShifts:listWeek       -> GET    /api/scheduled-shifts?department=&weekStart=
 *   scheduledShifts:assignTemplate -> POST   /api/scheduled-shifts/assign-template
 *   scheduledShifts:assignCustom   -> POST   /api/scheduled-shifts/assign-custom
 *   scheduledShifts:override       -> PUT    /api/scheduled-shifts/:id
 *   scheduledShifts:remove         -> DELETE /api/scheduled-shifts/:id
 */
import { Router } from 'express';
import * as scheduledShiftService from '../services/scheduledShiftService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  nullableString,
  optionalStringOrNull,
  requireDateString,
  requireIdParam,
  requireInteger,
  requireOneOf,
  requireQueryDateString,
  requireQueryOneOf,
  requireString,
} from './validation.js';
import type { Department, EndAnchor, RequestingActor, StartAnchor } from '../db/domain-types.js';

const DEPARTMENTS = ['front_desk', 'cafe', 'bar'] as const satisfies readonly Department[];
const START_ANCHORS = ['fixed', 'open'] as const satisfies readonly StartAnchor[];
const END_ANCHORS = ['fixed', 'close'] as const satisfies readonly EndAnchor[];

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  handleRoute((req) =>
    scheduledShiftService.listWeek(
      req.actor as RequestingActor,
      requireQueryOneOf(req, 'department', DEPARTMENTS),
      requireQueryDateString(req, 'weekStart'),
    ),
  ),
);

router.post(
  '/assign-template',
  handleRoute((req) => {
    const body = bodyOf(req);
    return scheduledShiftService.assignTemplate(req.actor as RequestingActor, {
      employeeId: requireInteger(body.employeeId, 'employeeId'),
      department: requireOneOf(body.department, 'department', DEPARTMENTS),
      shiftDate: requireDateString(body.shiftDate, 'shiftDate'),
      templateId: requireInteger(body.templateId, 'templateId'),
    });
  }, 201),
);

router.post(
  '/assign-custom',
  handleRoute((req) => {
    const body = bodyOf(req);
    return scheduledShiftService.assignCustomShift(req.actor as RequestingActor, {
      employeeId: requireInteger(body.employeeId, 'employeeId'),
      department: requireOneOf(body.department, 'department', DEPARTMENTS),
      shiftDate: requireDateString(body.shiftDate, 'shiftDate'),
      startAnchor: requireOneOf(body.startAnchor, 'startAnchor', START_ANCHORS),
      startTime: nullableString(body.startTime, 'startTime'),
      endAnchor: requireOneOf(body.endAnchor, 'endAnchor', END_ANCHORS),
      endTime: nullableString(body.endTime, 'endTime'),
      notes: optionalStringOrNull(body.notes, 'notes'),
    });
  }, 201),
);

router.put(
  '/:id',
  handleRoute((req) => {
    const body = bodyOf(req);
    return scheduledShiftService.overrideShift(req.actor as RequestingActor, {
      id: requireIdParam(req),
      startTime: requireString(body.startTime, 'startTime'),
      endTime: requireString(body.endTime, 'endTime'),
      notes: optionalStringOrNull(body.notes, 'notes'),
    });
  }),
);

router.delete(
  '/:id',
  handleRoute(async (req) => {
    await scheduledShiftService.removeShift(req.actor as RequestingActor, requireIdParam(req));
    return { success: true };
  }),
);

export default router;
