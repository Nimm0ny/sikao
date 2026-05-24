import { Button } from '../../form/Button';

export interface PauseResumeButtonProps {
  readonly status: string;
  readonly busy?: boolean;
  readonly onPause: () => void;
  readonly onResume: () => void;
}

export function PauseResumeButton({
  status,
  busy = false,
  onPause,
  onResume,
}: PauseResumeButtonProps) {
  if (status === 'paused') {
    return (
      <Button variant="secondary" onClick={onResume} disabled={busy}>
        Resume
      </Button>
    );
  }

  if (status !== 'in_progress') {
    return null;
  }

  return (
    <Button variant="secondary" onClick={onPause} disabled={busy}>
      Pause
    </Button>
  );
}
