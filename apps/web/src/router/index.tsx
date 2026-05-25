/*
 * Sikao Web Router.
 */
import { createBrowserRouter } from 'react-router-dom';
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
