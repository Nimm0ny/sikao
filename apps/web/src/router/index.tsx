/*
 * Sikao Web Router — V5-M0.5 skeleton (2026-05-24).
 *
 * V5-M0.5 big-bang rebuild dropped the V4 router (OnboardingGate /
 * RouteHosts / RouteConvergence / RedirectPreserveQuery + 30+ route
 * declarations). This file is now a placeholder router with a single
 * "/" route that confirms the boot path is wired:
 *   - QueryClientProvider works
 *   - tokens.css is loaded
 *   - StrictMode renders without React errors
 *
 * Real routes will be added by:
 *   - V5-M3 (SIK-75): 35 component skeletons mounted under storybook-style
 *     /sandbox routes for visual review
 *   - V5-M9 (SIK-81): real Home / Practice / Notes / Review / Profile /
 *     QuestionHub pages (D.4.1-D.4.5 from design.md §D.4)
 *   - Per business Phase: Home M11/M12 (SIK-29 family) re-implements
 *     /me + /profile/records + 5-tab nav under V5 framework
 *
 * dev port: 18080 (AGENT-H10).
 */
import { createBrowserRouter } from 'react-router-dom';
import { BootCard } from './BootCard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <BootCard />,
  },
  {
    path: '*',
    element: <BootCard />,
  },
]);
