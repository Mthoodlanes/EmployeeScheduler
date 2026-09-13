import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type { Department, Employee, EmployeeWithHash, Role } from '../../../shared/types/domain';

interface EmployeeRow {
  id: number;
  name: string;
  username: string;
  password_hash: string;
  role: Role;
  is_salaried: number;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DepartmentRow {
  department: Department;
}

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    isSalaried: row.is_salaried === 1,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEmployeeWithHash(row: EmployeeRow): EmployeeWithHash {
  return { ...toEmployee(row), passwordHash: row.password_hash };
}

export interface EmployeeWithDepartmentsRow extends Employee {
  departments: Department[];
}

export interface CreateEmployeeInput {
  name: string;
  username: string;
  passwordHash: string;
  role: Role;
  isSalaried: boolean;
  departments: Department[];
}

export interface UpdateEmployeeInput {
  id: number;
  name: string;
  role: Role;
  isSalaried: boolean;
  isActive: boolean;
  passwordHash?: string;
}

/**
 * Self-service counterpart to `UpdateEmployeeInput`/`update` — deliberately
 * narrower: no `role`/`isSalaried`/`isActive`, since those stay
 * manager-only via `update` above. Both fields are optional so a
 * name-only change never has to re-supply an unrelated password hash.
 */
export interface UpdateOwnProfileInput {
  id: number;
  name?: string;
  passwordHash?: string;
}

function getDepartmentsFor(db: Database.Database, employeeId: number): Department[] {
  const rows = db
    .prepare(
      'SELECT department FROM employee_departments WHERE employee_id = ? ORDER BY department',
    )
    .all(employeeId) as DepartmentRow[];
  return rows.map((row) => row.department);
}

export function countEmployees(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number };
  return row.count;
}

export function findByUsername(username: string): EmployeeWithHash | undefined {
  const db = getDb();
  // Case-insensitive: "Doug" and "doug" are the same account for sign-in and
  // duplicate-checking purposes (see employeeService.createEmployee).
  const row = db.prepare('SELECT * FROM employees WHERE username = ? COLLATE NOCASE').get(
    username,
  ) as EmployeeRow | undefined;
  return row ? toEmployeeWithHash(row) : undefined;
}

export function findById(id: number): EmployeeWithHash | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as EmployeeRow | undefined;
  return row ? toEmployeeWithHash(row) : undefined;
}

/**
 * Default order is `sort_order` ascending (the Schedule Board's manual
 * drag-and-drop order), not alphabetical — see `EmployeeWithDepartments`'s
 * `sortOrder` field. `id` is a tiebreaker for determinism when two rows
 * somehow share a `sort_order` (never produced by `reorder`/`create` below,
 * but not relied upon). Callers that specifically want alphabetical order
 * (e.g. `EmployeesAdminPage`, for looking someone up) sort client-side.
 */
export function listAll(): EmployeeWithDepartmentsRow[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM employees ORDER BY sort_order ASC, id ASC')
    .all() as EmployeeRow[];
  return rows.map((row) => ({
    ...toEmployee(row),
    departments: getDepartmentsFor(db, row.id),
  }));
}

export function getById(id: number): EmployeeWithDepartmentsRow | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as EmployeeRow | undefined;
  if (!row) return undefined;
  return { ...toEmployee(row), departments: getDepartmentsFor(db, row.id) };
}

/** Next `sort_order` for a newly-created employee: appended at the end, never inserted at the top. */
function nextSortOrder(db: Database.Database): number {
  const row = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as maxSortOrder FROM employees').get() as {
    maxSortOrder: number;
  };
  return row.maxSortOrder + 1;
}

export function create(input: CreateEmployeeInput): EmployeeWithDepartmentsRow {
  const db = getDb();

  const insertEmployee = db.prepare(`
    INSERT INTO employees (name, username, password_hash, role, is_salaried, is_active, sort_order)
    VALUES (@name, @username, @passwordHash, @role, @isSalaried, 1, @sortOrder)
  `);
  const insertDepartment = db.prepare(
    'INSERT INTO employee_departments (employee_id, department) VALUES (?, ?)',
  );

  const runInTransaction = db.transaction(() => {
    const result = insertEmployee.run({
      name: input.name,
      username: input.username,
      passwordHash: input.passwordHash,
      role: input.role,
      isSalaried: input.isSalaried ? 1 : 0,
      sortOrder: nextSortOrder(db),
    });
    const employeeId = Number(result.lastInsertRowid);
    input.departments.forEach((department) => {
      insertDepartment.run(employeeId, department);
    });
    return employeeId;
  });

  const employeeId = runInTransaction();
  const created = getById(employeeId);
  if (!created) {
    throw new Error('Failed to load employee immediately after creation');
  }
  return created;
}

export function update(input: UpdateEmployeeInput): EmployeeWithDepartmentsRow {
  const db = getDb();

  if (input.passwordHash) {
    db.prepare(
      `UPDATE employees
       SET name = ?, role = ?, is_salaried = ?, is_active = ?, password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).run(
      input.name,
      input.role,
      input.isSalaried ? 1 : 0,
      input.isActive ? 1 : 0,
      input.passwordHash,
      input.id,
    );
  } else {
    db.prepare(
      `UPDATE employees
       SET name = ?, role = ?, is_salaried = ?, is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).run(input.name, input.role, input.isSalaried ? 1 : 0, input.isActive ? 1 : 0, input.id);
  }

  const updated = getById(input.id);
  if (!updated) {
    throw new Error(`Employee ${input.id} not found after update`);
  }
  return updated;
}

export function updateOwnProfile(input: UpdateOwnProfileInput): EmployeeWithDepartmentsRow {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    sets.push('name = ?');
    params.push(input.name);
  }
  if (input.passwordHash !== undefined) {
    sets.push('password_hash = ?');
    params.push(input.passwordHash);
  }

  if (sets.length > 0) {
    sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
    params.push(input.id);
    db.prepare(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = getById(input.id);
  if (!updated) {
    throw new Error(`Employee ${input.id} not found after updating own profile`);
  }
  return updated;
}

export function deactivate(id: number): EmployeeWithDepartmentsRow {
  const db = getDb();
  db.prepare(
    `UPDATE employees SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(id);
  const updated = getById(id);
  if (!updated) {
    throw new Error(`Employee ${id} not found after deactivation`);
  }
  return updated;
}

export function setDepartments(
  employeeId: number,
  departments: Department[],
): EmployeeWithDepartmentsRow {
  const db = getDb();
  const deleteExisting = db.prepare('DELETE FROM employee_departments WHERE employee_id = ?');
  const insertDepartment = db.prepare(
    'INSERT INTO employee_departments (employee_id, department) VALUES (?, ?)',
  );

  const runInTransaction = db.transaction(() => {
    deleteExisting.run(employeeId);
    departments.forEach((department) => {
      insertDepartment.run(employeeId, department);
    });
  });
  runInTransaction();

  const updated = getById(employeeId);
  if (!updated) {
    throw new Error(`Employee ${employeeId} not found after setting departments`);
  }
  return updated;
}

/**
 * Persists a brand-new GLOBAL `sort_order` for every employee, per
 * `orderedIds`' array position (0, 1, 2, ...). `orderedIds` must be the
 * COMPLETE set of employee ids — the Schedule Board only ever shows one
 * department's subset at a time, so the renderer is responsible for merging
 * a subset's new drag-and-drop order back into the full list (see
 * `src/shared/logic/employeeOrder.ts#mergeReorderedSubset`) before calling
 * this. Rejected outright if `orderedIds` doesn't exactly match the existing
 * employee ids (no missing id, no extra/unknown id, no duplicate) — a
 * partial list here would silently leave some employees with a stale
 * `sort_order`, or worse, collide two employees onto the same value.
 *
 * Deliberately does NOT touch `updated_at` — purely an ordering concern,
 * not a profile edit (see the feature's constraints).
 */
export function reorder(orderedIds: number[]): EmployeeWithDepartmentsRow[] {
  const db = getDb();

  const existingIds = new Set(
    (db.prepare('SELECT id FROM employees').all() as { id: number }[]).map((row) => row.id),
  );
  const uniqueOrderedIds = new Set(orderedIds);
  const isValid =
    uniqueOrderedIds.size === orderedIds.length &&
    uniqueOrderedIds.size === existingIds.size &&
    orderedIds.every((id) => existingIds.has(id));
  if (!isValid) {
    throw new Error('orderedIds must include every existing employee id exactly once');
  }

  const setSortOrder = db.prepare('UPDATE employees SET sort_order = ? WHERE id = ?');
  const runInTransaction = db.transaction(() => {
    orderedIds.forEach((id, index) => {
      setSortOrder.run(index, id);
    });
  });
  runInTransaction();

  return listAll();
}
