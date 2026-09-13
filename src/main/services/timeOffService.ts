import * as timeOffRepo from '../db/repositories/timeOffRepo';
import {
  canTransition,
  InvalidApprovalTransitionError,
} from '../../shared/logic/approvalStateMachine';
import type { Role, TimeOffRequest, TimeOffStatus } from '../../shared/types/domain';

export { InvalidApprovalTransitionError };

export class TimeOffRequestNotFoundError extends Error {
  constructor(id: number) {
    super(`Time-off request ${id} not found`);
    this.name = 'TimeOffRequestNotFoundError';
  }
}

export class UnauthorizedTimeOffActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedTimeOffActionError';
  }
}

/**
 * The employee performing the action, as established by the main-process
 * session (never trust a renderer-supplied id/role). Every function below
 * re-derives "self" from `actor.id` rather than accepting an employeeId in
 * its input, and re-checks `actor.role` for manager-only actions — this is
 * the first employee-writable feature in the app, so these rules are
 * enforced here (and unit-tested directly) in addition to the IPC-layer
 * `requireLoggedIn`/`requireManager` checks used elsewhere.
 */
export interface RequestingActor {
  id: number;
  role: Role;
}

export interface CreateOwnTimeOffRequestInput {
  startDate: string;
  endDate: string;
  reason?: string | null;
}

/** Any logged-in employee may submit a time-off request for themselves. */
export function createOwnRequest(
  actor: RequestingActor,
  input: CreateOwnTimeOffRequestInput,
): TimeOffRequest {
  if (input.endDate < input.startDate) {
    throw new Error('End date must be on or after the start date');
  }
  return timeOffRepo.create({
    employeeId: actor.id,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason,
  });
}

/** Any logged-in employee may list their own requests. */
export function listOwnRequests(actor: RequestingActor): TimeOffRequest[] {
  return timeOffRepo.listByEmployee(actor.id);
}

export interface DecideTimeOffRequestInput {
  id: number;
  status: Extract<TimeOffStatus, 'approved' | 'denied'>;
  decisionNote?: string | null;
}

/** Only a manager may approve/deny, and only along a valid state-machine transition. */
export function decideRequest(
  actor: RequestingActor,
  input: DecideTimeOffRequestInput,
): TimeOffRequest {
  if (actor.role !== 'manager') {
    throw new UnauthorizedTimeOffActionError('Only managers can approve or deny time-off requests');
  }

  const existing = timeOffRepo.getById(input.id);
  if (!existing) {
    throw new TimeOffRequestNotFoundError(input.id);
  }
  if (!canTransition(existing.status, input.status)) {
    throw new InvalidApprovalTransitionError(existing.status, input.status);
  }

  return timeOffRepo.updateStatus({
    id: input.id,
    status: input.status,
    decidedBy: actor.id,
    decisionNote: input.decisionNote,
  });
}

export interface CreateTimeOffForEmployeeInput {
  employeeId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

/**
 * Manager-only: create a time-off request directly for any employee,
 * immediately auto-approved — covers the case where an employee can't (or
 * didn't) submit the request themselves, and there is no separate approval
 * step needed since the manager creating it is the same person who would
 * approve it. Reuses `decideRequest` (rather than writing the approved
 * status directly) so the same manager-check and state-machine validation
 * path applies here too.
 */
export function createForEmployee(
  actor: RequestingActor,
  input: CreateTimeOffForEmployeeInput,
): TimeOffRequest {
  if (actor.role !== 'manager') {
    throw new UnauthorizedTimeOffActionError(
      'Only managers can submit time off on behalf of another employee',
    );
  }
  if (input.endDate < input.startDate) {
    throw new Error('End date must be on or after the start date');
  }
  const created = timeOffRepo.create({
    employeeId: input.employeeId,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason,
  });
  return decideRequest(actor, { id: created.id, status: 'approved' });
}

/** Only a manager may see every employee's requests (the approval queue). */
export function listAllRequests(actor: RequestingActor): TimeOffRequest[] {
  if (actor.role !== 'manager') {
    throw new UnauthorizedTimeOffActionError('Only managers can view all time-off requests');
  }
  return timeOffRepo.listAll();
}

/**
 * Lists approved time off overlapping a date range, for the schedule grid to
 * cross-reference by employee + date. Not manager-restricted: any logged-in
 * user reading the schedule can see which days are blocked.
 */
export function listApprovedForRange(startDate: string, endDate: string): TimeOffRequest[] {
  return timeOffRepo.listApprovedInDateRange(startDate, endDate);
}
