import type { ReactElement } from 'react';
import { Navigate, useParams } from 'react-router-dom';

// Legacy shell route retained for backward compatibility only.
//
// The old `/practice/essay/session/:sessionId` surface never had a backend
// `essay_session` entity and was still backed by mock data. We now retire that
// live mock entry and forward old links to the real single-question essay flow.
//
// Assumption: historical callers treated `sessionId` as a frontend namespace
// for the active essay question. Redirecting to `/essay/specialty/:questionId`
// is the closest real route that preserves the "enter a writing surface for one
// essay question" intent. Invalid ids degrade to the specialty error state
// instead of silently showing mock content.

export default function ShenlunSession(): ReactElement {
  const { sessionId } = useParams<{ sessionId: string }>();
  if (sessionId == null || sessionId.trim() === '') {
    return <Navigate to="/essay/history" replace />;
  }
  return <Navigate to={`/essay/specialty/${encodeURIComponent(sessionId)}`} replace />;
}
