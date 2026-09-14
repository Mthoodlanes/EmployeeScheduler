/**
 * Milestone 16: port of `src/main/services/employeeService.ts` onto the new
 * Drizzle `employeeRepo` (Milestone 15), RETROFITTED with a
 * `RequestingActor` parameter — this is one of the 3 services (along with
 * `shiftTemplateService`/`scheduledShiftService`) whose authorization
 * checks originally lived only at the IPC-handler layer
 * (`src/main/ipc/employees.ipc.ts`'s `requireLoggedIn()`/`requireManager()`),
 * since there is no Electron IPC layer in this hosted backend for those
 * checks to live in any more.
 *
 * Original IPC-layer checks being moved in here (see
 * `src/main/ipc/employees.ipc.ts`):
 *   - `employeesList`          -> requireLoggedIn()   -> listEmployees(actor)
 *   - `employeesCreate`        -> requireManager()    -> createEmployee(actor, input)
 *   - `employeesUpdate`        -> requireManager()    -> updateEmployee(actor, input)
 *   - `employeesDeactivate`    -> requireManager()    -> deactivateEmployee(actor, id)
 *   - `employeesSetDepartments`-> requireManager()    -> setEmployeeDepartments(actor, id, departments)
 *
 * `requireLoggedIn()` merely checked a session existed with no role check;
 * at the service layer that is represented by simply requiring a
 * `RequestingActor` argument (any authenticated caller has one — enforced by
 * the type system here, and in Milestone 17 by the JWT middleware that
 * populates `req.actor` before a route can call into this service).
 * `requireManager()` becomes the same `assertManager(actor)`-style check
 * `preferenceService`/`storeHoursService`/`specialEventService`/
 * `timeOffService`/`unavailabilityService` already use, for authorization
 * signature consistency across all 9 services.
 */
import * as employeeRepo from '../db/repositories/employeeRepo.js';
import { hashPassword, InvalidCredentialsError, verifyPassword } from './authService.js';
import type { Department, RequestingActor, Role } from '../db/domain-types.js';
import type { EmployeeWithDepartmentsRow } from '../db/repositories/employeeRepo.js';

export type { RequestingActor };

export class DuplicateUsernameError extends Error {
  constructor(username: string) {
    super(`Username "${username}" is already taken`);
    this.name = 'DuplicateUsernameError';
  }
}

export class UnauthorizedEmployeeActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedEmployeeActionError';
  }
}

function assertManager(actor: RequestingActor): void {
  if (actor.role !== 'manager') {
    throw new UnauthorizedEmployeeActionError('Only managers can manage employees');
  }
}

/**
 * Postgres reports a unique-constraint violation as SQLSTATE `23505`
 * (`unique_violation`), unlike the original SQLite check for
 * `error.code === 'SQLITE_CONSTRAINT_UNIQUE'`. Drizzle wraps the underlying
 * `postgres` driver's `PostgresError` (which carries `.code`) in its own
 * `DrizzleQueryError`, with the original error attached as `.cause` rather
 * than surfacing `.code` directly — confirmed by throwing a real duplicate
 * username at `employeeRepo.create` in the Milestone 16 verification
 * script, which caught this wrapping only by inspecting a live error. This
 * checks both the error's own `.code` and its `.cause.code` so the check
 * doesn't silently break if a future Drizzle version stops wrapping.
 */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return (error as { code?: string }).code;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (errorCode(error) === '23505') {
    return true;
  }
  const cause = typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : undefined;
  return errorCode(cause) === '23505';
}

export interface CreateEmployeeInput {
  name: string;
  username: string;
  password: string;
  role: Role;
  isSalaried: boolean;
  departments: Department[];
}

/**
 * Any logged-in user may list employees — the schedule board needs this
 * regardless of who is viewing it. `actor` is still required (rather than
 * dropped) so the function's authorization signature stays uniform with the
 * other 8 services and with a valid `RequestingActor` remaining the
 * precondition for calling any employeeService function at all — it is
 * unused here only because there is no per-role branching on a plain read.
 */
export async function listEmployees(
  _actor: RequestingActor,
): Promise<EmployeeWithDepartmentsRow[]> {
  return employeeRepo.listAll();
}

/** Only a manager may create a new employee account. */
export async function createEmployee(
  actor: RequestingActor,
  input: CreateEmployeeInput,
): Promise<EmployeeWithDepartmentsRow> {
  assertManager(actor);
  // Proactive case-insensitive check: the DB's UNIQUE constraint on
  // `username` is case-sensitive, so "Doug" and "doug" wouldn't collide at
  // that layer even though findByUsername (used for sign-in) now treats them
  // as the same account. Catch it here instead of letting a case-variant
  // duplicate slip in and become unreachable/ambiguous at login.
  if (await employeeRepo.findByUsername(input.username)) {
    throw new DuplicateUsernameError(input.username);
  }
  try {
    return await employeeRepo.create({
      name: input.name,
      username: input.username,
      passwordHash: hashPassword(input.password),
      role: input.role,
      isSalaried: input.isSalaried,
      departments: input.departments,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateUsernameError(input.username);
    }
    throw error;
  }
}

export interface UpdateEmployeeInput {
  id: number;
  name: string;
  role: Role;
  isSalaried: boolean;
  isActive: boolean;
  password?: string;
}

/** Only a manager may edit an employee's details. */
export async function updateEmployee(
  actor: RequestingActor,
  input: UpdateEmployeeInput,
): Promise<EmployeeWithDepartmentsRow> {
  assertManager(actor);
  return employeeRepo.update({
    id: input.id,
    name: input.name,
    role: input.role,
    isSalaried: input.isSalaried,
    isActive: input.isActive,
    passwordHash: input.password ? hashPassword(input.password) : undefined,
  });
}

/**
 * Only a manager may deactivate an employee. Also revokes any session the
 * deactivated employee is currently holding (see `session_version` in
 * schema.ts) — otherwise a deactivated employee who's still logged in on a
 * shared computer would keep their access until that token's 7-day expiry.
 */
export async function deactivateEmployee(
  actor: RequestingActor,
  id: number,
): Promise<EmployeeWithDepartmentsRow> {
  assertManager(actor);
  const result = await employeeRepo.deactivate(id);
  await employeeRepo.incrementSessionVersion(id);
  return result;
}

/** Only a manager may change which departments an employee can work. */
export async function setEmployeeDepartments(
  actor: RequestingActor,
  id: number,
  departments: Department[],
): Promise<EmployeeWithDepartmentsRow> {
  assertManager(actor);
  return employeeRepo.setDepartments(id, departments);
}

/** Only a manager may reorder the Schedule Board's employee rows. */
export async function reorderEmployees(
  actor: RequestingActor,
  orderedIds: number[],
): Promise<EmployeeWithDepartmentsRow[]> {
  assertManager(actor);
  return employeeRepo.reorder(orderedIds);
}

export interface UpdateOwnProfileInput {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Self-service counterpart to `updateEmployee` — any authenticated actor may
 * call this for THEMSELVES (no `assertManager`), and it acts on `actor.id`
 * rather than an arbitrary target id from the request body. Deliberately
 * narrower than the manager-only path above: it can never touch
 * role/departments/isSalaried/isActive.
 *
 * Changing the password additionally requires the caller to submit their
 * CURRENT password, verified via bcrypt against the stored hash, before the
 * new one is accepted — this app runs on a shared store computer as well as
 * personal phones, so a session left open must not let someone walk up and
 * silently take over the account by just typing a new password. Reuses
 * `InvalidCredentialsError` from authService (rather than a new error class,
 * which would push this file over the repo's `max-classes-per-file: 2` lint
 * rule) for both "no current password supplied" and "current password
 * doesn't match" — from the caller's perspective both are simply "you didn't
 * prove you're still you".
 */
export async function updateOwnProfile(
  actor: RequestingActor,
  input: UpdateOwnProfileInput,
): Promise<EmployeeWithDepartmentsRow> {
  let passwordHash: string | undefined;
  if (input.newPassword !== undefined) {
    const current = await employeeRepo.findById(actor.id);
    if (
      !current ||
      !input.currentPassword ||
      !verifyPassword(input.currentPassword, current.passwordHash)
    ) {
      throw new InvalidCredentialsError();
    }
    passwordHash = hashPassword(input.newPassword);
  }

  return employeeRepo.updateOwnProfile({
    id: actor.id,
    name: input.name,
    passwordHash,
  });
}
