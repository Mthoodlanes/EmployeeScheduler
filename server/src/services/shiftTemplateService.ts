/**
 * Milestone 16: port of `src/main/services/shiftTemplateService.ts` onto the
 * new Drizzle `shiftTemplateRepo` (Milestone 15), RETROFITTED with a
 * `RequestingActor` parameter — one of the 3 services whose authorization
 * checks originally lived only at the IPC-handler layer
 * (`src/main/ipc/shiftTemplates.ipc.ts`'s `requireLoggedIn()`/
 * `requireManager()`), moved in here the same way as `employeeService`.
 *
 * Original IPC-layer checks being moved in here (see
 * `src/main/ipc/shiftTemplates.ipc.ts`):
 *   - `shiftTemplatesList`       -> requireLoggedIn() -> listShiftTemplates(actor)
 *   - `shiftTemplatesCreate`     -> requireManager()  -> createShiftTemplate(actor, input)
 *   - `shiftTemplatesUpdate`     -> requireManager()  -> updateShiftTemplate(actor, input)
 *   - `shiftTemplatesDeactivate` -> requireManager()  -> deactivateShiftTemplate(actor, id)
 */
import * as shiftTemplateRepo from '../db/repositories/shiftTemplateRepo.js';
import type {
  Department,
  EndAnchor,
  RequestingActor,
  ShiftTemplate,
  StartAnchor,
} from '../db/domain-types.js';

export type { RequestingActor };

export class UnauthorizedShiftTemplateActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedShiftTemplateActionError';
  }
}

function assertManager(actor: RequestingActor): void {
  if (actor.role !== 'manager') {
    throw new UnauthorizedShiftTemplateActionError('Only managers can manage shift templates');
  }
}

export interface CreateShiftTemplateInput {
  /** NULL creates a shared template usable from any of the three department tabs. */
  department: Department | null;
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  color?: string;
}

export interface UpdateShiftTemplateInput {
  id: number;
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  color: string;
  isActive: boolean;
}

/**
 * A fixed edge needs its literal time; an anchored edge ('open'/'close')
 * resolves live instead, so any literal time supplied for it is ignored —
 * normalized to `null` here so the stored row never carries a stale time
 * alongside its anchor.
 */
function normalizeStart(anchor: StartAnchor, time: string | null): string | null {
  if (anchor !== 'fixed') {
    return null;
  }
  if (!time) {
    throw new Error('A start time is required unless the shift opens with the store');
  }
  return time;
}

function normalizeEnd(anchor: EndAnchor, time: string | null): string | null {
  if (anchor !== 'fixed') {
    return null;
  }
  if (!time) {
    throw new Error('An end time is required unless the shift closes with the store');
  }
  return time;
}

/**
 * Any logged-in user may list shift templates — the schedule board needs
 * this regardless of who is viewing it. `actor` is still required (rather
 * than dropped) to keep this function's authorization signature uniform
 * with the other 8 services.
 */
export async function listShiftTemplates(_actor: RequestingActor): Promise<ShiftTemplate[]> {
  return shiftTemplateRepo.listAll();
}

/** Only a manager may create a shift template. */
export async function createShiftTemplate(
  actor: RequestingActor,
  input: CreateShiftTemplateInput,
): Promise<ShiftTemplate> {
  assertManager(actor);
  return shiftTemplateRepo.create({
    department: input.department,
    name: input.name,
    startTime: normalizeStart(input.startAnchor, input.startTime),
    endTime: normalizeEnd(input.endAnchor, input.endTime),
    startAnchor: input.startAnchor,
    endAnchor: input.endAnchor,
    color: input.color,
  });
}

/** Only a manager may edit a shift template. */
export async function updateShiftTemplate(
  actor: RequestingActor,
  input: UpdateShiftTemplateInput,
): Promise<ShiftTemplate> {
  assertManager(actor);
  return shiftTemplateRepo.update({
    id: input.id,
    name: input.name,
    startTime: normalizeStart(input.startAnchor, input.startTime),
    endTime: normalizeEnd(input.endAnchor, input.endTime),
    startAnchor: input.startAnchor,
    endAnchor: input.endAnchor,
    color: input.color,
    isActive: input.isActive,
  });
}

/** Only a manager may deactivate a shift template. */
export async function deactivateShiftTemplate(
  actor: RequestingActor,
  id: number,
): Promise<ShiftTemplate> {
  assertManager(actor);
  return shiftTemplateRepo.deactivate(id);
}
