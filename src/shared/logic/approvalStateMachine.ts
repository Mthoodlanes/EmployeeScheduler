/**
 * Pure state-machine logic for the `pending -> approved|denied` approval
 * workflow shared by every manager-approved employee request in the app
 * (time-off requests, employee unavailability). Kept side-effect free (no
 * DB, no IPC) so it can be unit-tested in isolation and reused by every
 * service that needs it — originally written for `timeOffService` alone as
 * `timeOffStateMachine.ts`, generalized here once `unavailabilityService`
 * needed the exact same rules rather than a copy-pasted duplicate.
 *
 * Valid transitions: `pending -> approved`, `pending -> denied`.
 * `approved` and `denied` are terminal — no further transitions are allowed
 * out of either state, including back to `pending` or from one to the other.
 */
import type { ApprovalStatus } from '../types/domain';

const ALLOWED_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  pending: ['approved', 'denied'],
  approved: [],
  denied: [],
};

export function canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidApprovalTransitionError extends Error {
  constructor(from: ApprovalStatus, to: ApprovalStatus) {
    super(`Cannot transition request from "${from}" to "${to}"`);
    this.name = 'InvalidApprovalTransitionError';
  }
}

/** Returns `to` when the transition is valid, otherwise throws `InvalidApprovalTransitionError`. */
export function applyTransition(from: ApprovalStatus, to: ApprovalStatus): ApprovalStatus {
  if (!canTransition(from, to)) {
    throw new InvalidApprovalTransitionError(from, to);
  }
  return to;
}
