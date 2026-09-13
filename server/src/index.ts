import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { sql } from 'drizzle-orm';
import { getDb } from './db.js';
import { getJwtSecret } from './auth/jwt.js';
import { resolveActor } from './middleware/resolveActor.js';
import authRoutes from './routes/auth.routes.js';
import employeesRoutes from './routes/employees.routes.js';
import shiftTemplatesRoutes from './routes/shiftTemplates.routes.js';
import scheduledShiftsRoutes from './routes/scheduledShifts.routes.js';
import { pruneShiftsOlderThanTwoWeeks } from './services/scheduledShiftService.js';
import timeOffRoutes from './routes/timeOff.routes.js';
import unavailabilityRoutes from './routes/unavailability.routes.js';
import preferencesRoutes from './routes/preferences.routes.js';
import storeHoursRoutes from './routes/storeHours.routes.js';
import specialEventsRoutes from './routes/specialEvents.routes.js';

// Milestone 17: fail fast at startup if JWT_SECRET is missing, rather than
// only discovering it on the first login attempt.
getJwtSecret();

// Milestone 20: the built renderer (electron-vite's `renderer` build target,
// see electron.vite.config.ts) lands in `out/renderer` at the repo root. The
// compiled server runs from `dist-server/index.js` (see
// tsconfig.server.json's `outDir`/`rootDir`), so resolve relative to this
// file's own location rather than `process.cwd()` — correct regardless of
// which directory the process is started from.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const rendererDistPath = path.join(moduleDir, '..', 'out', 'renderer');
const rendererIndexHtml = path.join(rendererDistPath, 'index.html');

const app = express();
const port = Number(process.env.PORT ?? 3000);

// Milestone 19: dev-only CORS. Until Milestone 20 unifies frontend+backend
// onto one origin, local dev runs the Vite renderer dev server (typically
// http://localhost:5173) and this Express API (http://localhost:3000) as two
// separate processes/ports, so the dual-mode `client.ts`'s fetch calls are
// cross-origin. `credentials: true` is required so the httpOnly JWT session
// cookie is sent/accepted. Gated strictly behind non-production so a
// deployed instance (same-origin per Milestone 20) never runs with any CORS
// allowance at all — this must never reach production as a general
// permissive policy.
if (process.env.NODE_ENV !== 'production') {
  const devRendererOrigin = process.env.DEV_RENDERER_ORIGIN ?? 'http://localhost:5173';
  app.use(
    cors({
      origin: devRendererOrigin,
      credentials: true,
    }),
  );
}

app.use(express.json());
app.use(cookieParser());
app.use(resolveActor);

app.use('/api/auth', authRoutes);
// Milestone 18: the 8 remaining feature areas, one router per original
// `src/main/ipc/*.ipc.ts` file, each internally applying `requireAuth` to
// every route and preserving the `{ok,data}/{ok,error}` envelope via
// `./routes/httpResult.js`'s `handleRoute`. See each router's header comment
// for its exact IPC-channel -> route mapping.
app.use('/api/employees', employeesRoutes);
app.use('/api/shift-templates', shiftTemplatesRoutes);
app.use('/api/scheduled-shifts', scheduledShiftsRoutes);
app.use('/api/time-off', timeOffRoutes);
app.use('/api/unavailability', unavailabilityRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/store-hours', storeHoursRoutes);
app.use('/api/special-events', specialEventsRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    const rows = await getDb().execute(sql`select now() as now`);
    const [row] = rows as unknown as Array<{ now: string | Date }>;
    res.status(200).json({
      ok: true,
      db: 'connected',
      time: new Date(row.now).toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      db: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
});

// Milestone 20: serve the built renderer as static files, same-origin with
// the API (mounted after every `/api/*` route above so it can never shadow
// them). `index: false` disables express.static's own automatic `/` ->
// `index.html` handling so the fallback below is the single place
// `index.html` is served, keeping the "unmatched /api/* gets JSON" behavior
// correct too.
app.use(express.static(rendererDistPath, { index: false }));

// Plain `app.use` (rather than an `app.get('*', ...)` wildcard route) avoids
// Express 5's path-to-regexp v8 requirement that wildcards be named
// (`/*splat`) — this middleware simply runs for anything the routes/static
// serving above didn't already handle.
//
// The renderer uses `HashRouter` (see `src/renderer/src/App.tsx`), so every
// client-side route lives after a `#` fragment the browser never sends to
// the server — unlike a `BrowserRouter` SPA, no wildcard route forwarding
// arbitrary paths to `index.html` is needed. This just serves `index.html`
// for `/` and any other non-API GET (e.g. a hard refresh), while an
// unmatched `/api/*` request gets a proper JSON 404 instead of HTML.
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ ok: false, error: 'Not found' });
    return;
  }
  res.sendFile(rendererIndexHtml);
});

// Drop schedule data more than two weeks old so the table doesn't grow
// unbounded — run once at startup (covers Render free-tier cold starts,
// which happen often) and then on a recurring interval for as long as this
// process stays warm. Best-effort: a failure here must never take down the
// whole server, so it's logged rather than thrown.
function runScheduledShiftPruning(): void {
  pruneShiftsOlderThanTwoWeeks().catch((error: unknown) => {
    // eslint-disable-next-line no-console -- background job failure needs to be visible somewhere
    console.error('Failed to prune old scheduled shifts:', error);
  });
}
runScheduledShiftPruning();
const PRUNE_INTERVAL_MS = 12 * 60 * 60 * 1000;
setInterval(runScheduledShiftPruning, PRUNE_INTERVAL_MS);

app.listen(port, () => {
  // eslint-disable-next-line no-console -- startup log is intentional server output
  console.log(`Mt Hood Lanes Scheduler backend listening on port ${port}`);
});
