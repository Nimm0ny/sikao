/*
 * MSW handler registry — SIK-89 Home M-Auth infra (2026-05-24).
 *
 * Why: each Tab phase (Home M-A, Practice M-Api, Review M-Api, Note M-Api)
 *      maintains its own handlers file under `src/mocks/handlers/<tab>.ts`
 *      (per docs/plan/frontend-tab-runtime-2026-05-24.md §7.3). This barrel
 *      starts empty and each Tab milestone appends its export. The empty
 *      array is intentional — handlers are added by feature, not infra.
 *
 *      Aliasing here avoids forcing each Tab milestone to also touch
 *      browser.ts / server.ts (which would otherwise be a router-style
 *      writer-conflict file per AGENT-H10 spirit).
 */
import type { RequestHandler } from 'msw';

export const handlers: RequestHandler[] = [];
