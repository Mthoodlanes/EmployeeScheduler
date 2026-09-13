/**
 * Milestone 18: HTTP port of `src/main/ipc/employees.ipc.ts`'s 5 channels
 * onto `employeeService` (Milestone 16), mounted at `/api/employees` in
 * `server/src/index.ts`. All 5 routes require `requireAuth`; only the list
 * read is open to any logged-in role, the 4 writes are manager-only
 * (enforced inside `employeeService` itself via `assertManager`).
 *
 * Channel -> route mapping:
 *   employees:list           -> GET    /api/employees
 *   employees:create         -> POST   /api/employees
 *   employees:update         -> PUT    /api/employees/:id
 *   employees:deactivate     -> POST   /api/employees/:id/deactivate
 *   employees:setDepartments -> PUT    /api/employees/:id/departments
 *
 * Plus a new, additional self-service route (no IPC-channel precursor —
 * ported the other direction, IPC channel added alongside this route, see
 * `src/main/ipc/employees.ipc.ts`'s `employees:updateOwnProfile`):
 *   PUT /api/employees/me -> employeeService.updateOwnProfile(actor, ...)
 *   Any authenticated actor may call this for THEMSELVES (no `assertManager`
 *   — enforced by acting on `actor.id`, never a body/param-supplied id).
 *
 * Plus one more additional manager-only route, backing the Schedule Board's
 * persistent drag-and-drop employee reordering feature (no IPC-channel
 * precursor at first; the IPC channel was added alongside this route, see
 * `src/main/ipc/employees.ipc.ts`'s `employees:reorder`):
 *   PUT /api/employees/reorder -> employeeService.reorderEmployees(actor, ...)
 */
import { Router } from 'express';
import * as employeeService from '../services/employeeService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  optionalString,
  requireArrayOf,
  requireArrayOfIntegers,
  requireBoolean,
  requireIdParam,
  requireOneOf,
  requireString,
} from './validation.js';
import type { Department, RequestingActor, Role } from '../db/domain-types.js';

const DEPARTMENTS = ['front_desk', 'cafe', 'bar', 'mechanic'] as const satisfies readonly Department[];
const ROLES = ['manager', 'employee'] as const satisfies readonly Role[];

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  handleRoute((req) => employeeService.listEmployees(req.actor as RequestingActor)),
);

router.post(
  '/',
  handleRoute((req) => {
    const body = bodyOf(req);
    return employeeService.createEmployee(req.actor as RequestingActor, {
      name: requireString(body.name, 'name'),
      username: requireString(body.username, 'username'),
      password: requireString(body.password, 'password'),
      role: requireOneOf(body.role, 'role', ROLES),
      isSalaried: requireBoolean(body.isSalaried, 'isSalaried'),
      departments: requireArrayOf(body.departments, 'departments', DEPARTMENTS),
    });
  }, 201),
);

// Registered BEFORE `/:id` — Express matches routes in registration order,
// and `/:id`'s `requireIdParam` would otherwise try (and fail) to parse the
// literal segment "me" as a numeric id.
router.put(
  '/me',
  handleRoute((req) => {
    const body = bodyOf(req);
    return employeeService.updateOwnProfile(req.actor as RequestingActor, {
      name: optionalString(body.name, 'name'),
      currentPassword: optionalString(body.currentPassword, 'currentPassword'),
      newPassword: optionalString(body.newPassword, 'newPassword'),
    });
  }),
);

// Registered BEFORE `/:id` for the same reason `/me` is — `requireIdParam`
// would otherwise try (and fail) to parse the literal segment "reorder" as a
// numeric id.
router.put(
  '/reorder',
  handleRoute((req) => {
    const body = bodyOf(req);
    return employeeService.reorderEmployees(
      req.actor as RequestingActor,
      requireArrayOfIntegers(body.orderedIds, 'orderedIds'),
    );
  }),
);

router.put(
  '/:id',
  handleRoute((req) => {
    const body = bodyOf(req);
    return employeeService.updateEmployee(req.actor as RequestingActor, {
      id: requireIdParam(req),
      name: requireString(body.name, 'name'),
      role: requireOneOf(body.role, 'role', ROLES),
      isSalaried: requireBoolean(body.isSalaried, 'isSalaried'),
      isActive: requireBoolean(body.isActive, 'isActive'),
      password: optionalString(body.password, 'password'),
    });
  }),
);

router.post(
  '/:id/deactivate',
  handleRoute((req) =>
    employeeService.deactivateEmployee(req.actor as RequestingActor, requireIdParam(req)),
  ),
);

router.put(
  '/:id/departments',
  handleRoute((req) => {
    const body = bodyOf(req);
    return employeeService.setEmployeeDepartments(
      req.actor as RequestingActor,
      requireIdParam(req),
      requireArrayOf(body.departments, 'departments', DEPARTMENTS),
    );
  }),
);

export default router;
