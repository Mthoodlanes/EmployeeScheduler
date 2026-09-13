/**
 * Thin re-export of the typed IPC bridge exposed by the preload script.
 * Renderer code should import `api` from here rather than reaching for
 * `window.api` directly, so call sites are easy to mock in tests.
 */
export const { api } = window;
