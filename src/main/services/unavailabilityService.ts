import * as unavailabilityRepo from '../db/repositories/unavailabilityRepo';
import {
  canTransition,
  InvalidApprovalTransitionError,
} from '../../shared/logic/approvalStateMachine';
import type { EmployeeUnavailability, Role, UnavailabilityStatus } from '../../shared/types/domain';

export { InvalidApprovalTransitionError };

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

/**
 * The employee performing the action, as established by the main-process
 * session — mirrors `timeOffService`'s `RequestingActor`/actor-based
 * pattern exactly (every function re-derives "self" from `actor.id` rather
 * than trusting a renderer-supplied employee id, and re-checks `actor.role`
 * for manager-only actions).
 */
export interface RequestingActor {
  id: number;
  role: Role;
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
export function createOwnRequest(
  actor: RequestingActor,
  input: CreateOwnUnavailabilityInput,
): EmployeeUnavailability {
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
export function listOwnRequests(actor: RequestingActor): EmployeeUnavailability[] {
  return unavailabilityRepo.listByEmployee(actor.id);
}

export interface DecideUnavailabilityInput {
  id: number;
  status: Extract<UnavailabilityStatus, 'approved' | 'denied'>;
  decisionNote?: string | null;
}

/** Only a manager may approve/deny, and only along a valid state-machine transition. */
export function decideRequest(
  actor: RequestingActor,
  input: DecideUnavailabilityInput,
): EmployeeUnavailability {
  if (actor.role !== 'manager') {
    throw new UnauthorizedUnavailabilityActionError(
      'Only managers can approve or deny unavailability requests',
    );
  }

  const existing = unavailabilityRepo.getById(input.id);
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
export function createForEmployee(
  actor: RequestingActor,
  input: CreateUnavailabilityForEmployeeInput,
): EmployeeUnavailability {
  if (actor.role !== 'manager') {
    throw new UnauthorizedUnavailabilityActionError(
      'Only managers can submit unavailability on behalf of another employee',
    );
  }
  validateWindow(input);
  const created = unavailabilityRepo.create({
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
export function listAllRequests(actor: RequestingActor): EmployeeUnavailability[] {
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
export function listApprovedAll(): EmployeeUnavailability[] {
  return unavailabilityRepo.listApproved();
}
