import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookMarked,
  ChevronRight,
  History,
  Loader2,
  RefreshCcw,
  Target,
} from 'lucide-react';
import type {
  PracticeSessionSummary,
  WeakModule,
} from '@sikao/domain/dashboard/useHomeData';
import {
  MvpButton,
  MvpCard,
  MvpChip,
} from '@/components/mvp';
import { PRACTICE_CENTER_COPY } from '@/lib/ui-copy';
import type { PracticeHeroModel, Subject } from './practiceCenterModel';
import { subjectConfigs } from './practiceCenterModel';

export type PracticeEntryModel = {
  readonly icon: ReactNode;
  readonly title: string;
  readonly label: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly testId: string;
};

export function PracticeHeroCard({
  hero,
  loading,
  error,
  onPrimary,
  onSecondary,
  onRetry,
}: {
  readonly hero: PracticeHeroModel;
  readonly loading: boolean;
  readonly error: boolean;
  readonly onPrimary: () => void;
  readonly onSecondary: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <MvpCard className="p-6 md:p-8" testId="practice-center-hero">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <MvpChip tone={hero.chipTone}>{PRACTICE_CENTER_COPY.hero.chip}</MvpChip>
        <span className="text-tiny font-semibold uppercase tracking-eyebrow text-accent">
          {hero.context}
        </span>
      </div>
      {loading ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3" data-testid="practice-center-hero-loading">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
          <p className="text-body text-ink-3">{PRACTICE_CENTER_COPY.hero.loading}</p>
        </div>
      ) : error ? (
        <div className="space-y-4" data-testid="practice-center-hero-error">
          <div className="flex h-14 w-14 items-center justify-center rounded-card bg-bad-bg text-err">
            <RefreshCcw className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-h2 font-semibold text-ink">{hero.title}</h2>
          <p className="max-w-2xl text-body leading-6 text-ink-3">{PRACTICE_CENTER_COPY.hero.error}</p>
          <MvpButton variant="secondary" onClick={onRetry} data-testid="practice-center-hero-retry">
            {PRACTICE_CENTER_COPY.hero.retry}
          </MvpButton>
        </div>
      ) : (
        <>
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-card bg-accent-50 text-accent">
            <Target className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-h2 font-semibold text-ink">{hero.title}</h2>
          <p className="mt-3 max-w-2xl text-body leading-6 text-ink-3">{hero.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MvpButton
              className="sm:min-w-52"
              icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              onClick={onPrimary}
              data-practice-role="primary-next-action"
              data-testid="practice-center-hero-primary"
            >
              {hero.primaryLabel}
            </MvpButton>
            <MvpButton
              variant="secondary"
              className="sm:min-w-44"
              onClick={onSecondary}
              data-testid="practice-center-hero-secondary"
            >
              {hero.secondaryLabel}
            </MvpButton>
          </div>
        </>
      )}
    </MvpCard>
  );
}

export function PracticeEntryCard({
  entry,
  onClick,
}: {
  readonly entry: PracticeEntryModel;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left"
      data-testid={entry.testId}
      aria-label={`${entry.title}：${entry.label}`}
    >
      <MvpCard className="flex h-full min-h-52 flex-col p-5 transition-transform group-hover:-translate-y-0.5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-card bg-accent-50 text-accent">
            {entry.icon}
          </span>
          <ChevronRight className="h-5 w-5 text-ink-4" aria-hidden="true" />
        </div>
        <h2 className="text-h3 font-semibold text-ink">{entry.title}</h2>
        <p className="mt-3 text-body font-semibold text-ink">{entry.label}</p>
        <p className="mt-2 text-body leading-6 text-ink-3">{entry.description}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-body font-semibold text-accent">
          {entry.actionLabel}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </MvpCard>
    </button>
  );
}

export function RecentPracticeCard({
  loading,
  error,
  session,
  onResume,
  onOpenPapers,
}: {
  readonly loading: boolean;
  readonly error: boolean;
  readonly session: PracticeSessionSummary | null;
  readonly onResume: (session: PracticeSessionSummary) => void;
  readonly onOpenPapers: () => void;
}) {
  return (
    <MvpCard className="p-5" testId="practice-recent-card">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-h3 font-semibold text-ink">{PRACTICE_CENTER_COPY.recent.title}</h2>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-body text-ink-3" data-testid="practice-recent-loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {PRACTICE_CENTER_COPY.recent.loading}
        </p>
      ) : error ? (
        <p className="rounded-card bg-bad-bg p-3 text-body text-err" data-testid="practice-recent-error">
          {PRACTICE_CENTER_COPY.recent.error}
        </p>
      ) : session ? (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-ink">{session.paperTitle}</p>
            <p className="mt-1 text-body text-ink-3">
              {session.answeredCount} / {session.total} {PRACTICE_CENTER_COPY.recent.questionUnit}
            </p>
          </div>
          <MvpButton variant="secondary" onClick={() => onResume(session)}>
            {PRACTICE_CENTER_COPY.recent.resume}
          </MvpButton>
        </div>
      ) : (
        <div data-testid="practice-recent-empty">
          <p className="text-body leading-6 text-ink-3">{PRACTICE_CENTER_COPY.recent.empty}</p>
          <MvpButton variant="secondary" className="mt-4" onClick={onOpenPapers}>
            {PRACTICE_CENTER_COPY.recent.openPapers}
          </MvpButton>
        </div>
      )}
    </MvpCard>
  );
}

export function SubjectStateCard({
  title,
  description,
  activeFilterLabels,
  onOpenCategories,
  onOpenPapers,
}: {
  readonly title: string;
  readonly description: string;
  readonly activeFilterLabels: readonly string[];
  readonly onOpenCategories: () => void;
  readonly onOpenPapers: () => void;
}) {
  return (
    <MvpCard className="p-5" testId="practice-center-subject-state">
      <div className="mb-4 flex items-center gap-2">
        <BookMarked className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-h3 font-semibold text-ink">{PRACTICE_CENTER_COPY.state.title}</h2>
      </div>
      <p className="text-body font-semibold text-ink">{title}</p>
      <p className="mt-2 text-body leading-6 text-ink-3">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {activeFilterLabels.length === 0 ? (
          <MvpChip>{PRACTICE_CENTER_COPY.state.activeFiltersNone}</MvpChip>
        ) : (
          <>
            <MvpChip tone="blue">{PRACTICE_CENTER_COPY.state.activeFiltersSome}</MvpChip>
            {activeFilterLabels.map((label) => (
              <MvpChip key={label}>{label}</MvpChip>
            ))}
          </>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <MvpButton variant="secondary" onClick={onOpenCategories}>
          {PRACTICE_CENTER_COPY.state.categoriesAction}
        </MvpButton>
        <MvpButton variant="secondary" onClick={onOpenPapers}>
          {PRACTICE_CENTER_COPY.state.papersAction}
        </MvpButton>
      </div>
    </MvpCard>
  );
}

export function PracticeFocusCard({
  subject,
  loading,
  error,
  modules,
  onPracticeModule,
  onOpenCategories,
  onOpenPapers,
}: {
  readonly subject: Subject;
  readonly loading: boolean;
  readonly error: boolean;
  readonly modules: readonly WeakModule[];
  readonly onPracticeModule: (module: WeakModule) => void;
  readonly onOpenCategories: () => void;
  readonly onOpenPapers: () => void;
}) {
  if (subject === 'essay') {
    return (
      <MvpCard className="p-5" testId="practice-focus-card">
        <div className="mb-4 flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-accent" aria-hidden="true" />
          <h2 className="text-h3 font-semibold text-ink">{PRACTICE_CENTER_COPY.focus.title}</h2>
        </div>
        <p className="text-body leading-6 text-ink-3">{subjectConfigs.essay.focusEmpty}</p>
        <div className="mt-5 grid gap-3">
          <MvpButton variant="secondary" onClick={onOpenCategories} data-testid="practice-focus-essay-categories">
            {PRACTICE_CENTER_COPY.focus.essayCategories}
          </MvpButton>
          <MvpButton variant="secondary" onClick={onOpenPapers} data-testid="practice-focus-essay-papers">
            {PRACTICE_CENTER_COPY.focus.essayPapers}
          </MvpButton>
        </div>
      </MvpCard>
    );
  }

  return (
    <MvpCard className="p-5" testId="practice-focus-card">
      <div className="mb-4 flex items-center gap-2">
        <BookMarked className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-h3 font-semibold text-ink">{PRACTICE_CENTER_COPY.focus.title}</h2>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-body text-ink-3" data-testid="practice-focus-loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {PRACTICE_CENTER_COPY.focus.loading}
        </p>
      ) : error ? (
        <p className="rounded-card bg-bad-bg p-3 text-body text-err" data-testid="practice-focus-error">
          {PRACTICE_CENTER_COPY.focus.error}
        </p>
      ) : modules.length === 0 ? (
        <div data-testid="practice-focus-empty">
          <p className="text-body leading-6 text-ink-3">{subjectConfigs.xingce.focusEmpty}</p>
          <MvpButton variant="secondary" className="mt-4" onClick={onOpenCategories}>
            {PRACTICE_CENTER_COPY.entries.categories.action}
          </MvpButton>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((module) => (
            <button
              key={module.subject}
              type="button"
              onClick={() => onPracticeModule(module)}
              className="flex w-full items-center justify-between rounded-card border border-line bg-paper-2 p-3 text-left transition-colors hover:border-accent hover:bg-accent-50"
              data-testid={`practice-focus-${module.subject}`}
            >
              <span>
                <span className="block text-body font-semibold text-ink">{module.subject}</span>
                <span className="mt-1 block text-tiny text-ink-3">
                  {PRACTICE_CENTER_COPY.focus.weakAction}
                </span>
              </span>
              <MvpChip tone={module.score >= 70 ? 'amber' : 'blue'}>
                {Math.round(module.score)}
              </MvpChip>
            </button>
          ))}
          <div className="pt-2">
            <MvpButton variant="secondary" onClick={onOpenPapers}>
              {PRACTICE_CENTER_COPY.entries.papers.action}
            </MvpButton>
          </div>
        </div>
      )}
    </MvpCard>
  );
}

export function PracticeReasonCard({
  subjectReason,
  activeFilterLabels,
}: {
  readonly subjectReason: string;
  readonly activeFilterLabels: readonly string[];
}) {
  return (
    <MvpCard className="p-5" testId="practice-reason-card">
      <div className="mb-4 flex items-center gap-2">
        <RefreshCcw className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-h3 font-semibold text-ink">{PRACTICE_CENTER_COPY.reason.title}</h2>
      </div>
      <p className="text-body leading-6 text-ink-3">{PRACTICE_CENTER_COPY.reason.defaultLine}</p>
      <p className="mt-3 text-body leading-6 text-ink-3">{subjectReason}</p>
      {activeFilterLabels.length > 0 ? (
        <p className="mt-3 text-body leading-6 text-ink-3">
          {PRACTICE_CENTER_COPY.reason.filterLinePrefix} {activeFilterLabels.join(' / ')}
        </p>
      ) : null}
    </MvpCard>
  );
}
