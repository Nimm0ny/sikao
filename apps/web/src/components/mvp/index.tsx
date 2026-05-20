import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@sikao/shared-utils';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Home,
  NotebookPen,
  RefreshCcw,
  Target,
  User,
} from 'lucide-react';
import { HOME_COPY } from '@/lib/ui-copy';

export function MvpCard({
  children,
  className = '',
  testId,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly testId?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-card border border-line bg-paper text-ink shadow-card',
        className,
      )}
      data-testid={testId}
    >
      {children}
    </section>
  );
}

type MvpButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface MvpButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: MvpButtonVariant;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}

export function MvpButton({
  variant = 'primary',
  icon,
  children,
  className = '',
  type = 'button',
  ...props
}: MvpButtonProps) {
  const variantClass: Record<MvpButtonVariant, string> = {
    primary: 'border-accent bg-accent text-white hover:border-accent-2 hover:bg-accent-2',
    secondary: 'border-line-3 bg-paper text-ink hover:border-accent hover:bg-accent-50 hover:text-accent',
    ghost: 'border-transparent bg-transparent text-accent hover:bg-accent-50',
  };

  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-tiny border px-4 py-2 text-body font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {icon ? <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export interface MvpIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly children: ReactNode;
}

export function MvpIconButton({
  label,
  children,
  className = '',
  type = 'button',
  ...props
}: MvpIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-tiny border border-line-2 bg-paper text-ink-3 transition-colors',
        'hover:bg-accent-50 hover:text-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type MvpChipTone = 'default' | 'blue' | 'green' | 'amber';

export function MvpChip({
  children,
  tone = 'default',
}: {
  readonly children: ReactNode;
  readonly tone?: MvpChipTone;
}) {
  const toneClass: Record<MvpChipTone, string> = {
    default: 'border-line bg-paper-2 text-ink-3',
    blue: 'border-accent bg-accent-50 text-accent',
    green: 'border-ok bg-ok-bg text-ok',
    amber: 'border-warn bg-warn-bg text-warn',
  };

  return (
    <span className={cn('inline-flex items-center rounded-pill border px-3 py-1 text-tiny font-semibold', toneClass[tone])}>
      {children}
    </span>
  );
}

export function MvpActionCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  testId,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly testId?: string;
}) {
  return (
    <MvpCard className="flex h-full flex-col p-5" testId={testId}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-card bg-accent-50 text-accent">
        {icon}
      </div>
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      <p className="mt-2 min-h-12 text-body leading-6 text-ink-3">{description}</p>
      <MvpButton variant="secondary" className="mt-auto w-full" onClick={onAction}>
        {actionLabel}
      </MvpButton>
    </MvpCard>
  );
}

export function MvpProgressRing({
  value,
  label,
}: {
  readonly value: number;
  readonly label: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  const style: CSSProperties & Record<'--mvp-progress', string> = {
    '--mvp-progress': `${safeValue}%`,
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-16 w-16 place-items-center rounded-pill"
        style={{
          ...style,
          background: 'conic-gradient(var(--accent-1) var(--mvp-progress), var(--line-1) 0)',
        }}
        aria-label={`${label} ${safeValue}%`}
        role="img"
      >
        <div className="grid h-12 w-12 place-items-center rounded-pill bg-paper text-body font-bold text-ink">
          {safeValue}%
        </div>
      </div>
      <div>
        <p className="text-body font-semibold text-ink">{label}</p>
        <p className="text-tiny text-ink-3">{HOME_COPY.completedProgressLabel}</p>
      </div>
    </div>
  );
}

export function MvpFilterPanel({
  open,
  children,
  className = '',
}: {
  readonly open: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  if (!open) return null;
  return (
    <MvpCard className={['absolute right-0 top-12 z-20 w-72 p-4', className].join(' ')}>
      {children}
    </MvpCard>
  );
}

export function MvpPage({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  testId,
  hideHeading = false,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly hideHeading?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-8 md:py-6" data-testid={testId}>
      {hideHeading ? (
        <>
          <h1 className="sr-only">{title}</h1>
          {action ? <div className="mb-5 flex justify-end">{action}</div> : null}
        </>
      ) : (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow ? (
              <p className="mb-2 text-tiny font-semibold uppercase tracking-eyebrow text-accent">{eyebrow}</p>
            ) : null}
            <h1 className="text-h1 font-bold tracking-normal text-ink">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-2xl text-body leading-6 text-ink-3">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const primaryNav = [
  { to: '/dashboard', label: '首页', icon: Home, testId: 'mvp-nav-dashboard' },
  { to: '/practice/center', label: '练习', icon: Target, testId: 'mvp-nav-practice' },
  { to: '/wrong-book', label: '复盘', icon: RefreshCcw, testId: 'mvp-nav-wrong-book' },
  { to: '/notes', label: '沉淀', icon: NotebookPen, testId: 'mvp-nav-notes' },
  { to: '/plan', label: '计划', icon: ClipboardList, testId: 'mvp-nav-plan' },
  { to: '/progress', label: '进度', icon: BarChart3, testId: 'mvp-nav-progress' },
  { to: '/profile', label: '我的', icon: User, testId: 'mvp-nav-profile' },
] as const;

function isActivePath(pathname: string, to: string): boolean {
  if (to === '/dashboard') return pathname === '/dashboard' || pathname === '/app' || pathname === '/study/today';
  if (to === '/practice/center') return pathname.startsWith('/practice') || pathname.startsWith('/essay');
  if (to === '/wrong-book') return pathname.startsWith('/wrong-book');
  if (to === '/notes') return pathname.startsWith('/notes');
  return pathname === to;
}

export function MvpShell() {
  const location = useLocation();
  return (
    <div className="min-h-dvh bg-paper-2 text-ink" data-testid="mvp-shell">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-8">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-ink" data-testid="mvp-brand">
            <span className="grid h-9 w-9 place-items-center rounded-card bg-accent text-white">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-body font-bold">SIKAO</span>
          </NavLink>
          <nav aria-label="主导航" className="ml-auto hidden items-center gap-1 lg:flex">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(location.pathname, item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  data-testid={item.testId}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-2 rounded-tiny px-3 text-body font-semibold transition-colors',
                    active ? 'bg-accent-50 text-accent' : 'text-ink-3 hover:bg-paper-2 hover:text-ink',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <nav
        aria-label={HOME_COPY.mobileNavAriaLabel}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper px-2 py-2 lg:hidden"
      >
        {primaryNav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActivePath(location.pathname, item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`${item.testId}-mobile`}
              className={cn(
                'flex min-h-12 flex-col items-center justify-center gap-1 rounded-tiny text-tiny font-semibold',
                active ? 'bg-accent-50 text-accent' : 'text-ink-3',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
