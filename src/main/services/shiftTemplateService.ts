import * as shiftTemplateRepo from '../db/repositories/shiftTemplateRepo';
import type { Department, EndAnchor, ShiftTemplate, StartAnchor } from '../../shared/types/domain';

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

export function listShiftTemplates(): ShiftTemplate[] {
  return shiftTemplateRepo.listAll();
}

export function createShiftTemplate(input: CreateShiftTemplateInput): ShiftTemplate {
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

export function updateShiftTemplate(input: UpdateShiftTemplateInput): ShiftTemplate {
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

export function deactivateShiftTemplate(id: number): ShiftTemplate {
  return shiftTemplateRepo.deactivate(id);
}
