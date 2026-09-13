import { asc, count, eq, max, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { employeeDepartments, employees } from '../schema.js';
import type { Department, Employee, EmployeeWithHash, Role } from '../domain-types.js';

type EmployeeRow = typeof employees.$inferSelect;
type Db = ReturnType<typeof getDb>;

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    isSalaried: row.isSalaried,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEmployeeWithHash(row: EmployeeRow): EmployeeWithHash {
  return { ...toEmployee(row), passwordHash: row.passwordHash };
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

async function getDepartmentsFor(db: Db, employeeId: number): Promise<Department[]> {
  const rows = await db
    .select({ department: employeeDepartments.department })
    .from(employeeDepartments)
    .where(eq(employeeDepartments.employeeId, employeeId))
    // `department` is a native Postgres enum here, and enums sort by their
    // declared ordinal (front_desk, cafe, bar) rather than lexicographically
    // — unlike the original SQLite column, which was plain TEXT and sorted
    // alphabetically (bar, cafe, front_desk). Casting to text restores the
    // original alphabetical order; confirmed against real data in the
    // Milestone 15 verification script (initially caught this mismatch).
    .orderBy(sql`${employeeDepartments.department}::text`);
  return rows.map((row) => row.department);
}

export async function countEmployees(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ value: count() }).from(employees);
  return row?.value ?? 0;
}

export async function findByUsername(username: string): Promise<EmployeeWithHash | undefined> {
  const db = getDb();
  // Case-insensitive: "Doug" and "doug" are the same account for sign-in and
  // duplicate-checking purposes (see employeeService.createEmployee). Plain
  // `eq()` is case-sensitive in Postgres, so this needs the explicit LOWER()
  // comparison rather than the `unique()` schema constraint alone.
  const [row] = await db
    .select()
    .from(employees)
    .where(sql`lower(${employees.username}) = lower(${username})`);
  return row ? toEmployeeWithHash(row) : undefined;
}

export async function findById(id: number): Promise<EmployeeWithHash | undefined> {
  const db = getDb();
  const [row] = await db.select().from(employees).where(eq(employees.id, id));
  return row ? toEmployeeWithHash(row) : undefined;
}

/**
 * Default order is `sortOrder` ascending (the Schedule Board's manual
 * drag-and-drop order), not alphabetical — see `Employee.sortOrder`'s doc
 * comment in `domain-types.ts`. `id` is a tiebreaker for determinism when
 * two rows somehow share a `sortOrder`. Callers that specifically want
 * alphabetical order (e.g. `EmployeesAdminPage`, for looking someone up)
 * sort client-side.
 */
export async function listAll(): Promise<EmployeeWithDepartmentsRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(employees)
    .orderBy(asc(employees.sortOrder), asc(employees.id));
  return Promise.all(
    rows.map(async (row) => ({
      ...toEmployee(row),
      departments: await getDepartmentsFor(db, row.id),
    })),
  );
}

export async function getById(id: number): Promise<EmployeeWithDepartmentsRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(employees).where(eq(employees.id, id));
  if (!row) return undefined;
  return { ...toEmployee(row), departments: await getDepartmentsFor(db, row.id) };
}

export async function create(input: CreateEmployeeInput): Promise<EmployeeWithDepartmentsRow> {
  const db = getDb();

  const employeeId = await db.transaction(async (tx) => {
    // Appended at the end, never inserted at the top.
    const [{ maxSortOrder }] = await tx
      .select({ maxSortOrder: max(employees.sortOrder) })
      .from(employees);
    const [inserted] = await tx
      .insert(employees)
      .values({
        name: input.name,
        username: input.username,
        passwordHash: input.passwordHash,
        role: input.role,
        isSalaried: input.isSalaried,
        sortOrder: (maxSortOrder ?? -1) + 1,
      })
      .returning({ id: employees.id });

    await Promise.all(
      input.departments.map((department) =>
        tx.insert(employeeDepartments).values({ employeeId: inserted.id, department }),
      ),
    );

    return inserted.id;
  });

  const created = await getById(employeeId);
  if (!created) {
    throw new Error('Failed to load employee immediately after creation');
  }
  return created;
}

export async function update(input: UpdateEmployeeInput): Promise<EmployeeWithDepartmentsRow> {
  const db = getDb();

  if (input.passwordHash) {
    await db
      .update(employees)
      .set({
        name: input.name,
        role: input.role,
        isSalaried: input.isSalaried,
        isActive: input.isActive,
        passwordHash: input.passwordHash,
        updatedAt: sql`now()`,
      })
      .where(eq(employees.id, input.id));
  } else {
    await db
      .update(employees)
      .set({
        name: input.name,
        role: input.role,
        isSalaried: input.isSalaried,
        isActive: input.isActive,
        updatedAt: sql`now()`,
      })
      .where(eq(employees.id, input.id));
  }

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Employee ${input.id} not found after update`);
  }
  return updated;
}

export async function updateOwnProfile(
  input: UpdateOwnProfileInput,
): Promise<EmployeeWithDepartmentsRow> {
  const db = getDb();

  const changes: Partial<typeof employees.$inferInsert> = {};
  if (input.name !== undefined) {
    changes.name = input.name;
  }
  if (input.passwordHash !== undefined) {
    changes.passwordHash = input.passwordHash;
  }

  if (Object.keys(changes).length > 0) {
    await db
      .update(employees)
      .set({ ...changes, updatedAt: sql`now()` })
      .where(eq(employees.id, input.id));
  }

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Employee ${input.id} not found after updating own profile`);
  }
  return updated;
}

export async function deactivate(id: number): Promise<EmployeeWithDepartmentsRow> {
  const db = getDb();
  await db
    .update(employees)
    .set({ isActive: false, updatedAt: sql`now()` })
    .where(eq(employees.id, id));

  const updated = await getById(id);
  if (!updated) {
    throw new Error(`Employee ${id} not found after deactivation`);
  }
  return updated;
}

export async function setDepartments(
  employeeId: number,
  departments: Department[],
): Promise<EmployeeWithDepartmentsRow> {
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.delete(employeeDepartments).where(eq(employeeDepartments.employeeId, employeeId));
    await Promise.all(
      departments.map((department) =>
        tx.insert(employeeDepartments).values({ employeeId, department }),
      ),
    );
  });

  const updated = await getById(employeeId);
  if (!updated) {
    throw new Error(`Employee ${employeeId} not found after setting departments`);
  }
  return updated;
}

/**
 * Persists a brand-new GLOBAL `sortOrder` for every employee, per
 * `orderedIds`' array position (0, 1, 2, ...). `orderedIds` must be the
 * COMPLETE set of employee ids — the Schedule Board only ever shows one
 * department's subset at a time, so the caller is responsible for merging a
 * subset's new drag-and-drop order back into the full list (see
 * `src/shared/logic/employeeOrder.ts#mergeReorderedSubset` on the Electron
 * side; the renderer bundle here is shared) before calling this. Rejected
 * outright if `orderedIds` doesn't exactly match the existing employee ids
 * (no missing id, no extra/unknown id, no duplicate) — a partial list here
 * would silently leave some employees with a stale `sortOrder`, or worse,
 * collide two employees onto the same value.
 *
 * Deliberately does NOT touch `updatedAt` — purely an ordering concern, not
 * a profile edit (see the feature's constraints).
 */
export async function reorder(orderedIds: number[]): Promise<EmployeeWithDepartmentsRow[]> {
  const db = getDb();

  const existingRows = await db.select({ id: employees.id }).from(employees);
  const existingIds = new Set(existingRows.map((row) => row.id));
  const uniqueOrderedIds = new Set(orderedIds);
  const isValid =
    uniqueOrderedIds.size === orderedIds.length &&
    uniqueOrderedIds.size === existingIds.size &&
    orderedIds.every((id) => existingIds.has(id));
  if (!isValid) {
    throw new Error('orderedIds must include every existing employee id exactly once');
  }

  await db.transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.update(employees).set({ sortOrder: index }).where(eq(employees.id, id)),
      ),
    );
  });

  return listAll();
}

/**
 * Milestone 26: raw `last_read_notices_at` column access for the notice
 * board's unread tracking — deliberately NOT threaded through `toEmployee`/
 * the public `Employee` type (every existing caller/test expects that exact
 * shape), so these two functions read/write the column directly instead.
 */
export async function getLastReadNoticesAt(employeeId: number): Promise<Date | null> {
  const db = getDb();
  const [row] = await db
    .select({ lastReadNoticesAt: employees.lastReadNoticesAt })
    .from(employees)
    .where(eq(employees.id, employeeId));
  return row?.lastReadNoticesAt ?? null;
}

export async function markNoticesRead(employeeId: number): Promise<void> {
  const db = getDb();
  await db
    .update(employees)
    .set({ lastReadNoticesAt: sql`now()` })
    .where(eq(employees.id, employeeId));
}
