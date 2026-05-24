/*
 * Sikao Web Router.
 */
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { Home } from '../views/Home';
import { Practice } from '../views/Practice';
import { PracticePreferences } from '../views/PracticePreferences';
import { PracticeSession } from '../views/PracticeSession';
import { AiQuestionsGenerating } from '../views/AiQuestionsGenerating';
import { SessionResult } from '../views/SessionResult';
import { Note } from '../views/Note';
import { Me } from '../views/Me';
import { QuestionHub } from '../views/QuestionHub';
import { Review } from '../views/Review';
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
          { path: 'profile/practice-preferences', element: <PracticePreferences /> },
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
