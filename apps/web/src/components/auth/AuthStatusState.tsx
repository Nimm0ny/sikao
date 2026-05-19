import type { ReactNode } from 'react';

export interface AuthStatusStateProps {
  readonly icon: ReactNode;
  readonly title?: string;
  readonly description: string;
  readonly tone?: 'success' | 'warning' | 'neutral';
  readonly children?: ReactNode;
}

const TONE_CLASS: Record<NonNullable<AuthStatusStateProps['tone']>, string> = {
  success: 'bg-ok-bg text-ok',
  warning: 'bg-bad-bg text-err',
  neutral: 'bg-paper-2 text-ink-3',
};

export function AuthStatusState({
  icon,
  title,
  description,
  tone = 'neutral',
  children,
}: AuthStatusStateProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`mb-5 flex h-12 w-12 items-center justify-center rounded-pill ${TONE_CLASS[tone]}`}
      >
        {icon}
      </div>
      {title !== undefined ? (
        <h1 className="font-serif text-h-card font-medium text-ink">{title}</h1>
      ) : null}
      <p className={`text-sm leading-relaxed text-ink-3 ${title !== undefined ? 'mt-2' : ''}`}>
        {description}
      </p>
      {children !== undefined ? <div className="mt-6 w-full">{children}</div> : null}
    </div>
  );
}
