/**
 * The one seam the whole renderer talks through (Milestone 19). Every
 * page/hook imports `{ api }` from here rather than reaching for
 * `window.api` or `httpClient` directly.
 *
 * Dual-mode dispatch: this renderer bundle is shared between the Electron
 * desktop app (Phase 1 — a preload script injects `window.api` via
 * `contextBridge`) and the hosted web/PWA build (Phase 2 — no Electron, no
 * preload, `window.api` is simply never defined). At module load we check
 * which one we're in:
 *  - `window.api` present -> use it directly, unchanged from before this
 *    milestone. This is the Electron app's safety net: its behavior is
 *    exactly what it was pre-Milestone-19, IPC all the way down.
 *  - `window.api` absent -> fall back to the fetch-based `httpApi`
 *    (`./httpClient.ts`), which hits the Milestone 18 `/api/*` HTTP routes
 *    with an identical method surface.
 */
import { httpApi } from './httpClient';

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

export const api: Api = window.api ?? httpApi;
