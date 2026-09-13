import { getDb } from '../connection';
import type {
  Department,
  EndAnchor,
  ShiftTemplate,
  StartAnchor,
} from '../../../shared/types/domain';

interface ShiftTemplateRow {
  id: number;
  department: Department | null;
  name: string;
  start_time: string | null;
  end_time: string | null;
  start_anchor: StartAnchor;
  end_anchor: EndAnchor;
  color: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function toShiftTemplate(row: ShiftTemplateRow): ShiftTemplate {
  return {
    id: row.id,
    department: row.department,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    startAnchor: row.start_anchor,
    endAnchor: row.end_anchor,
    color: row.color,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DEFAULT_COLOR = '#D97706';

export interface CreateShiftTemplateInput {
  /** NULL creates a shared template usable from any of the three department tabs. */
  department: Department | null;
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor?: StartAnchor;
  endAnchor?: EndAnchor;
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
 * Lists every template. Department-specific rows sort ahead of shared
 * (`department IS NULL`) ones, since `department IS NULL` evaluates to 0/1
 * and SQLite orders ascending — this keeps the schedule board's template
 * picker showing a department's own templates first, shared ones after.
 */
export function listAll(): ShiftTemplate[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM shift_templates ORDER BY department IS NULL, department, start_time')
    .all() as ShiftTemplateRow[];
  return rows.map(toShiftTemplate);
}

export function getById(id: number): ShiftTemplate | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM shift_templates WHERE id = ?').get(id) as
    ShiftTemplateRow | undefined;
  return row ? toShiftTemplate(row) : undefined;
}

/**
 * Finds a template by its exact department + name. `department` may be
 * `null` (a shared template) — `IS` is used instead of `=` so the lookup is
 * null-safe in both directions, unlike SQL's three-valued `=`.
 */
export function findByDepartmentAndName(
  department: Department | null,
  name: string,
): ShiftTemplate | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM shift_templates WHERE department IS ? AND name = ?')
    .get(department, name) as ShiftTemplateRow | undefined;
  return row ? toShiftTemplate(row) : undefined;
}

export function create(input: CreateShiftTemplateInput): ShiftTemplate {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO shift_templates (department, name, start_time, end_time, start_anchor, end_anchor, color)
       VALUES (@department, @name, @startTime, @endTime, @startAnchor, @endAnchor, @color)`,
    )
    .run({
      department: input.department,
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      startAnchor: input.startAnchor ?? 'fixed',
      endAnchor: input.endAnchor ?? 'fixed',
      color: input.color ?? DEFAULT_COLOR,
    });

  const created = getById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error('Failed to load shift template immediately after creation');
  }
  return created;
}

export function update(input: UpdateShiftTemplateInput): ShiftTemplate {
  const db = getDb();
  db.prepare(
    `UPDATE shift_templates
     SET name = ?, start_time = ?, end_time = ?, start_anchor = ?, end_anchor = ?, color = ?, is_active = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(
    input.name,
    input.startTime,
    input.endTime,
    input.startAnchor,
    input.endAnchor,
    input.color,
    input.isActive ? 1 : 0,
    input.id,
  );

  const updated = getById(input.id);
  if (!updated) {
    throw new Error(`Shift template ${input.id} not found after update`);
  }
  return updated;
}

export function deactivate(id: number): ShiftTemplate {
  const db = getDb();
  db.prepare(
    `UPDATE shift_templates
     SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(id);

  const updated = getById(id);
  if (!updated) {
    throw new Error(`Shift template ${id} not found after deactivation`);
  }
  return updated;
}
