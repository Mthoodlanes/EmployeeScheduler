// Milestone 24: tests/unit/server/** needs TEST_DATABASE_URL (and DATABASE_URL,
// to compare against as a safety check) from the repo-root .env — load it
// here so it reaches every worker vitest spawns, the same way
// `server/src/index.ts` loads it for the real server process.
import 'dotenv/config';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src'),
    },
  },
  test: {
    environment: 'jsdom',
    // Milestone 24: server db/service tests hit a real Neon Postgres branch
    // over the network and have no need for jsdom's browser globals — 'node'
    // is both more correct and slightly faster for that subtree.
    environmentMatchGlobs: [['tests/unit/server/**', 'node']],
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // Milestone 24: the new tests/unit/server/** files share ONE real Neon
    // Postgres test branch and isolate between tests by truncating every
    // table in `beforeEach` (see tests/unit/server/dbTestSetup.ts) — running
    // test FILES in parallel would let two files' truncate/insert cycles
    // race on the same shared tables. Disabling file parallelism makes the
    // whole suite safe at the cost of no longer running the (already fast)
    // pure-logic/component files concurrently with each other, which is not
    // the dominant cost here anyway (real network round-trips to Neon are).
    fileParallelism: false,
  },
});
