import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { sql } from 'drizzle-orm';
import { getDb } from './db.js';
import { getJwtSecret } from './auth/jwt.js';
import { resolveActor } from './middleware/resolveActor.js';
import authRoutes from './routes/auth.routes.js';
import employeesRoutes from './routes/employees.routes.js';
import shiftTemplatesRoutes from './routes/shiftTemplates.routes.js';
import scheduledShiftsRoutes from './routes/scheduledShifts.routes.js';
import timeOffRoutes from './routes/timeOff.routes.js';
import unavailabilityRoutes from './routes/unavailability.routes.js';
import preferencesRoutes from './routes/preferences.routes.js';
import storeHoursRoutes from './routes/storeHours.routes.js';
import specialEventsRoutes from './routes/specialEvents.routes.js';

// Milestone 17: fail fast at startup if JWT_SECRET is missing, rather than
// only discovering it on the first login attempt.
getJwtSecret();

// Milestone 13 placeholder page: the real hosted frontend isn't served from
// here until Milestone 20 (once `client.ts` is HTTP-based). This just proves
// the Express app is up.
const PLACEHOLDER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Mt Hood Lanes Scheduler</title>
  </head>
  <body>
    <h1>Mt Hood Lanes Scheduler — backend is live</h1>
    <p>See <a href="/api/health">/api/health</a> for a database connectivity check.</p>
  </body>
</html>
`;

const app = express();
const port = Number(process.env.PORT ?? 3000);

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

// Plain `app.use` (rather than an `app.get('*', ...)` wildcard route) avoids
// Express 5's path-to-regexp v8 requirement that wildcards be named
// (`/*splat`) — this middleware simply runs for anything `/api/health` didn't
// already handle.
app.use((_req, res) => {
  res.status(200).type('html').send(PLACEHOLDER_HTML);
});

app.listen(port, () => {
  // eslint-disable-next-line no-console -- startup log is intentional server output
  console.log(`Mt Hood Lanes Scheduler backend listening on port ${port}`);
});
