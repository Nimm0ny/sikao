/*
 * Sikao Web Router.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { Home } from '../views/Home';
import { MockExamComparisonView } from '../views/MockExamComparisonView';
import { MockExamHistoryView } from '../views/MockExamHistoryView';
import { MockExamStartView } from '../views/MockExamStartView';
import { Practice } from '../views/Practice';
import { PracticePreferences } from '../views/PracticePreferences';
import { PracticeSession } from '../views/PracticeSession';
import { AiQuestionsGenerating } from '../views/AiQuestionsGenerating';
import { SessionResult } from '../views/SessionResult';
import { Note } from '../views/Note';
import { Me } from '../views/Me';
import { QuestionHub } from '../views/QuestionHub';
import { Review } from '../views/Review';
import { ProfileLearning } from '../views/ProfileLearning';
import { AuthGuard } from './AuthGuard';
import { BootCard } from './BootCard';

// SIK-93 Home M-Records — 6 legacy redirects map old V4 routes onto the
// canonical V5 paths so deep links from external sources / bookmarks
// don't 404. Listed at the top of children so React Router resolves them
// before the wildcard catch-all.
const LEGACY_REDIRECTS: ReadonlyArray<{ readonly from: string; readonly to: string }> = [
  { from: 'app', to: '/' },
  { from: 'study/today', to: '/' },
  { from: 'dashboard', to: '/' },
  { from: 'practice/center', to: '/practice' },
  { from: 'wrong-book', to: '/review' },
  { from: 'plan', to: '/' },
  { from: 'progress', to: '/profile/learning' },
];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'practice', element: <Practice /> },
          { path: 'practice/mock-exam/start', element: <MockExamStartView /> },
          { path: 'practice/mock-exam/history', element: <MockExamHistoryView /> },
          { path: 'practice/mock-exam/:sessionId/comparison', element: <MockExamComparisonView /> },
          { path: 'profile/practice-preferences', element: <PracticePreferences /> },
          { path: 'profile/learning', element: <ProfileLearning /> },
          ...LEGACY_REDIRECTS.map(({ from, to }) => ({
            path: from,
            element: <Navigate to={to} replace />,
          })),
          { path: 'review', element: <Review /> },
          { path: 'note', element: <Note /> },
          { path: 'question-hub', element: <QuestionHub /> },
          { path: 'me', element: <Me /> },
        ],
      },
      {
        path: 'practice/ai-questions/generating',
        element: <AiQuestionsGenerating />,
      },
      {
        path: 'practice/sessions/:sessionId/result',
        element: <SessionResult />,
      },
      {
        path: 'practice/sessions/:sessionId',
        element: <PracticeSession />,
      },
    ],
  },
  {
    path: '*',
    element: <BootCard />,
  },
]);
