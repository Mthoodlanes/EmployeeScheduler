/**
 * The one seam the whole renderer talks through (Milestone 19). Every
 * page/hook imports `{ api }` from here rather than reaching for
 * `window.api` or `httpClient` directly.
 *
 * Granular dual-mode dispatch (Milestone 23): this renderer bundle is
 * shared between the Electron desktop shell and the hosted web/PWA build.
 * Before this milestone the Electron app ran its own full local backend
 * (IPC all the way down) and the dispatch here was all-or-nothing —
 * `window.api ?? httpApi` — because `window.api`, when present, always had
 * every namespace.
 *
 * Milestone 23 converts the Electron app into a thin shell whose
 * `BrowserWindow` just loads the hosted site: the preload now exposes ONLY
 * `windowControls` (the one namespace with no web equivalent — see
 * `src/preload/index.ts`), so `window.api` is a truthy object with just
 * that one key. The old `window.api ?? httpApi` logic would pick the
 * (now much smaller) `window.api` exclusively the instant it's present,
 * and `api.employees.list()` (etc.) would crash — the reduced `window.api`
 * has no `employees` key at all.
 *
 * The fix is granular, not all-or-nothing: every data namespace ALWAYS
 * comes from `httpApi` (real `fetch` calls to the hosted `/api/*` routes,
 * same-origin now that the shell loads the real site), and ONLY
 * `windowControls` comes from `window.api` when present, falling back to
 * `httpApi`'s own inert `windowControls` stub otherwise (plain browser/PWA,
 * no Electron preload at all).
 */
import { httpApi } from './httpClient';
import type { Api } from './httpClient';

export const api: Api = {
  ...httpApi,
  windowControls: window.api?.windowControls ?? httpApi.windowControls,
};
