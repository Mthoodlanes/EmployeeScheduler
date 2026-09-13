/**
 * Milestone 19: fetch-based implementation of the `Api` shape (see
 * `src/preload/index.ts`) for contexts with no Electron preload — a plain
 * browser tab or installed PWA. `client.ts` uses this whenever `window.api`
 * is undefined at module load.
 *
 * Every method here has the exact same name/signature/return shape as its
 * IPC counterpart in the preload bridge, targeting the Milestone 18 HTTP
 * routes (`server/src/routes/*.routes.ts`) instead of `ipcRenderer.invoke`.
 * That symmetry is what lets every page/hook in the renderer import `{ api }`
 * from `client.ts` without caring which implementation backs it.
 *
 * Two response shapes exist server-side, mirrored here by two small request
 * helpers:
 *  - The 8 feature routers (`/api/employees`, `/api/shift-templates`, ...)
 *    all wrap responses in the `{ok:true,data}` / `{ok:false,error}`
 *    envelope via `server/src/routes/httpResult.ts`'s `handleRoute` — see
 *    `request()` below, which unwraps it exactly like the old
 *    `ipcRenderer.invoke` + `toIpcResult` round trip did.
 *  - `/api/auth/*` (Milestone 17) deliberately predates that envelope and
 *    returns plain bodies (an `Employee` object, `{isFirstRun}`, or
 *    `{error}` on failure) — see `authRequest()`.
 *
 * `credentials: 'include'` is required on every call so the httpOnly JWT
 * session cookie is sent, both same-origin (production, Milestone 20) and
 * cross-origin (local dev — see `VITE_API_BASE_URL` below).
 */
import type {
  CreateFirstManagerRequest,
  CreateFirstManagerResponse,
  EmployeesCreateRequest,
  EmployeesCreateResponse,
  EmployeesDeactivateRequest,
  EmployeesDeactivateResponse,
  EmployeesListResponse,
  EmployeesReorderRequest,
  EmployeesReorderResponse,
  EmployeesSetDepartmentsRequest,
  EmployeesSetDepartmentsResponse,
  EmployeesUpdateOwnProfileRequest,
  EmployeesUpdateOwnProfileResponse,
  EmployeesUpdateRequest,
  EmployeesUpdateResponse,
  FirstRunStatusResponse,
  GetSessionResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  PreferencesCreateRequest,
  PreferencesCreateResponse,
  PreferencesListAllResponse,
  PreferencesListForEmployeeRequest,
  PreferencesListForEmployeeResponse,
  PreferencesRemoveRequest,
  PreferencesRemoveResponse,
  PreferencesUpdateRequest,
  PreferencesUpdateResponse,
  ScheduledShiftsAssignCustomRequest,
  ScheduledShiftsAssignCustomResponse,
  ScheduledShiftsAssignTemplateRequest,
  ScheduledShiftsAssignTemplateResponse,
  ScheduledShiftsListWeekRequest,
  ScheduledShiftsListWeekResponse,
  ScheduledShiftsOverrideRequest,
  ScheduledShiftsOverrideResponse,
  ScheduledShiftsRemoveRequest,
  ScheduledShiftsRemoveResponse,
  ShiftTemplatesCreateRequest,
  ShiftTemplatesCreateResponse,
  ShiftTemplatesDeactivateRequest,
  ShiftTemplatesDeactivateResponse,
  ShiftTemplatesListResponse,
  ShiftTemplatesUpdateRequest,
  ShiftTemplatesUpdateResponse,
  SpecialEventsCreateRequest,
  SpecialEventsCreateResponse,
  SpecialEventsListResponse,
  SpecialEventsRemoveRequest,
  SpecialEventsRemoveResponse,
  SpecialEventsUpdateRequest,
  SpecialEventsUpdateResponse,
  StoreHoursListResponse,
  StoreHoursUpsertRequest,
  StoreHoursUpsertResponse,
  TimeOffCreateForEmployeeRequest,
  TimeOffCreateForEmployeeResponse,
  TimeOffCreateRequestRequest,
  TimeOffCreateRequestResponse,
  TimeOffDecideRequest,
  TimeOffDecideResponse,
  TimeOffListAllResponse,
  TimeOffListApprovedForRangeRequest,
  TimeOffListApprovedForRangeResponse,
  TimeOffListOwnResponse,
  UnavailabilityCreateForEmployeeRequest,
  UnavailabilityCreateForEmployeeResponse,
  UnavailabilityCreateOwnRequestRequest,
  UnavailabilityCreateOwnRequestResponse,
  UnavailabilityDecideRequest,
  UnavailabilityDecideResponse,
  UnavailabilityListAllResponse,
  UnavailabilityListApprovedAllResponse,
  UnavailabilityListOwnResponse,
} from '@shared/types/ipc';

/**
 * `Api`'s canonical definition lives in `src/preload/index.ts`. It's pulled
 * in structurally here via the global `Window.api` augmentation
 * (`env.d.ts`) rather than an explicit import of that module, because
 * `src/preload` and `src/renderer` are checked as separate TypeScript
 * composite projects (`tsconfig.node.json` / `tsconfig.web.json`) — an
 * explicit cross-project import from a regular source file trips TS6307
 * ("File ... is not listed within the file list of project ...").
 */
type Api = NonNullable<Window['api']>;

/** See `env.d.ts` for the `ImportMetaEnv` declaration. Trims a trailing slash so callers can join with `${API_BASE}/path` uniformly. */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string };

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorMessageOf(body: unknown): string | undefined {
  if (
    body !== null &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    return (body as { error: string }).error;
  }
  return undefined;
}

/** Query-string builder for the handful of GET routes that take params. */
function toQuery(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `?${qs}` : '';
}

/** Request helper for the 8 `{ok,data}`-enveloped feature routers. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body = await safeJson(response);
  const envelope = body as Envelope<T> | null;
  if (!envelope || envelope.ok !== true) {
    throw new Error(
      (envelope && envelope.ok === false ? envelope.error : undefined) ??
        `Request to ${path} failed with status ${response.status}`,
    );
  }
  return envelope.data;
}

const get = <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' });
const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
const put = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined });
const del = <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' });

/** Request helper for the plain-bodied `/api/auth/*` routes (see file header). */
async function authRequest<T>(path: string, init?: RequestInit): Promise<{ response: Response; body: T | null }> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body = (await safeJson(response)) as T | null;
  return { response, body };
}

const auth: Api['auth'] = {
  login: async (loginRequest: LoginRequest) => {
    const { response, body } = await authRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginRequest),
    });
    if (!response.ok) {
      throw new Error(errorMessageOf(body) ?? 'Login failed');
    }
    return body as LoginResponse;
  },
  logout: async () => {
    const { response, body } = await authRequest<unknown>('/auth/logout', { method: 'POST' });
    if (!response.ok) {
      throw new Error(errorMessageOf(body) ?? 'Logout failed');
    }
    return { success: true } satisfies LogoutResponse;
  },
  getSession: async () => {
    const { response, body } = await authRequest<GetSessionResponse>('/auth/me');
    if (response.status === 401) {
      // No/expired session — the IPC-era `session.getCurrent()` this
      // replaces also resolves `null` rather than throwing in this case.
      return null;
    }
    if (!response.ok) {
      throw new Error(errorMessageOf(body) ?? 'Failed to load session');
    }
    return body;
  },
  firstRunStatus: async () => {
    const { response, body } = await authRequest<FirstRunStatusResponse>('/auth/first-run-status');
    if (!response.ok) {
      throw new Error(errorMessageOf(body) ?? 'Failed to load first-run status');
    }
    return body as FirstRunStatusResponse;
  },
  createFirstManager: async (createRequest: CreateFirstManagerRequest) => {
    const { response, body } = await authRequest<CreateFirstManagerResponse>('/auth/first-run', {
      method: 'POST',
      body: JSON.stringify(createRequest),
    });
    if (!response.ok) {
      throw new Error(errorMessageOf(body) ?? 'Failed to create the first manager account');
    }
    return body as CreateFirstManagerResponse;
  },
};

const employees: Api['employees'] = {
  list: () => get<EmployeesListResponse>('/employees'),
  create: (createRequest: EmployeesCreateRequest) =>
    post<EmployeesCreateResponse>('/employees', createRequest),
  update: (updateRequest: EmployeesUpdateRequest) =>
    put<EmployeesUpdateResponse>(`/employees/${updateRequest.id}`, updateRequest),
  deactivate: (deactivateRequest: EmployeesDeactivateRequest) =>
    post<EmployeesDeactivateResponse>(`/employees/${deactivateRequest.id}/deactivate`),
  setDepartments: (setDepartmentsRequest: EmployeesSetDepartmentsRequest) =>
    put<EmployeesSetDepartmentsResponse>(`/employees/${setDepartmentsRequest.id}/departments`, {
      departments: setDepartmentsRequest.departments,
    }),
  updateOwnProfile: (updateOwnProfileRequest: EmployeesUpdateOwnProfileRequest) =>
    put<EmployeesUpdateOwnProfileResponse>('/employees/me', updateOwnProfileRequest),
  reorder: (reorderRequest: EmployeesReorderRequest) =>
    put<EmployeesReorderResponse>('/employees/reorder', reorderRequest),
};

const shiftTemplates: Api['shiftTemplates'] = {
  list: () => get<ShiftTemplatesListResponse>('/shift-templates'),
  create: (createRequest: ShiftTemplatesCreateRequest) =>
    post<ShiftTemplatesCreateResponse>('/shift-templates', createRequest),
  update: (updateRequest: ShiftTemplatesUpdateRequest) =>
    put<ShiftTemplatesUpdateResponse>(`/shift-templates/${updateRequest.id}`, updateRequest),
  deactivate: (deactivateRequest: ShiftTemplatesDeactivateRequest) =>
    post<ShiftTemplatesDeactivateResponse>(`/shift-templates/${deactivateRequest.id}/deactivate`),
};

const scheduledShifts: Api['scheduledShifts'] = {
  listWeek: (listWeekRequest: ScheduledShiftsListWeekRequest) =>
    get<ScheduledShiftsListWeekResponse>(
      `/scheduled-shifts${toQuery({
        department: listWeekRequest.department,
        weekStart: listWeekRequest.weekStart,
      })}`,
    ),
  assignTemplate: (assignRequest: ScheduledShiftsAssignTemplateRequest) =>
    post<ScheduledShiftsAssignTemplateResponse>('/scheduled-shifts/assign-template', assignRequest),
  assignCustom: (assignRequest: ScheduledShiftsAssignCustomRequest) =>
    post<ScheduledShiftsAssignCustomResponse>('/scheduled-shifts/assign-custom', assignRequest),
  override: (overrideRequest: ScheduledShiftsOverrideRequest) =>
    put<ScheduledShiftsOverrideResponse>(`/scheduled-shifts/${overrideRequest.id}`, overrideRequest),
  remove: (removeRequest: ScheduledShiftsRemoveRequest) =>
    del<ScheduledShiftsRemoveResponse>(`/scheduled-shifts/${removeRequest.id}`),
};

const timeOff: Api['timeOff'] = {
  createRequest: (createRequest: TimeOffCreateRequestRequest) =>
    post<TimeOffCreateRequestResponse>('/time-off', createRequest),
  createForEmployee: (createRequest: TimeOffCreateForEmployeeRequest) =>
    post<TimeOffCreateForEmployeeResponse>('/time-off/for-employee', createRequest),
  listOwn: () => get<TimeOffListOwnResponse>('/time-off/own'),
  listAll: () => get<TimeOffListAllResponse>('/time-off'),
  decide: (decideRequest: TimeOffDecideRequest) =>
    post<TimeOffDecideResponse>(`/time-off/${decideRequest.id}/decide`, decideRequest),
  listApprovedForRange: (rangeRequest: TimeOffListApprovedForRangeRequest) =>
    get<TimeOffListApprovedForRangeResponse>(
      `/time-off/approved${toQuery({
        startDate: rangeRequest.startDate,
        endDate: rangeRequest.endDate,
      })}`,
    ),
};

const unavailability: Api['unavailability'] = {
  createOwnRequest: (createRequest: UnavailabilityCreateOwnRequestRequest) =>
    post<UnavailabilityCreateOwnRequestResponse>('/unavailability', createRequest),
  createForEmployee: (createRequest: UnavailabilityCreateForEmployeeRequest) =>
    post<UnavailabilityCreateForEmployeeResponse>('/unavailability/for-employee', createRequest),
  listOwn: () => get<UnavailabilityListOwnResponse>('/unavailability/own'),
  listAll: () => get<UnavailabilityListAllResponse>('/unavailability'),
  listApprovedAll: () => get<UnavailabilityListApprovedAllResponse>('/unavailability/approved'),
  decide: (decideRequest: UnavailabilityDecideRequest) =>
    post<UnavailabilityDecideResponse>(`/unavailability/${decideRequest.id}/decide`, decideRequest),
};

const preferences: Api['preferences'] = {
  listAll: () => get<PreferencesListAllResponse>('/preferences'),
  listForEmployee: (listRequest: PreferencesListForEmployeeRequest) =>
    get<PreferencesListForEmployeeResponse>(`/preferences/employee/${listRequest.employeeId}`),
  create: (createRequest: PreferencesCreateRequest) =>
    post<PreferencesCreateResponse>('/preferences', createRequest),
  update: (updateRequest: PreferencesUpdateRequest) =>
    put<PreferencesUpdateResponse>(`/preferences/${updateRequest.id}`, updateRequest),
  remove: (removeRequest: PreferencesRemoveRequest) =>
    del<PreferencesRemoveResponse>(`/preferences/${removeRequest.id}`),
};

const storeHours: Api['storeHours'] = {
  list: () => get<StoreHoursListResponse>('/store-hours'),
  upsert: (upsertRequest: StoreHoursUpsertRequest) =>
    put<StoreHoursUpsertResponse>(`/store-hours/${upsertRequest.dayOfWeek}`, upsertRequest),
};

const specialEvents: Api['specialEvents'] = {
  list: () => get<SpecialEventsListResponse>('/special-events'),
  create: (createRequest: SpecialEventsCreateRequest) =>
    post<SpecialEventsCreateResponse>('/special-events', createRequest),
  update: (updateRequest: SpecialEventsUpdateRequest) =>
    put<SpecialEventsUpdateResponse>(`/special-events/${updateRequest.id}`, updateRequest),
  remove: (removeRequest: SpecialEventsRemoveRequest) =>
    del<SpecialEventsRemoveResponse>(`/special-events/${removeRequest.id}`),
};

/**
 * Milestone 19 explicitly excludes `windowControls` from the HTTP rewrite —
 * it has no web equivalent and isn't part of the Milestone 18 route surface.
 * `TitleBar`/`WindowControls` (see those components) render unconditionally
 * today and call these methods regardless of context, so this stays present
 * as inert stubs purely to avoid crashing a plain browser/PWA session; giving
 * the browser its own feature-detected chrome-free layout is Milestone 22.
 */
const windowControls: Api['windowControls'] = {
  minimize: () => Promise.resolve({ success: true }),
  toggleMaximize: () => Promise.resolve({ isMaximized: false }),
  close: () => Promise.resolve({ success: true }),
  isMaximized: () => Promise.resolve(false),
  onMaximizedChange: () => () => {},
};

export const httpApi: Api = {
  auth,
  employees,
  shiftTemplates,
  scheduledShifts,
  timeOff,
  unavailability,
  preferences,
  storeHours,
  specialEvents,
  windowControls,
};
