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
 */
import { Router } from 'express';
import * as employeeService from '../services/employeeService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import {
  bodyOf,
  optionalString,
  requireArrayOf,
  requireBoolean,
  requireIdParam,
  requireOneOf,
  requireString,
} from './validation.js';
import type { Department, RequestingActor, Role } from '../db/domain-types.js';

const DEPARTMENTS = ['front_desk', 'cafe', 'bar'] as const satisfies readonly Department[];
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
