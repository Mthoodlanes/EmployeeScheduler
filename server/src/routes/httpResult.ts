/**
 * Milestone 18: HTTP counterpart to `src/main/ipc/ipcResult.ts`'s
 * `toIpcResult` helper. Every one of the 8 new feature route files wraps its
 * handlers in `handleRoute` so the `{ok:true,data}` / `{ok:false,error}`
 * envelope the renderer already expects survives the IPC -> HTTP port
 * unchanged, regardless of which HTTP status code accompanies it.
 *
 * Error -> status mapping: each of the 9 ported services' custom error
 * classes is matched via `instanceof` against `ERROR_STATUS_MAP` below and
 * mapped to the most appropriate status:
 *   - 404 – the operation targeted a specific row that doesn't exist.
 *   - 409 – the request conflicts with existing state (duplicate username,
 *     an already-completed first run, an invalid pending/approved/denied
 *     transition).
 *   - 403 – the actor is authenticated (guaranteed by `requireAuth` before a
 *     handler ever runs) but lacks the role the action requires. `401` is
 *     deliberately reserved for "not authenticated at all", which
 *     `requireAuth` itself already returns — no service-level error needs to
 *     map there except `InvalidCredentialsError` (login is handled entirely
 *     by `auth.routes.ts`, not this milestone's routes, but the mapping is
 *     included here for completeness since `handleRoute` is a general-purpose
 *     helper).
 *   - 400 – `DepartmentMismatchError` (a request that doesn't apply to the
 *     resource it targets) plus every OTHER `Error` instance not otherwise
 *     recognized. In this codebase, an unrecognized plain `Error` is always a
 *     hand-thrown business-rule/validation failure (e.g. "End date must be on
 *     or after the start date") — the services never let infra failures
 *     surface as bare `Error`, so treating the fallback as a client-input
 *     problem rather than a server problem matches how these services
 *     actually throw.
 *   - 500 – reserved for the truly unrecognized case: something was thrown
 *     that isn't even an `Error` instance.
 */
import type { Request, RequestHandler, Response } from 'express';
import {
  DuplicateUsernameError,
  UnauthorizedEmployeeActionError,
} from '../services/employeeService.js';
import { UnauthorizedShiftTemplateActionError } from '../services/shiftTemplateService.js';
import {
  DepartmentMismatchError,
  ShiftTemplateNotFoundError,
  UnauthorizedScheduledShiftActionError,
} from '../services/scheduledShiftService.js';
import {
  InvalidApprovalTransitionError,
  TimeOffRequestNotFoundError,
  UnauthorizedTimeOffActionError,
} from '../services/timeOffService.js';
import {
  UnauthorizedUnavailabilityActionError,
  UnavailabilityRequestNotFoundError,
} from '../services/unavailabilityService.js';
import {
  PreferenceNotFoundError,
  UnauthorizedPreferenceActionError,
} from '../services/preferenceService.js';
import { UnauthorizedStoreHoursActionError } from '../services/storeHoursService.js';
import {
  SpecialEventNotFoundError,
  UnauthorizedSpecialEventActionError,
} from '../services/specialEventService.js';
import { FirstRunAlreadyCompleteError, InvalidCredentialsError } from '../services/authService.js';
import { NoticeNotFoundError, UnauthorizedNoticeActionError } from '../services/noticeService.js';

interface ErrorMapping {
  ctor: new (...args: never[]) => Error;
  status: number;
}

const ERROR_STATUS_MAP: ErrorMapping[] = [
  // 404 – not found
  { ctor: ShiftTemplateNotFoundError, status: 404 },
  { ctor: TimeOffRequestNotFoundError, status: 404 },
  { ctor: UnavailabilityRequestNotFoundError, status: 404 },
  { ctor: PreferenceNotFoundError, status: 404 },
  { ctor: SpecialEventNotFoundError, status: 404 },
  { ctor: NoticeNotFoundError, status: 404 },
  // 409 – conflict
  { ctor: DuplicateUsernameError, status: 409 },
  { ctor: InvalidApprovalTransitionError, status: 409 },
  { ctor: FirstRunAlreadyCompleteError, status: 409 },
  // 403 – authenticated but wrong role
  { ctor: UnauthorizedEmployeeActionError, status: 403 },
  { ctor: UnauthorizedShiftTemplateActionError, status: 403 },
  { ctor: UnauthorizedScheduledShiftActionError, status: 403 },
  { ctor: UnauthorizedTimeOffActionError, status: 403 },
  { ctor: UnauthorizedUnavailabilityActionError, status: 403 },
  { ctor: UnauthorizedPreferenceActionError, status: 403 },
  { ctor: UnauthorizedStoreHoursActionError, status: 403 },
  { ctor: UnauthorizedSpecialEventActionError, status: 403 },
  { ctor: UnauthorizedNoticeActionError, status: 403 },
  // 401 – not authenticated at all (login only; unused by this milestone's
  // routes, kept here so the mapping table documents every known error).
  { ctor: InvalidCredentialsError, status: 401 },
  // 400 – bad request / domain validation
  { ctor: DepartmentMismatchError, status: 400 },
];

function statusForError(error: unknown): number {
  if (error instanceof Error) {
    const match = ERROR_STATUS_MAP.find(({ ctor }) => error instanceof ctor);
    return match ? match.status : 400;
  }
  return 500;
}

/**
 * Drizzle wraps a failed query in a `DrizzleQueryError` whose own `.message`
 * is just `Failed query: <sql>\nparams: <params>` — the actual reason (a
 * constraint violation, a missing table, etc.) lives on `.cause`, the
 * underlying driver error, which would otherwise never reach the client or
 * the log line below.
 */
function messageForError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error';
  }
  if (error.cause instanceof Error) {
    return `${error.message}: ${error.cause.message}`;
  }
  return error.message;
}

/**
 * Wraps a route handler body: on success responds `{ok:true,data}` with
 * `successStatus` (default `200`; pass `201` for a create endpoint); on a
 * thrown error, maps it to a status via `statusForError` above and responds
 * `{ok:false,error:message}` regardless of status code, so the client-side
 * envelope shape is uniform no matter what happened.
 */
export function handleRoute(
  fn: (req: Request, res: Response) => unknown | Promise<unknown>,
  successStatus = 200,
): RequestHandler {
  return async (req, res) => {
    try {
      const data = await fn(req, res);
      res.status(successStatus).json({ ok: true, data });
    } catch (error) {
      const status = statusForError(error);
      const message = messageForError(error);
      // Milestone 25: a plain hand-thrown Error (validation failure,
      // not-found, wrong role) needs no log noise. A bare non-Error throw
      // (status 500) or an Error with a `.cause` (an infra-level failure like
      // `DrizzleQueryError` — see `messageForError` above) is always worth
      // surfacing for basic error monitoring (visible in Render's log
      // dashboard), regardless of which status it got mapped to.
      if (status === 500 || (error instanceof Error && error.cause instanceof Error)) {
        // eslint-disable-next-line no-console -- see comment above
        console.error(`Unexpected error on ${req.method} ${req.originalUrl}:`, error);
      }
      res.status(status).json({ ok: false, error: message });
    }
  };
}
