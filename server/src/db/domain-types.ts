/**
 * Milestone 15: domain type mirror for the Postgres repo layer.
 *
 * These intentionally DUPLICATE (never import) the shapes declared in
 * `src/shared/types/domain.ts`. Two hard constraints rule out importing that
 * file directly:
 *   1. The migration plan forbids touching anything under `src/shared`.
 *   2. `tsconfig.server.json` scopes `rootDir`/`include` to `server/src` only
 *      (TS6059) — widening `rootDir` to the repo root to reach `src/shared`
 *      would also change `dist-server`'s emitted layout and break the
 *      `server:start` script's hardcoded `node dist-server/index.js` path.
 *
 * Per the Phase 2 plan, `src/shared`'s role shrinks over time anyway
 * (Milestone 23 strips the Electron shell to window chrome only) — these are
 * the server's own canonical copies of the same shapes going forward, kept
 * field-for-field identical to `src/shared/types/domain.ts` on purpose so
 * every repo function's return shape matches the original SQLite repos.
 */

export type Department = 'front_desk' | 'cafe' | 'bar';

export type Role = 'manager' | 'employee';

/**
 * Milestone 16: the employee performing an action, as will be established by
 * the request-scoped JWT auth middleware added in Milestone 17 (`req.actor`)
 * — replaces `src/main/session.ts`'s module-level singleton from Phase 1.
 * Defined once here (rather than redeclared per service file, as the
 * original `src/main/services/*.ts` each did) since all 9 ported services
 * now share this exact shape as their uniform authorization signature.
 */
export interface RequestingActor {
  id: number;
  role: Role;
}

export interface Employee {
  id: number;
  name: string;
  username: string;
  role: Role;
  isSalaried: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Employee record including the password hash, used only by auth code. */
export interface EmployeeWithHash extends Employee {
  passwordHash: string;
}

export type StartAnchor = 'fixed' | 'open';
export type EndAnchor = 'fixed' | 'close';

export interface ShiftTemplate {
  id: number;
  department: Department | null;
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledShift {
  id: number;
  employeeId: number;
  department: Department;
  shiftDate: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  templateId: number | null;
  isOverride: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'denied';
export type TimeOffStatus = ApprovalStatus;
export type UnavailabilityStatus = ApprovalStatus;

export interface TimeOffRequest {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: TimeOffStatus;
  decidedBy: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeUnavailability {
  id: number;
  employeeId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  reason: string | null;
  status: UnavailabilityStatus;
  requestedBy: number;
  decidedBy: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeePreference {
  id: number;
  employeeId: number;
  dayOfWeek: number;
  preferredStartTime: string | null;
  preferredEndTime: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreHours {
  id: number;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

export interface SpecialEventOverride {
  id: number;
  eventDate: string;
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  createdAt: string;
  updatedAt: string;
}
