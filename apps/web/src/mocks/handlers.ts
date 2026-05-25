/*
 * MSW handler registry — SIK-89 Home M-Auth infra (2026-05-24).
 *
 * Why: each Tab phase (Home M-A, Practice M-Api, Review M-Api, Note M-Api)
 *      maintains its own handlers file under `src/mocks/handlers/<tab>.ts`
 *      (per docs/plan/frontend-tab-runtime-2026-05-24.md §7.3). This
 *      barrel composes them. SIK-90 Home M-A wave 1 appends the Home
 *      phase entries; later milestones append theirs in turn.
 *
 *      Aliasing here avoids forcing each Tab milestone to also touch
 *      browser.ts / server.ts (which would otherwise be a router-style
 *      writer-conflict file per AGENT-H10 spirit).
 */
import type { RequestHandler } from 'msw';
import { homeHandlers } from './handlers/home';
import { practiceHandlers } from './handlers/practice';
import { progressHandlers } from './handlers/progress';

export const handlers: RequestHandler[] = [...homeHandlers, ...practiceHandlers, ...progressHandlers];
