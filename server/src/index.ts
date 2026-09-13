import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { sql } from 'drizzle-orm';
import { getDb } from './db.js';
import { getJwtSecret } from './auth/jwt.js';
import { resolveActor } from './middleware/resolveActor.js';
import authRoutes from './routes/auth.routes.js';

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
