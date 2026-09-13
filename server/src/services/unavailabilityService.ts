/**
 * Milestone 16: port of `src/main/services/unavailabilityService.ts` onto
 * the new Drizzle `unavailabilityRepo` (Milestone 15). This service already
 * took a `RequestingActor` in the original, so this is a mechanical async
 * port — `RequestingActor` now comes from the shared
 * `server/src/db/domain-types.js` mirror instead of being redeclared
 * locally, and `approvalStateMachine` is imported from the new
 * `server/src/logic/` port (see that file's header for why it had to be
 * duplicated rather than imported from `src/shared`).
 */
import * as unavailabilityRepo from '../db/repositories/unavailabilityRepo.js';
import { canTransition, InvalidApprovalTransitionError } from '../logic/approvalStateMachine.js';
import type {
  EmployeeUnavailability,
  RequestingActor,
  UnavailabilityStatus,
} from '../db/domain-types.js';

export { InvalidApprovalTransitionError };
export type { RequestingActor };

export class UnavailabilityRequestNotFoundError extends Error {
  constructor(id: number) {
    super(`Unavailability request ${id} not found`);
    this.name = 'UnavailabilityRequestNotFoundError';
  }
}

export class UnauthorizedUnavailabilityActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedUnavailabilityActionError';
  }
}

function validateWindow(input: { dayOfWeek: number; startTime: string; endTime: string }): void {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw new Error('Day of week must be an integer between 0 and 6');
  }
  if (!input.startTime || !input.endTime) {
    throw new Error('Start and end time are required');
  }
}

export interface CreateOwnUnavailabilityInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  reason?: string | null;
}

/** Any logged-in employee may submit an unavailability request for themselves. */
export async function createOwnRequest(
  actor: RequestingActor,
  input: CreateOwnUnavailabilityInput,
): Promise<EmployeeUnavailability> {
  validateWindow(input);
  return unavailabilityRepo.create({
    employeeId: actor.id,
    requestedBy: actor.id,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    reason: input.reason,
  });
}

/** Any logged-in employee may list their own requests. */
export async function listOwnRequests(
  actor: RequestingActor,
): Promise<EmployeeUnavailability[]> {
  return unavailabilityRepo.listByEmployee(actor.id);
}

export interface DecideUnavailabilityInput {
  id: number;
  status: Extract<UnavailabilityStatus, 'approved' | 'denied'>;
  decisionNote?: string | null;
}

/** Only a manager may approve/deny, and only along a valid state-machine transition. */
export async function decideRequest(
  actor: RequestingActor,
  input: DecideUnavailabilityInput,
): Promise<EmployeeUnavailability> {
  if (actor.role !== 'manager') {
    throw new UnauthorizedUnavailabilityActionError(
      'Only managers can approve or deny unavailability requests',
    );
  }

  const existing = await unavailabilityRepo.getById(input.id);
  if (!existing) {
    throw new UnavailabilityRequestNotFoundError(input.id);
  }
  if (!canTransition(existing.status, input.status)) {
    throw new InvalidApprovalTransitionError(existing.status, input.status);
  }

  return unavailabilityRepo.updateStatus({
    id: input.id,
    status: input.status,
    decidedBy: actor.id,
    decisionNote: input.decisionNote,
  });
}

export interface CreateUnavailabilityForEmployeeInput extends CreateOwnUnavailabilityInput {
  employeeId: number;
}

/**
 * Manager-only: create an unavailability entry directly for any employee,
 * immediately auto-approved — mirrors `timeOffService.createForEmployee`.
 * Reuses `decideRequest` for the actual approval so the same manager-check
 * and state-machine validation path applies here too.
 */
export async function createForEmployee(
  actor: RequestingActor,
  input: CreateUnavailabilityForEmployeeInput,
): Promise<EmployeeUnavailability> {
  if (actor.role !== 'manager') {
    throw new UnauthorizedUnavailabilityActionError(
      'Only managers can submit unavailability on behalf of another employee',
    );
  }
  validateWindow(input);
  const created = await unavailabilityRepo.create({
    employeeId: input.employeeId,
    requestedBy: actor.id,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    reason: input.reason,
  });
  return decideRequest(actor, { id: created.id, status: 'approved' });
}

/** Only a manager may see every employee's requests (the approval queue). */
export async function listAllRequests(
  actor: RequestingActor,
): Promise<EmployeeUnavailability[]> {
  if (actor.role !== 'manager') {
    throw new UnauthorizedUnavailabilityActionError(
      'Only managers can view all unavailability requests',
    );
  }
  return unavailabilityRepo.listAll();
}

/**
 * Lists every approved unavailability entry across all employees, for the
 * schedule grid to cross-reference by employee + day-of-week. Not
 * manager-restricted: any logged-in user reading the schedule can see it.
 */
export async function listApprovedAll(): Promise<EmployeeUnavailability[]> {
  return unavailabilityRepo.listApproved();
}
