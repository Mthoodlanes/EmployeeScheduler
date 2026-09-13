import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Milestone 23 regression test for `src/renderer/src/api/client.ts`'s
 * granular dual-mode merge — the "critical, easy-to-get-wrong fix" the
 * milestone plan calls out by name.
 *
 * Colocated with the `.tsx` component tests (rather than `tests/unit/logic`
 * or a new folder) purely so it's picked up by `tsconfig.web.json`'s
 * project include list (`tests/unit/components/**\/*.tsx`) instead of
 * `tsconfig.node.json`'s blanket `tests/**\/*.ts` — this file needs the
 * `@renderer` path alias and `Window.api`/DOM globals that only the web
 * project's config provides; giving it a `.ts` extension would land it in
 * the wrong composite project and fail to type-check. It isn't a component
 * test, but it belongs to the same TypeScript project as one.
 *
 * `client.ts` reads `window.api` at MODULE LOAD TIME, so each scenario
 * below sets `window.api` first, then `vi.resetModules()` + a fresh dynamic
 * `import()` to force the module (and its top-level merge) to re-evaluate.
 */

const mockPreloadWindowControls = {
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
  isMaximized: vi.fn(),
  onMaximizedChange: vi.fn(),
};

const mockHttpWindowControls = {
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
  isMaximized: vi.fn(),
  onMaximizedChange: vi.fn(),
};

const mockHttpApi = {
  auth: { login: vi.fn(), logout: vi.fn(), getSession: vi.fn() },
  employees: { list: vi.fn(), create: vi.fn() },
  shiftTemplates: { list: vi.fn() },
  scheduledShifts: { listWeek: vi.fn() },
  timeOff: { listOwn: vi.fn() },
  unavailability: { listOwn: vi.fn() },
  preferences: { listAll: vi.fn() },
  storeHours: { list: vi.fn() },
  specialEvents: { list: vi.fn() },
  windowControls: mockHttpWindowControls,
};

vi.mock('@renderer/api/httpClient', () => ({ httpApi: mockHttpApi }));

const originalWindowApi = window.api;

describe('client.ts dual-mode merge (Milestone 23)', () => {
  afterEach(() => {
    window.api = originalWindowApi;
    vi.resetModules();
  });

  it('sources every data namespace from httpApi even when window.api is a truthy SHRUNK object', async () => {
    // Simulates exactly the Milestone 23 Electron shell: the preload's
    // `contextBridge`-injected `window.api` is truthy but has ONLY
    // `windowControls` — no `auth`/`employees`/etc. at all.
    window.api = { windowControls: mockPreloadWindowControls } as unknown as Window['api'];
    vi.resetModules();

    const { api } = await import('../../../src/renderer/src/api/client');

    // Before this milestone's fix, `window.api ?? httpApi` picked
    // `window.api` wholesale the instant it was truthy, so every one of
    // these would have been `undefined` — the exact "Cannot read
    // properties of undefined" crash the milestone plan describes.
    expect(api.auth).toBe(mockHttpApi.auth);
    expect(api.employees).toBe(mockHttpApi.employees);
    expect(api.shiftTemplates).toBe(mockHttpApi.shiftTemplates);
    expect(api.scheduledShifts).toBe(mockHttpApi.scheduledShifts);
    expect(api.timeOff).toBe(mockHttpApi.timeOff);
    expect(api.unavailability).toBe(mockHttpApi.unavailability);
    expect(api.preferences).toBe(mockHttpApi.preferences);
    expect(api.storeHours).toBe(mockHttpApi.storeHours);
    expect(api.specialEvents).toBe(mockHttpApi.specialEvents);

    // A method call one level deep must resolve to the real httpApi
    // function too, not throw — this is what "api.employees.list() would
    // crash" actually looks like as an assertion.
    expect(api.employees.list).toBe(mockHttpApi.employees.list);
    expect(() => api.employees.list()).not.toThrow();
  });

  it('sources windowControls from window.api when the (shrunk) Electron preload is present', async () => {
    window.api = { windowControls: mockPreloadWindowControls } as unknown as Window['api'];
    vi.resetModules();

    const { api } = await import('../../../src/renderer/src/api/client');

    expect(api.windowControls).toBe(mockPreloadWindowControls);
    expect(api.windowControls).not.toBe(mockHttpApi.windowControls);
  });

  it("falls back to httpApi's inert windowControls stub with no window.api at all (plain browser/PWA)", async () => {
    window.api = undefined;
    vi.resetModules();

    const { api } = await import('../../../src/renderer/src/api/client');

    expect(api.windowControls).toBe(mockHttpApi.windowControls);
    // Every data namespace still comes from httpApi too, same as the
    // Electron-shell case — the merge is granular, but httpApi backs
    // everything except a real preload's windowControls either way.
    expect(api.auth).toBe(mockHttpApi.auth);
  });
});
