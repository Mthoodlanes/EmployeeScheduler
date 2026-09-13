import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      // Force CJS output with a .cjs extension regardless of the root package.json's
      // "type": "module" — Electron loads the preload script via require(), and Node
      // would otherwise refuse to treat a plain ".js" file as CommonJS in an ESM package.
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    // Milestone 21: PWA support (manifest + Workbox service worker) for the
    // hosted web build ONLY — this `renderer` target is the one electron-vite
    // target that also gets served as a plain web page (see Milestone 20),
    // so it's the correct/only place to add this. The `main`/`preload`
    // targets above are untouched. `generateSW` (rather than
    // `injectManifest`) is used because this app has no existing custom
    // service-worker logic to merge with — `generateSW` derives the whole
    // precache manifest + runtime caching routes from plain config below,
    // which is all this app needs (no push notifications, no background
    // sync, no bespoke SW code). Service-worker *registration* is handled
    // manually in `src/renderer/src/main.tsx` (via `injectRegister: false`
    // here) so it can be skipped inside the Electron shell — see that file
    // for why.
    plugins: [
      react(),
      VitePWA({
        // Only ever generate/register a service worker for real production
        // web builds. Leaving this disabled in `npm run dev` (both the
        // Electron renderer dev server and a hypothetical plain-browser dev
        // session) avoids a dev-mode SW caching stale HMR output.
        injectRegister: false,
        registerType: 'autoUpdate',
        manifest: {
          name: 'Mt Hood Lanes Scheduler',
          // Kept short per home-screen label constraints (~12 chars is the
          // practical guideline before OS launchers start truncating it).
          short_name: 'Hood Lanes',
          description:
            'Mt Hood Lanes employee scheduling — view your schedule, request time off, and manage shifts from any device.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          // Matches src/renderer/src/theme/theme.css's light-mode
          // `--color-bg` / `--color-accent` tokens (the app always boots in
          // light mode before the ThemeProvider resolves the user's
          // preference, so these are the correct "first paint" colors for
          // the OS splash screen / browser chrome).
          background_color: '#faf6f0',
          theme_color: '#b45309',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'icons/maskable-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Explicit (vite-plugin-pwa's own default is narrower — just
          // js/css/html) so the versioned app shell's fonts/icons are
          // precached too. Workbox precaching is itself a cache-first
          // strategy keyed to each build's content hash: already-cached
          // assets are served without a network round-trip, and a changed
          // hash (new deploy) fetches only the changed files.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // Never let the SW's SPA navigation fallback intercept /api/*
          // (the app uses HashRouter, so this mostly can't happen anyway —
          // every client-side route lives after a `#` the browser never
          // sends to the server — but this is an explicit belt-and-braces
          // guard since generateSW's precacheAndRoute + navigateFallback
          // logic still runs on the injected /api/* runtime route below).
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Network-first with a short timeout for all API reads: this
              // data (schedules, time-off, etc.) must never be served stale
              // by default — only fall back to a cached response if the
              // network request doesn't even complete within the timeout
              // (e.g. offline / dead connection), not merely if it's slow.
              // `method: 'GET'` is explicit (it's also workbox-build's
              // default) — every mutating route in server/src/routes/*.ts
              // uses POST/PUT/DELETE, so this deliberately never intercepts
              // a write; those always go straight to the network untouched
              // by the service worker.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
              method: 'GET',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 4,
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
          ],
        },
      }),
    ],
  },
});
