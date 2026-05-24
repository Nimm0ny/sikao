/*
 * MSW node server — vitest setup target (SIK-89 Home M-Auth, 2026-05-24).
 *
 * Why: vitest jsdom env wires `setupServer()` from msw/node. setupTests.ts
 *      starts/stops/resets the server around the test lifecycle. Per-Tab
 *      handlers come from `./handlers.ts` and feature tests can install
 *      ad-hoc handlers via `server.use(...)` (msw API).
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
