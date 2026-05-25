/*
 * MSW handler registry — SIK-89 Home M-Auth infra (2026-05-24).
 *
 * Why: each Tab phase (Home M-A, Practice M-Api, Review M-Api, Note M-Api)
 *      maintains its own handlers file under `src/mocks/handlers/<tab>.ts`
 *      (per docs/plan/frontend-tab-runtime-2026-05-24.md §7.3). This
 *      barrel composes them.
 */
import type { RequestHandler } from 'msw';
import { homeHandlers } from './handlers/home';
import { practiceHandlers } from './handlers/practice';
import { progressHandlers } from './handlers/progress';
import { recommendationsHandlers } from './handlers/recommendations';
import { recordsHandlers } from './handlers/records';

export const handlers: RequestHandler[] = [
  ...homeHandlers,
  ...practiceHandlers,
  ...progressHandlers,
  ...recommendationsHandlers,
  ...recordsHandlers,
];
