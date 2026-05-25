import { Navigate, useParams } from 'react-router-dom';
import { BootCard } from './BootCard';

export function LegacyPracticeResultRedirect() {
  const params = useParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;
  if (!sessionId) {
    return <BootCard />;
  }
  return <Navigate to={`/practice/sessions/${sessionId}/result`} replace />;
}
