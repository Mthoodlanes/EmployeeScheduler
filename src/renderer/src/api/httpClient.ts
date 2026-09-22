/**
 * Milestone 19: fetch-based implementation of the `Api` shape (see the
 * `Api` interface below). Originally used only for contexts with no
 * Electron preload — a plain browser tab or installed PWA. Since Milestone
 * 23 (the Electron shell now just loads the hosted site instead of running
 * its own local backend) this is ALSO the implementation for every data
 * namespace inside the Electron shell itself — only `windowControls` still
 * comes from the real preload bridge there. See `client.ts`'s merge logic.
 *
 * Every method here has the exact same name/signature/return shape its IPC
 * counterpart had back when the preload exposed every namespace, targeting
 * the Milestone 18 HTTP routes (`server/src/routes/*.routes.ts`) instead of
 * `ipcRenderer.invoke`. That symmetry is what lets every page/hook in the
 * renderer import `{ api }` from `client.ts` without caring which
 * implementation backs it.
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
  ScheduledShiftsCarryOverWeekRequest,
  ScheduledShiftsCarryOverWeekResponse,
  ScheduledShiftsGetPublicationRequest,
  ScheduledShiftsGetPublicationResponse,
  ScheduledShiftsListWeekRequest,
  ScheduledShiftsListWeekResponse,
  ScheduledShiftsOverrideRequest,
  ScheduledShiftsOverrideResponse,
  ScheduledShiftsPublishRequest,
  ScheduledShiftsPublishResponse,
  ScheduledShiftsRemoveRequest,
  ScheduledShiftsRemoveResponse,
  ScheduledShiftsUnpublishRequest,
  ScheduledShiftsUnpublishResponse,
  ShiftTemplatesCreateRequest,
  ShiftTemplatesCreateResponse,
  ShiftTemplatesDeactivateRequest,
  ShiftTemplatesDeactivateResponse,
  ShiftTemplatesListResponse,
  ShiftTemplatesUpdateRequest,
  ShiftTemplatesUpdateResponse,
  NoticesCreateRequest,
  NoticesCreateResponse,
  NoticesListResponse,
  NoticesMarkReadResponse,
  NoticesRemoveRequest,
  NoticesRemoveResponse,
  NoticesUnreadStatusResponse,
  NoticesUpdateRequest,
  NoticesUpdateResponse,
  SpecialEventsCreateRequest,
  SpecialEventsCreateResponse,
  SpecialEventsListResponse,
  SpecialEventsRemoveRequest,
  SpecialEventsRemoveResponse,
  SpecialEventsUpdateRequest,
  SpecialEventsUpdateResponse,
  SecretaryLeaguesCreateRequest,
  SecretaryLeaguesCreateResponse,
  SecretaryLeaguesGetResponse,
  SecretaryLeaguesListResponse,
  SecretaryLeaguesRemoveRequest,
  SecretaryLeaguesRemoveResponse,
  SecretaryLeaguesUpdateRequest,
  SecretaryLeaguesUpdateResponse,
  SecretaryTeamsCreateRequest,
  SecretaryTeamsCreateResponse,
  SecretaryTeamsListForLeagueRequest,
  SecretaryTeamsListForLeagueResponse,
  SecretaryTeamsRemoveEmptyRequest,
  SecretaryTeamsRemoveEmptyResponse,
  SecretaryTeamsRemoveRequest,
  SecretaryTeamsRemoveResponse,
  SecretaryTeamsUpdateRequest,
  SecretaryTeamsUpdateResponse,
  SecretaryBowlersCreateRequest,
  SecretaryBowlersCreateResponse,
  SecretaryBowlersListForLeagueRequest,
  SecretaryBowlersListForLeagueResponse,
  SecretaryBowlersListForTeamRequest,
  SecretaryBowlersListForTeamResponse,
  SecretaryBowlersRemoveRequest,
  SecretaryBowlersRemoveResponse,
  SecretaryBowlersUpdateRequest,
  SecretaryBowlersUpdateResponse,
  SecretaryWeeklyEntriesListForLeagueRequest,
  SecretaryWeeklyEntriesListForLeagueResponse,
  SecretaryWeeklyEntriesRecordRequest,
  SecretaryWeeklyEntriesRecordResponse,
  SecretaryWeeklyEntriesRemoveRequest,
  SecretaryWeeklyEntriesRemoveResponse,
  SecretaryBackupsListResponse,
  SecretaryBackupsCreateRequest,
  SecretaryBackupsCreateResponse,
  SecretaryBackupsRestoreRequest,
  SecretaryBackupsRestoreResponse,
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
  WindowControlsCloseResponse,
  WindowControlsIsMaximizedResponse,
  WindowControlsMaximizedChangedPayload,
  WindowControlsMinimizeResponse,
  WindowControlsToggleMaximizeResponse,
} from '@shared/types/ipc';

/**
 * Canonical shape of the whole app-facing `api` surface — every namespace
 * the renderer calls through `client.ts`, not just the ones this file backs.
 *
 * Before Milestone 23 this was derived structurally from `Window['api']`
 * (the Electron preload's own exported `Api` type), which worked because
 * the preload exposed every namespace, making it a safe stand-in for "the
 * full contract". Milestone 23 shrinks the preload down to `windowControls`
 * only (see `src/preload/index.ts` — the shell now loads the hosted site
 * directly, so every data namespace goes over `fetch` instead of IPC), so
 * `Window['api']`'s shape no longer covers `auth`/`employees`/etc. and can
 * no longer be reused here. This interface is now the source of truth for
 * the full contract, built from the same request/response types the HTTP
 * implementations below already import — `client.ts` imports it from here
 * (not from the preload) to type its merged `api` export.
 */
export interface Api {
  auth: {
    login: (request: LoginRequest) => Promise<LoginResponse>;
    logout: () => Promise<LogoutResponse>;
    getSession: () => Promise<GetSessionResponse>;
    firstRunStatus: () => Promise<FirstRunStatusResponse>;
    createFirstManager: (request: CreateFirstManagerRequest) => Promise<CreateFirstManagerResponse>;
  };
  employees: {
    list: () => Promise<EmployeesListResponse>;
    create: (request: EmployeesCreateRequest) => Promise<EmployeesCreateResponse>;
    update: (request: EmployeesUpdateRequest) => Promise<EmployeesUpdateResponse>;
    deactivate: (request: EmployeesDeactivateRequest) => Promise<EmployeesDeactivateResponse>;
    setDepartments: (
      request: EmployeesSetDepartmentsRequest,
    ) => Promise<EmployeesSetDepartmentsResponse>;
    updateOwnProfile: (
      request: EmployeesUpdateOwnProfileRequest,
    ) => Promise<EmployeesUpdateOwnProfileResponse>;
    reorder: (request: EmployeesReorderRequest) => Promise<EmployeesReorderResponse>;
  };
  shiftTemplates: {
    list: () => Promise<ShiftTemplatesListResponse>;
    create: (request: ShiftTemplatesCreateRequest) => Promise<ShiftTemplatesCreateResponse>;
    update: (request: ShiftTemplatesUpdateRequest) => Promise<ShiftTemplatesUpdateResponse>;
    deactivate: (
      request: ShiftTemplatesDeactivateRequest,
    ) => Promise<ShiftTemplatesDeactivateResponse>;
  };
  scheduledShifts: {
    listWeek: (request: ScheduledShiftsListWeekRequest) => Promise<ScheduledShiftsListWeekResponse>;
    getPublication: (
      request: ScheduledShiftsGetPublicationRequest,
    ) => Promise<ScheduledShiftsGetPublicationResponse>;
    publish: (request: ScheduledShiftsPublishRequest) => Promise<ScheduledShiftsPublishResponse>;
    unpublish: (
      request: ScheduledShiftsUnpublishRequest,
    ) => Promise<ScheduledShiftsUnpublishResponse>;
    assignTemplate: (
      request: ScheduledShiftsAssignTemplateRequest,
    ) => Promise<ScheduledShiftsAssignTemplateResponse>;
    assignCustom: (
      request: ScheduledShiftsAssignCustomRequest,
    ) => Promise<ScheduledShiftsAssignCustomResponse>;
    override: (request: ScheduledShiftsOverrideRequest) => Promise<ScheduledShiftsOverrideResponse>;
    remove: (request: ScheduledShiftsRemoveRequest) => Promise<ScheduledShiftsRemoveResponse>;
    carryOverWeek: (
      request: ScheduledShiftsCarryOverWeekRequest,
    ) => Promise<ScheduledShiftsCarryOverWeekResponse>;
  };
  timeOff: {
    createRequest: (request: TimeOffCreateRequestRequest) => Promise<TimeOffCreateRequestResponse>;
    createForEmployee: (
      request: TimeOffCreateForEmployeeRequest,
    ) => Promise<TimeOffCreateForEmployeeResponse>;
    listOwn: () => Promise<TimeOffListOwnResponse>;
    listAll: () => Promise<TimeOffListAllResponse>;
    decide: (request: TimeOffDecideRequest) => Promise<TimeOffDecideResponse>;
    listApprovedForRange: (
      request: TimeOffListApprovedForRangeRequest,
    ) => Promise<TimeOffListApprovedForRangeResponse>;
  };
  unavailability: {
    createOwnRequest: (
      request: UnavailabilityCreateOwnRequestRequest,
    ) => Promise<UnavailabilityCreateOwnRequestResponse>;
    createForEmployee: (
      request: UnavailabilityCreateForEmployeeRequest,
    ) => Promise<UnavailabilityCreateForEmployeeResponse>;
    listOwn: () => Promise<UnavailabilityListOwnResponse>;
    listAll: () => Promise<UnavailabilityListAllResponse>;
    listApprovedAll: () => Promise<UnavailabilityListApprovedAllResponse>;
    decide: (request: UnavailabilityDecideRequest) => Promise<UnavailabilityDecideResponse>;
  };
  preferences: {
    listAll: () => Promise<PreferencesListAllResponse>;
    listForEmployee: (
      request: PreferencesListForEmployeeRequest,
    ) => Promise<PreferencesListForEmployeeResponse>;
    create: (request: PreferencesCreateRequest) => Promise<PreferencesCreateResponse>;
    update: (request: PreferencesUpdateRequest) => Promise<PreferencesUpdateResponse>;
    remove: (request: PreferencesRemoveRequest) => Promise<PreferencesRemoveResponse>;
  };
  storeHours: {
    list: () => Promise<StoreHoursListResponse>;
    upsert: (request: StoreHoursUpsertRequest) => Promise<StoreHoursUpsertResponse>;
  };
  specialEvents: {
    list: () => Promise<SpecialEventsListResponse>;
    create: (request: SpecialEventsCreateRequest) => Promise<SpecialEventsCreateResponse>;
    update: (request: SpecialEventsUpdateRequest) => Promise<SpecialEventsUpdateResponse>;
    remove: (request: SpecialEventsRemoveRequest) => Promise<SpecialEventsRemoveResponse>;
  };
  notices: {
    list: () => Promise<NoticesListResponse>;
    create: (request: NoticesCreateRequest) => Promise<NoticesCreateResponse>;
    update: (request: NoticesUpdateRequest) => Promise<NoticesUpdateResponse>;
    remove: (request: NoticesRemoveRequest) => Promise<NoticesRemoveResponse>;
    unreadStatus: () => Promise<NoticesUnreadStatusResponse>;
    markRead: () => Promise<NoticesMarkReadResponse>;
  };
  secretary: {
    leagues: {
      list: () => Promise<SecretaryLeaguesListResponse>;
      get: (id: number) => Promise<SecretaryLeaguesGetResponse>;
      create: (request: SecretaryLeaguesCreateRequest) => Promise<SecretaryLeaguesCreateResponse>;
      update: (request: SecretaryLeaguesUpdateRequest) => Promise<SecretaryLeaguesUpdateResponse>;
      remove: (request: SecretaryLeaguesRemoveRequest) => Promise<SecretaryLeaguesRemoveResponse>;
    };
    teams: {
      listForLeague: (
        request: SecretaryTeamsListForLeagueRequest,
      ) => Promise<SecretaryTeamsListForLeagueResponse>;
      create: (request: SecretaryTeamsCreateRequest) => Promise<SecretaryTeamsCreateResponse>;
      update: (request: SecretaryTeamsUpdateRequest) => Promise<SecretaryTeamsUpdateResponse>;
      remove: (request: SecretaryTeamsRemoveRequest) => Promise<SecretaryTeamsRemoveResponse>;
      removeEmpty: (
        request: SecretaryTeamsRemoveEmptyRequest,
      ) => Promise<SecretaryTeamsRemoveEmptyResponse>;
    };
    bowlers: {
      listForTeam: (
        request: SecretaryBowlersListForTeamRequest,
      ) => Promise<SecretaryBowlersListForTeamResponse>;
      listForLeague: (
        request: SecretaryBowlersListForLeagueRequest,
      ) => Promise<SecretaryBowlersListForLeagueResponse>;
      create: (request: SecretaryBowlersCreateRequest) => Promise<SecretaryBowlersCreateResponse>;
      update: (request: SecretaryBowlersUpdateRequest) => Promise<SecretaryBowlersUpdateResponse>;
      remove: (request: SecretaryBowlersRemoveRequest) => Promise<SecretaryBowlersRemoveResponse>;
    };
    weeklyEntries: {
      listForLeague: (
        request: SecretaryWeeklyEntriesListForLeagueRequest,
      ) => Promise<SecretaryWeeklyEntriesListForLeagueResponse>;
      record: (
        request: SecretaryWeeklyEntriesRecordRequest,
      ) => Promise<SecretaryWeeklyEntriesRecordResponse>;
      remove: (
        request: SecretaryWeeklyEntriesRemoveRequest,
      ) => Promise<SecretaryWeeklyEntriesRemoveResponse>;
    };
    backups: {
      list: () => Promise<SecretaryBackupsListResponse>;
      create: (request: SecretaryBackupsCreateRequest) => Promise<SecretaryBackupsCreateResponse>;
      restore: (
        request: SecretaryBackupsRestoreRequest,
      ) => Promise<SecretaryBackupsRestoreResponse>;
    };
  };
  /**
   * The one namespace with no web equivalent (see Milestone 9/19/23). In the
   * Electron shell this is backed by the real preload bridge; everywhere
   * else (and as the Electron shell's own fallback before the preload
   * value is known) it's the inert stub defined below.
   */
  windowControls: {
    minimize: () => Promise<WindowControlsMinimizeResponse>;
    toggleMaximize: () => Promise<WindowControlsToggleMaximizeResponse>;
    close: () => Promise<WindowControlsCloseResponse>;
    isMaximized: () => Promise<WindowControlsIsMaximizedResponse>;
    onMaximizedChange: (
      callback: (isMaximized: WindowControlsMaximizedChangedPayload) => void,
    ) => () => void;
  };
}

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
  getPublication: (getPublicationRequest: ScheduledShiftsGetPublicationRequest) =>
    get<ScheduledShiftsGetPublicationResponse>(
      `/scheduled-shifts/publication${toQuery({
        department: getPublicationRequest.department,
        weekStart: getPublicationRequest.weekStart,
      })}`,
    ),
  publish: (publishRequest: ScheduledShiftsPublishRequest) =>
    post<ScheduledShiftsPublishResponse>('/scheduled-shifts/publication', publishRequest),
  unpublish: (unpublishRequest: ScheduledShiftsUnpublishRequest) =>
    del<ScheduledShiftsUnpublishResponse>(
      `/scheduled-shifts/publication${toQuery({
        department: unpublishRequest.department,
        weekStart: unpublishRequest.weekStart,
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
  carryOverWeek: (carryOverRequest: ScheduledShiftsCarryOverWeekRequest) =>
    post<ScheduledShiftsCarryOverWeekResponse>('/scheduled-shifts/carry-over', carryOverRequest),
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

const notices: Api['notices'] = {
  list: () => get<NoticesListResponse>('/notices'),
  create: (createRequest: NoticesCreateRequest) =>
    post<NoticesCreateResponse>('/notices', createRequest),
  update: (updateRequest: NoticesUpdateRequest) =>
    put<NoticesUpdateResponse>(`/notices/${updateRequest.id}`, updateRequest),
  remove: (removeRequest: NoticesRemoveRequest) =>
    del<NoticesRemoveResponse>(`/notices/${removeRequest.id}`),
  unreadStatus: () => get<NoticesUnreadStatusResponse>('/notices/unread-status'),
  markRead: () => post<NoticesMarkReadResponse>('/notices/mark-read'),
};

const secretary: Api['secretary'] = {
  leagues: {
    list: () => get<SecretaryLeaguesListResponse>('/secretary/leagues'),
    get: (id: number) => get<SecretaryLeaguesGetResponse>(`/secretary/leagues/${id}`),
    create: (createRequest: SecretaryLeaguesCreateRequest) =>
      post<SecretaryLeaguesCreateResponse>('/secretary/leagues', createRequest),
    update: (updateRequest: SecretaryLeaguesUpdateRequest) =>
      put<SecretaryLeaguesUpdateResponse>(`/secretary/leagues/${updateRequest.id}`, updateRequest),
    remove: (removeRequest: SecretaryLeaguesRemoveRequest) =>
      del<SecretaryLeaguesRemoveResponse>(`/secretary/leagues/${removeRequest.id}`),
  },
  teams: {
    listForLeague: (listRequest: SecretaryTeamsListForLeagueRequest) =>
      get<SecretaryTeamsListForLeagueResponse>(`/secretary/leagues/${listRequest.leagueId}/teams`),
    create: (createRequest: SecretaryTeamsCreateRequest) =>
      post<SecretaryTeamsCreateResponse>(
        `/secretary/leagues/${createRequest.leagueId}/teams`,
        createRequest,
      ),
    update: (updateRequest: SecretaryTeamsUpdateRequest) =>
      put<SecretaryTeamsUpdateResponse>(`/secretary/teams/${updateRequest.id}`, updateRequest),
    remove: (removeRequest: SecretaryTeamsRemoveRequest) =>
      del<SecretaryTeamsRemoveResponse>(`/secretary/teams/${removeRequest.id}`),
    removeEmpty: (removeEmptyRequest: SecretaryTeamsRemoveEmptyRequest) =>
      post<SecretaryTeamsRemoveEmptyResponse>(
        `/secretary/leagues/${removeEmptyRequest.leagueId}/teams/remove-empty`,
      ),
  },
  bowlers: {
    listForTeam: (listRequest: SecretaryBowlersListForTeamRequest) =>
      get<SecretaryBowlersListForTeamResponse>(`/secretary/teams/${listRequest.teamId}/bowlers`),
    listForLeague: (listRequest: SecretaryBowlersListForLeagueRequest) =>
      get<SecretaryBowlersListForLeagueResponse>(
        `/secretary/leagues/${listRequest.leagueId}/bowlers`,
      ),
    create: (createRequest: SecretaryBowlersCreateRequest) =>
      post<SecretaryBowlersCreateResponse>(
        `/secretary/teams/${createRequest.teamId}/bowlers`,
        createRequest,
      ),
    update: (updateRequest: SecretaryBowlersUpdateRequest) =>
      put<SecretaryBowlersUpdateResponse>(`/secretary/bowlers/${updateRequest.id}`, updateRequest),
    remove: (removeRequest: SecretaryBowlersRemoveRequest) =>
      del<SecretaryBowlersRemoveResponse>(`/secretary/bowlers/${removeRequest.id}`),
  },
  weeklyEntries: {
    listForLeague: (listRequest: SecretaryWeeklyEntriesListForLeagueRequest) =>
      get<SecretaryWeeklyEntriesListForLeagueResponse>(
        `/secretary/leagues/${listRequest.leagueId}/weekly-entries`,
      ),
    record: (recordRequest: SecretaryWeeklyEntriesRecordRequest) =>
      put<SecretaryWeeklyEntriesRecordResponse>(
        `/secretary/bowlers/${recordRequest.bowlerId}/weekly-entries/${recordRequest.week}`,
        { amountPaid: recordRequest.amountPaid },
      ),
    remove: (removeRequest: SecretaryWeeklyEntriesRemoveRequest) =>
      del<SecretaryWeeklyEntriesRemoveResponse>(
        `/secretary/bowlers/${removeRequest.bowlerId}/weekly-entries/${removeRequest.week}`,
      ),
  },
  backups: {
    list: () => get<SecretaryBackupsListResponse>('/secretary/backups'),
    create: (createRequest: SecretaryBackupsCreateRequest) =>
      post<SecretaryBackupsCreateResponse>('/secretary/backups', createRequest),
    restore: (restoreRequest: SecretaryBackupsRestoreRequest) =>
      post<SecretaryBackupsRestoreResponse>(`/secretary/backups/${restoreRequest.id}/restore`, {
        confirmationText: restoreRequest.confirmationText,
      }),
  },
};

/**
 * `windowControls` has no web equivalent and isn't part of the HTTP route
 * surface (Milestone 19), so it's never implemented via `fetch` here.
 * `TitleBar`/`WindowControls` (see those components) render unconditionally
 * and call these methods regardless of context, so this stays present as
 * inert stubs purely to avoid crashing a plain browser/PWA session — giving
 * the browser its own feature-detected chrome-free layout is Milestone 22.
 * Since Milestone 23 shrank the Electron preload to expose ONLY
 * `windowControls`, `client.ts` uses this stub as the Electron shell's
 * fallback too, for the brief window before/if the real preload value is
 * unavailable — see `client.ts`'s merge logic.
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
  notices,
  secretary,
  windowControls,
};
