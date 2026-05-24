/*
 * Sikao Web Router — V5-M3.5 Phase 4 desktop pages (2026-05-24).
 *
 * V5-M3.5 wave 16 lands the SaaS shell (RootLayout) + 6 page slots:
 *   - / Home (D.4.1)      — landed in this commit
 *   - /practice Practice  — placeholder until 17.2
 *   - /review Review      — placeholder until 17.6
 *   - /note Note          — placeholder until 17.3
 *   - /question-hub       — placeholder until 17.5
 *   - /me Me              — placeholder until 17.4
 *
 * Until each page view is implemented (waves 16-17), unfilled routes render
 * the V5-M0.5 BootCard so the Rail nav links resolve to a usable surface
 * without Page Not Found gaps. BootCard stays in-tree as the catch-all "*"
 * fallback for typo / legacy URLs.
 *
 * dev port: 18080 (AGENT-H10).
 */
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { Home } from '../views/Home';
import { Practice } from '../views/Practice';
import { Note } from '../views/Note';
import { BootCard } from './BootCard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'practice', element: <Practice /> },
      { path: 'review', element: <BootCard /> },
      { path: 'note', element: <Note /> },
      { path: 'question-hub', element: <BootCard /> },
      { path: 'me', element: <BootCard /> },
    ],
  },
  {
    path: '*',
    element: <BootCard />,
  },
]);
