import * as duesTrackerBackupRepo from '../db/repositories/duesTrackerBackupRepo.js';
import type { DuesTrackerBackup, RequestingActor } from '../db/domain-types.js';

export type { RequestingActor };

export class UnauthorizedDuesTrackerBackupActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedDuesTrackerBackupActionError';
  }
}

export class DuesTrackerBackupNotFoundError extends Error {
  constructor(id: number) {
    super(`Backup ${id} not found`);
    this.name = 'DuesTrackerBackupNotFoundError';
  }
}

/** Same access rule as every other Secretary Apps service — see `leagueService.ts`. */
function assertSecretaryAccess(actor: RequestingActor): void {
  if (actor.role !== 'secretary' && actor.role !== 'manager' && !actor.isSecretaryTagged) {
    throw new UnauthorizedDuesTrackerBackupActionError(
      'Only Secretary-area accounts can manage dues-tracker backups',
    );
  }
}

/**
 * Restoring is deliberately held to a HIGHER bar than the rest of the
 * Secretary area: it overwrites every league at once (not just the one a
 * Secretary account normally works in), so this requires the real
 * `manager` role — a plain `secretary` account (even one that lives here
 * every day) or a Secretary-tagged coordinator cannot do it, only someone
 * with full authority over the rest of the app too.
 */
function assertManager(actor: RequestingActor): void {
  if (actor.role !== 'manager') {
    throw new UnauthorizedDuesTrackerBackupActionError(
      'Only a manager can restore a dues-tracker backup',
    );
  }
}

const RESTORE_CONFIRMATION_PHRASE = 'RESTORE';

export async function listBackups(actor: RequestingActor): Promise<DuesTrackerBackup[]> {
  assertSecretaryAccess(actor);
  return duesTrackerBackupRepo.list();
}

export async function createBackup(
  actor: RequestingActor,
  label: string | null,
): Promise<DuesTrackerBackup> {
  assertSecretaryAccess(actor);
  return duesTrackerBackupRepo.create({ label, createdByEmployeeId: actor.id });
}

/**
 * `confirmationText` must exactly equal the literal word "RESTORE" —
 * checked server-side (not just as a UI affordance) since this is the one
 * genuinely irreversible-feeling action in the whole Secretary area. Not
 * actually irreversible anymore (see the pre-restore snapshot the repo
 * layer takes automatically), but the confirmation bar stays high anyway:
 * the point is to stop a stray double-click, not to rely on the safety net.
 */
export async function restoreBackup(
  actor: RequestingActor,
  backupId: number,
  confirmationText: string,
): Promise<DuesTrackerBackup> {
  assertManager(actor);
  if (confirmationText !== RESTORE_CONFIRMATION_PHRASE) {
    throw new Error('Confirmation text did not match — nothing was restored');
  }
  const target = await duesTrackerBackupRepo.getById(backupId);
  if (!target) {
    throw new DuesTrackerBackupNotFoundError(backupId);
  }
  return duesTrackerBackupRepo.restore(backupId, actor.id);
}
