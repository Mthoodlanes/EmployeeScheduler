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

export type Department = 'front_desk' | 'cafe' | 'bar' | 'mechanic';

export type Role = 'manager' | 'employee' | 'coordinator' | 'secretary';

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
  /** Grants Secretary-area access independent of `role` — see schema.ts's `is_secretary_tagged` column comment. */
  isSecretaryTagged: boolean;
}

export interface Employee {
  id: number;
  name: string;
  username: string;
  role: Role;
  isSalaried: boolean;
  isActive: boolean;
  /** Grants Secretary-area access independent of `role` — see schema.ts's column comment. */
  isSecretaryTagged: boolean;
  /**
   * Global position on the Schedule Board (ascending), independent of
   * department — an employee working multiple departments has one
   * consistent position everywhere. Drives `employeeRepo.listAll()`'s
   * default order; `EmployeesAdminPage` sorts by name client-side instead.
   */
  sortOrder: number;
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

/** A department's week becomes visible on "My Schedule" once this exists for it. */
export interface SchedulePublication {
  id: number;
  department: Department;
  weekStart: string;
  publishedByEmployeeId: number;
  publishedAt: string;
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

/**
 * A notice-board announcement (e.g. a new special) posted by a manager or
 * coordinator, readable by every employee. `postedByName` is denormalized
 * from a join against `employees` at read time purely for display — the
 * canonical author reference is `postedByEmployeeId`.
 */
export interface Notice {
  id: number;
  title: string;
  body: string;
  postedByEmployeeId: number;
  postedByName: string;
  createdAt: string;
  updatedAt: string;
  /** Optional — a notice with no expiration stays visible indefinitely until removed. */
  expiresAt: string | null;
}

// ---------------------------------------------------------------------
// Secretary Apps: bowling dues tracker. Field-for-field identical to
// `src/shared/types/domain.ts`'s copies — see this file's header for why
// they're duplicated rather than imported.
// ---------------------------------------------------------------------

export type BowlerStatus = 'active' | 'left';

export interface League {
  id: number;
  name: string;
  spotsPerTeam: number;
  numWeeks: number;
  currentWeek: number;
  prizeFund: number;
  lineage: number;
  sweeperActive: boolean;
  sweeperAmount: number;
  vacancyFee: number;
  lineageDiscountAmount: number;
  prizeFundDiscountAmount: number;
  sponsorFeePerTeam: number;
  sponsorFeeActive: boolean;
  depositFeeActive: boolean;
  depositFeeAmount: number;
  sponsorFeeDueWeek: number;
  prizeFundCoverChargeDueWeek: number;
  lastTwoWeeksDueWeek: number;
  sanctionedLeague: boolean;
  createdByEmployeeId: number;
  createdAt: string;
  updatedAt: string;
}

export interface DuesTeam {
  id: number;
  leagueId: number;
  name: string;
  folded: boolean;
  sponsorPaid: number;
}

export interface Bowler {
  id: number;
  teamId: number;
  name: string;
  status: BowlerStatus;
  phone: string;
  lineageDiscount: boolean;
  prizeFundDiscount: boolean;
  dropNoticeWeek: string;
  notes: string;
  depositPaid: number;
  depositOptOut: boolean;
  usbcCardPaid: boolean;
  lastTwoWeeksPaid: number;
}

export interface WeeklyEntry {
  id: number;
  bowlerId: number;
  week: number;
  amountPaid: number;
}
