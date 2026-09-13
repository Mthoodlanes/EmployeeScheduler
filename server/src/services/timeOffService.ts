/**
 * Milestone 16: port of `src/main/services/timeOffService.ts` onto the new
 * Drizzle `timeOffRepo` (Milestone 15). This service already took a
 * `RequestingActor` in the original, so this is a mechanical async port —
 * `RequestingActor` now comes from the shared `server/src/db/domain-types.js`
 * mirror instead of being redeclared locally, and `approvalStateMachine` is
 * imported from the new `server/src/logic/` port (see that file's header for
 * why it had to be duplicated rather than imported from `src/shared`).
 */
import * as timeOffRepo from '../db/repositories/timeOffRepo.js';
import { canTransition, InvalidApprovalTransitionError } from '../logic/approvalStateMachine.js';
import type { RequestingActor, TimeOffRequest, TimeOffStatus } from '../db/domain-types.js';

export { InvalidApprovalTransitionError };
export type { RequestingActor };

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

export interface CreateOwnTimeOffRequestInput {
  startDate: string;
  endDate: string;
  reason?: string | null;
}

/** Any logged-in employee may submit a time-off request for themselves. */
export async function createOwnRequest(
  actor: RequestingActor,
  input: CreateOwnTimeOffRequestInput,
): Promise<TimeOffRequest> {
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
export async function listOwnRequests(actor: RequestingActor): Promise<TimeOffRequest[]> {
  return timeOffRepo.listByEmployee(actor.id);
}

export interface DecideTimeOffRequestInput {
  id: number;
  status: Extract<TimeOffStatus, 'approved' | 'denied'>;
  decisionNote?: string | null;
}

/** Only a manager may approve/deny, and only along a valid state-machine transition. */
export async function decideRequest(
  actor: RequestingActor,
  input: DecideTimeOffRequestInput,
): Promise<TimeOffRequest> {
  if (actor.role !== 'manager') {
    throw new UnauthorizedTimeOffActionError('Only managers can approve or deny time-off requests');
  }

  const existing = await timeOffRepo.getById(input.id);
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
export async function createForEmployee(
  actor: RequestingActor,
  input: CreateTimeOffForEmployeeInput,
): Promise<TimeOffRequest> {
  if (actor.role !== 'manager') {
    throw new UnauthorizedTimeOffActionError(
      'Only managers can submit time off on behalf of another employee',
    );
  }
  if (input.endDate < input.startDate) {
    throw new Error('End date must be on or after the start date');
  }
  const created = await timeOffRepo.create({
    employeeId: input.employeeId,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason,
  });
  return decideRequest(actor, { id: created.id, status: 'approved' });
}

/** Only a manager may see every employee's requests (the approval queue). */
export async function listAllRequests(actor: RequestingActor): Promise<TimeOffRequest[]> {
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
export async function listApprovedForRange(
  startDate: string,
  endDate: string,
): Promise<TimeOffRequest[]> {
  return timeOffRepo.listApprovedInDateRange(startDate, endDate);
}
