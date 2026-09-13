import { asc, count, eq, sql } from 'drizzle-orm';
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
  const [row] = await db.select().from(employees).where(eq(employees.username, username));
  return row ? toEmployeeWithHash(row) : undefined;
}

export async function findById(id: number): Promise<EmployeeWithHash | undefined> {
  const db = getDb();
  const [row] = await db.select().from(employees).where(eq(employees.id, id));
  return row ? toEmployeeWithHash(row) : undefined;
}

export async function listAll(): Promise<EmployeeWithDepartmentsRow[]> {
  const db = getDb();
  const rows = await db.select().from(employees).orderBy(asc(employees.name));
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
    const [inserted] = await tx
      .insert(employees)
      .values({
        name: input.name,
        username: input.username,
        passwordHash: input.passwordHash,
        role: input.role,
        isSalaried: input.isSalaried,
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
