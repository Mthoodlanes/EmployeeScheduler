import {
  pgTable,
  pgEnum,
  integer,
  text,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Milestone 14: consolidated Postgres schema matching the FINAL cumulative
 * shape of the Phase 1 SQLite schema after all 7 migrations in
 * `src/main/db/migrations/` (001_init.ts through 007_employee_unavailability.ts)
 * are applied — this is a from-scratch Postgres schema, not a replay of those
 * migrations (three of them exist purely to work around SQLite's inability to
 * `ALTER TABLE ... DROP CONSTRAINT`/`ALTER COLUMN`, which Postgres doesn't need).
 *
 * Translation decisions (see Phase 2 plan, "Data Layer Migration"):
 * - `INTEGER PRIMARY KEY AUTOINCREMENT` -> `integer().generatedAlwaysAsIdentity()`.
 * - `INTEGER CHECK (col IN (0,1))` booleans -> native `boolean()`.
 * - `TEXT ... DEFAULT (strftime(...))` audit timestamps -> `timestamp().defaultNow()`.
 *   Every other TEXT date/time-ish column (shift_date, start/end times,
 *   decided_at, etc.) had no strftime default in SQLite and stays `text()`
 *   here too — the app's own logic (`src/shared/logic/*`) already treats
 *   these as plain strings ("HH:MM" / "YYYY-MM-DD"), so there is nothing to
 *   convert.
 * - `TEXT ... CHECK (col IN (...))` fixed-value enums -> native Postgres
 *   enums via `pgEnum`, shared across tables where the same value set is
 *   reused (role, department, request status, anchors).
 * - `day_of_week INTEGER CHECK (BETWEEN 0 AND 6)` is a numeric range, not a
 *   fixed value set, so it stays `integer()` with an explicit Postgres
 *   `CHECK` constraint rather than becoming an enum.
 */

// Milestone 26: 'coordinator' added via a dedicated additive migration
// (`ALTER TYPE "role" ADD VALUE 'coordinator'`), mirroring the precedent set
// by 0001_many_eddie_brock.sql adding 'mechanic' to the department enum.
// Milestone 27 (Secretary Apps): 'secretary' added the same way — a role
// deliberately not granted any access to the normal scheduling app at all
// (see RequireAuth.tsx/RequireSecretaryAuth.tsx), reached only through its
// own login door at /secretary/login rather than the normal /login.
export const roleEnum = pgEnum('role', ['manager', 'employee', 'coordinator', 'secretary']);
export const departmentEnum = pgEnum('department', ['front_desk', 'cafe', 'bar', 'mechanic']);
export const requestStatusEnum = pgEnum('request_status', ['pending', 'approved', 'denied']);
export const startAnchorEnum = pgEnum('start_anchor', ['fixed', 'open']);
export const endAnchorEnum = pgEnum('end_anchor', ['fixed', 'close']);

// --- employees ---------------------------------------------------------
// Migration 001. Single `name` column (not split first/last) — confirmed
// against the actual `CREATE TABLE employees` statement.
export const employees = pgTable(
  'employees',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    name: text('name').notNull(),
    // Milestone 27: no plain `.unique()` here on purpose — that would only
    // reject an EXACT byte-for-byte duplicate, letting "Doug" and "doug"
    // coexist as two different accounts at the database level even though
    // `employeeRepo.findByUsername`'s login lookup already treats them as the
    // same username (case-insensitively). `employeeService.createEmployee`
    // already checks for a case-insensitive duplicate before insert, so this
    // was never reachable through the app's own UI — but the functional
    // unique index below (see the table's second argument) makes the
    // database itself the actual source of truth for "usernames are
    // case-insensitive," closing the gap for good rather than relying on
    // every future write path remembering to check case-insensitively first.
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull(),
    isSalaried: boolean('is_salaried').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    // Milestone 24 (SQLite migration 009 equivalent): global Schedule Board
    // row ordering, independent of department. See `domain-types.ts`'s
    // `Employee.sortOrder` doc comment.
    sortOrder: integer('sort_order').notNull().default(0),
    // Milestone 26: last time this employee opened the Notice Board — compared
    // against the newest active notice's `createdAt` to compute "unread"
    // status (nav badge + one-time login toast), rather than a separate
    // per-notice-per-employee read-tracking table. Null means "never opened
    // it," so any existing notice counts as unread.
    lastReadNoticesAt: timestamp('last_read_notices_at', { withTimezone: true }),
    // Session revocation: bumped on logout/deactivation. Every session JWT
    // embeds the value it was issued with; `resolveActor` rejects any token
    // whose embedded value doesn't match this current one, so a logged-out or
    // deactivated employee's existing token stops working immediately,
    // regardless of the cookie's own (still-valid-looking) expiry. See
    // `server/src/middleware/resolveActor.ts` and `auth.routes.ts`'s logout
    // handler for where this is actually enforced/bumped.
    sessionVersion: integer('session_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('employees_username_lower_key').on(sql`lower(${table.username})`)],
);

// --- employee_departments -----------------------------------------------
// Migration 001. Many-to-many employee <-> department.
export const employeeDepartments = pgTable(
  'employee_departments',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    department: departmentEnum('department').notNull(),
  },
  (table) => [
    unique('employee_departments_employee_id_department_key').on(
      table.employeeId,
      table.department,
    ),
    index('idx_employee_departments_employee_id').on(table.employeeId),
  ],
);

// --- shift_templates ------------------------------------------------------
// Migration 001, extended by 002 (is_active) and 005 (nullable department,
// nullable start/end time + start_anchor/end_anchor). `department` NULL means
// the template is usable from any of the three department tabs.
export const shiftTemplates = pgTable('shift_templates', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  department: departmentEnum('department'),
  name: text('name').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  startAnchor: startAnchorEnum('start_anchor').notNull().default('fixed'),
  endAnchor: endAnchorEnum('end_anchor').notNull().default('fixed'),
  color: text('color').notNull().default('#D97706'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- scheduled_shifts -------------------------------------------------
// Migration 001, extended by 002 (notes) and 006 (nullable start/end time +
// start_anchor/end_anchor, mirroring shift_templates).
export const scheduledShifts = pgTable(
  'scheduled_shifts',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    department: departmentEnum('department').notNull(),
    shiftDate: text('shift_date').notNull(),
    startTime: text('start_time'),
    endTime: text('end_time'),
    startAnchor: startAnchorEnum('start_anchor').notNull().default('fixed'),
    endAnchor: endAnchorEnum('end_anchor').notNull().default('fixed'),
    templateId: integer('template_id').references(() => shiftTemplates.id, {
      onDelete: 'set null',
    }),
    isOverride: boolean('is_override').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_scheduled_shifts_employee_id').on(table.employeeId),
    index('idx_scheduled_shifts_shift_date').on(table.shiftDate),
  ],
);

// --- schedule_publications -----------------------------------------------
// A department's week is invisible on employees' "My Schedule" until a
// manager explicitly publishes it here; the Schedule Board itself always
// shows everything to a manager regardless of publication state (see
// `scheduledShiftService.listWeek`'s actor-based gating). One row per
// (department, week_start) pair — publishing again (e.g. after editing an
// already-published week) just re-stamps who/when via upsert rather than
// growing a history of rows, since only the current publication state
// matters to the gate.
export const schedulePublications = pgTable(
  'schedule_publications',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    department: departmentEnum('department').notNull(),
    // Monday of the published week, YYYY-MM-DD — same string shape as
    // `scheduled_shifts.shift_date` and every week-scoped query in this app.
    weekStart: text('week_start').notNull(),
    publishedByEmployeeId: integer('published_by_employee_id')
      .notNull()
      .references(() => employees.id),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('schedule_publications_department_week_start_key').on(table.department, table.weekStart),
  ],
);

// --- time_off_requests --------------------------------------------------
// Migration 001, extended by 003 (decision_note).
export const timeOffRequests = pgTable(
  'time_off_requests',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    reason: text('reason'),
    status: requestStatusEnum('status').notNull().default('pending'),
    decidedBy: integer('decided_by').references(() => employees.id, { onDelete: 'set null' }),
    decidedAt: text('decided_at'),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_time_off_requests_employee_id').on(table.employeeId),
    index('idx_time_off_requests_status').on(table.status),
  ],
);

// --- employee_preferences ------------------------------------------------
// Migration 001, replaced by 004 (adds `note`, drops the
// `UNIQUE (employee_id, day_of_week)` constraint from 001 — a manager needs
// more than one preferred window per employee per day).
export const employeePreferences = pgTable(
  'employee_preferences',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    preferredStartTime: text('preferred_start_time'),
    preferredEndTime: text('preferred_end_time'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_employee_preferences_employee_id').on(table.employeeId),
    check('employee_preferences_day_of_week_check', sql`${table.dayOfWeek} BETWEEN 0 AND 6`),
  ],
);

// --- employee_unavailability ----------------------------------------------
// Migration 007. Recurring day-of-week + time-window HARD constraint, same
// pending/approved/denied workflow shape as time_off_requests, plus
// `requested_by` (the submitter — usually the employee, sometimes a manager
// submitting on the employee's behalf).
export const employeeUnavailability = pgTable(
  'employee_unavailability',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    reason: text('reason'),
    status: requestStatusEnum('status').notNull().default('pending'),
    requestedBy: integer('requested_by')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    decidedBy: integer('decided_by').references(() => employees.id, { onDelete: 'set null' }),
    decidedAt: text('decided_at'),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_employee_unavailability_employee_id').on(table.employeeId),
    index('idx_employee_unavailability_status').on(table.status),
    check('employee_unavailability_day_of_week_check', sql`${table.dayOfWeek} BETWEEN 0 AND 6`),
  ],
);

// --- store_hours ----------------------------------------------------------
// Migration 001, unchanged since.
export const storeHours = pgTable(
  'store_hours',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    dayOfWeek: integer('day_of_week').notNull().unique(),
    openTime: text('open_time'),
    closeTime: text('close_time'),
    isClosed: boolean('is_closed').notNull().default(false),
  },
  (table) => [check('store_hours_day_of_week_check', sql`${table.dayOfWeek} BETWEEN 0 AND 6`)],
);

// --- special_event_overrides -----------------------------------------------
// Migration 001, unchanged since.
export const specialEventOverrides = pgTable('special_event_overrides', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  eventDate: text('event_date').notNull().unique(),
  label: text('label').notNull(),
  isClosed: boolean('is_closed').notNull().default(false),
  openTime: text('open_time'),
  closeTime: text('close_time'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- notices ----------------------------------------------------------
// Milestone 26: notice board announcements (e.g. new specials), postable by
// a manager or the new 'coordinator' role, readable by every employee.
// `postedByEmployeeId` uses `onDelete: 'restrict'` (the default) rather than
// `cascade`/`set null` — employees are never hard-deleted in this app (only
// deactivated), so a notice's author reference is expected to always
// resolve; restricting matches that invariant instead of quietly hiding a
// violation of it.
export const notices = pgTable(
  'notices',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    postedByEmployeeId: integer('posted_by_employee_id')
      .notNull()
      .references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // Optional — a notice with no expiration stays visible until manually removed.
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [index('idx_notices_created_at').on(table.createdAt)],
);
