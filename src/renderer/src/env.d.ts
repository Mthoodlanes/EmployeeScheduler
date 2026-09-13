/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import type { Api } from '../../preload/index';

declare global {
  interface Window {
    /**
     * Injected by the Electron preload script (`src/preload/index.ts`) via
     * `contextBridge` — present only when this renderer bundle is running
     * inside the Electron desktop app. Absent in a plain browser/PWA
     * context, where `api/client.ts` falls back to the fetch-based
     * `httpApi` (`api/httpClient.ts`) instead. See Milestone 19.
     */
    api?: Api;
  }

  // Vite's built-in `VITE_`-prefixed env var support (see `api/httpClient.ts`).
  interface ImportMetaEnv {
    /**
     * Base URL the fetch-based client targets, e.g.
     * `http://localhost:3000/api` for local dev where the Vite renderer dev
     * server and the Express API run on different ports. Defaults to the
     * relative `/api` (correct once Milestone 20 serves both from one
     * origin) when unset.
     */
    readonly VITE_API_BASE_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
