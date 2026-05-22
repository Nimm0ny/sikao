import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Home,
  NotebookPen,
  RefreshCcw,
  Target,
  User,
} from 'lucide-react';

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
      className={[
        'rounded-lg border border-[#E1E6F0] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]',
        className,
      ].join(' ')}
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
  const variantClass =
    variant === 'primary'
      ? 'border-[#2563EB] bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
      : variant === 'secondary'
        ? 'border-[#B8C4D8] bg-white text-[#111827] hover:bg-[#F7F8FB]'
        : 'border-transparent bg-transparent text-[#2563EB] hover:bg-[#EFF6FF]';
  return (
    <button
      type={type}
      className={[
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variantClass,
        className,
      ].join(' ')}
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
      title={label}
      className={[
        'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D7DFEC] bg-white text-[#4B5563] transition-colors',
        'hover:bg-[#EFF6FF] hover:text-[#2563EB]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}

export function MvpChip({
  children,
  tone = 'default',
}: {
  readonly children: ReactNode;
  readonly tone?: 'default' | 'blue' | 'green' | 'amber';
}) {
  const toneClass =
    tone === 'blue'
      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
      : tone === 'green'
        ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
        : tone === 'amber'
          ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
          : 'border-[#E1E6F0] bg-[#F7F8FB] text-[#4B5563]';
  return (
    <span className={['inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', toneClass].join(' ')}>
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
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#111827]">{title}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-[#4B5563]">{description}</p>
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
  const style = {
    '--mvp-progress': `${safeValue}%`,
  } as CSSProperties;
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-16 w-16 place-items-center rounded-full"
        style={{
          ...style,
          background: `conic-gradient(#2563EB var(--mvp-progress), #E5EAF3 0)`,
        }}
        aria-label={`${label} ${safeValue}%`}
        role="img"
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-sm font-bold text-[#111827]">
          {safeValue}%
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-[#111827]">{label}</p>
        <p className="text-xs text-[#4B5563]">已完成进度</p>
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
    <div className="mx-auto w-full max-w-[1280px] px-4 py-5 md:px-8 md:py-6" data-testid={testId}>
      {hideHeading ? (
        <>
          <h1 className="sr-only">{title}</h1>
          {action ? <div className="mb-5 flex justify-end">{action}</div> : null}
        </>
      ) : (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#2563EB]">{eyebrow}</p>
            ) : null}
            <h1 className="text-2xl font-bold tracking-normal text-[#111827] md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4B5563]">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const primaryNav = [
  { to: '/', label: '首页', icon: Home, testId: 'mvp-nav-home' },
  { to: '/practice', label: '练习', icon: Target, testId: 'mvp-nav-practice' },
  { to: '/review', label: '复盘', icon: RefreshCcw, testId: 'mvp-nav-review' },
  { to: '/notes', label: '笔记', icon: NotebookPen, testId: 'mvp-nav-notes' },
  { to: '/profile', label: '我的', icon: User, testId: 'mvp-nav-profile' },
] as const;

function isActivePath(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/' || pathname === '/app' || pathname === '/study/today';
  if (to === '/practice') return pathname.startsWith('/practice') || pathname.startsWith('/essay');
  if (to === '/review') return pathname.startsWith('/review') || pathname.startsWith('/wrong-book');
  if (to === '/notes') return pathname.startsWith('/notes');
  if (to === '/profile') {
    return pathname.startsWith('/profile') || pathname === '/me';
  }
  return pathname === to;
}

export function MvpShell({ children }: { readonly children?: ReactNode }) {
  const location = useLocation();
  return (
    <div className="min-h-dvh bg-[#F7F8FB] text-[#111827]" data-testid="mvp-shell">
      <header className="sticky top-0 z-30 border-b border-[#E1E6F0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 md:px-8">
          <NavLink to="/" className="flex items-center gap-2 text-[#111827]" data-testid="mvp-brand">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2563EB] text-white">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-bold">SIKAO</span>
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
                  className={[
                    'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors',
                    active ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#4B5563] hover:bg-[#F7F8FB] hover:text-[#111827]',
                  ].join(' ')}
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
        {children ?? <Outlet />}
      </main>
      <nav
        aria-label="移动主导航"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#E1E6F0] bg-white px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2 lg:hidden"
      >
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(location.pathname, item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`${item.testId}-mobile`}
              className={[
                'flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold',
                active ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#4B5563]',
              ].join(' ')}
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
