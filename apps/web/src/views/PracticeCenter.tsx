import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Filter, Layers, Target } from 'lucide-react';
import {
  useContinueLastSession,
  useWeakModules,
} from '@sikao/domain/dashboard/useHomeData';
import { isAuthError } from '@sikao/shared-utils';
import {
  MvpButton,
  MvpCard,
  MvpChip,
  MvpFilterPanel,
  MvpPage,
} from '@/components/mvp';
import {
  PracticeEntryCard,
  PracticeFocusCard,
  PracticeHeroCard,
  PracticeReasonCard,
  RecentPracticeCard,
  type PracticeEntryModel,
  SubjectStateCard,
} from '@/components/practice-center/PracticeCenterCards';
import {
  buildHeroModel,
  buildWeakTarget,
  defaultFilters,
  filterDefinitions,
  getActiveFilterLabels,
  parseSubject,
  subjectConfigs,
  type FilterKey,
  type FilterState,
  type Subject,
} from '@/components/practice-center/practiceCenterModel';
import { PRACTICE_CENTER_COPY } from '@/lib/ui-copy';

function buildPracticeEntries(subject: Subject): readonly PracticeEntryModel[] {
  const config = subjectConfigs[subject];
  return [
    {
      icon: <Layers className="h-5 w-5" aria-hidden="true" />,
      title: PRACTICE_CENTER_COPY.entries.categories.title,
      label: config.categoriesLabel,
      description: PRACTICE_CENTER_COPY.entries.categories.description,
      actionLabel: PRACTICE_CENTER_COPY.entries.categories.action,
      testId: 'practice-entry-categories',
    },
    {
      icon: <FileText className="h-5 w-5" aria-hidden="true" />,
      title: PRACTICE_CENTER_COPY.entries.papers.title,
      label: config.papersLabel,
      description: PRACTICE_CENTER_COPY.entries.papers.description,
      actionLabel: PRACTICE_CENTER_COPY.entries.papers.action,
      testId: 'practice-entry-papers',
    },
  ];
}

export default function PracticeCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const subject = useMemo(() => parseSubject(searchParams.get('subject')), [searchParams]);
  const config = subjectConfigs[subject];
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<FilterState>(defaultFilters);

  const lastSessionQ = useContinueLastSession();
  const weakQ = useWeakModules({ limit: 3 });

  const weakModules = useMemo(
    () => (subject === 'xingce' ? weakQ.data?.modules ?? [] : []),
    [subject, weakQ.data],
  );
  const activeFilterLabels = useMemo(
    () => getActiveFilterLabels(selectedFilters),
    [selectedFilters],
  );
  const hero = useMemo(
    () =>
      buildHeroModel({
        subject,
        config,
        filters: selectedFilters,
        lastSession: lastSessionQ.data ?? null,
        weakModule: weakModules[0] ?? null,
      }),
    [config, lastSessionQ.data, selectedFilters, subject, weakModules],
  );
  const entries = useMemo(() => buildPracticeEntries(subject), [subject]);
  const heroLoading = subject === 'xingce' && (lastSessionQ.isLoading || weakQ.isLoading);
  const heroError = subject === 'xingce' && (lastSessionQ.isError || weakQ.isError);

  const hasAuthError = isAuthError(lastSessionQ.error) || isAuthError(weakQ.error);

  const setFilter = <K extends FilterKey>(key: K, value: FilterState[K]) => {
    setSelectedFilters((current) => ({ ...current, [key]: value }));
  };

  const changeSubject = (next: Subject) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'xingce') params.delete('subject');
    else params.set('subject', next);
    setSearchParams(params, { replace: true });
  };

  if (hasAuthError) {
    return (
      <MvpPage title={PRACTICE_CENTER_COPY.pageTitle} hideHeading testId="practice-center-view">
        <MvpCard className="mx-auto max-w-2xl p-8 text-center" testId="practice-center-auth-fallback">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-card bg-accent-50 text-accent">
            <Target className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-h2 font-semibold text-ink">{PRACTICE_CENTER_COPY.auth.title}</h2>
          <p className="mx-auto mt-2 max-w-md text-body leading-6 text-ink-3">
            {PRACTICE_CENTER_COPY.auth.description}
          </p>
          <MvpButton
            className="mx-auto mt-6"
            onClick={() => navigate('/login', { state: { from: `${location.pathname}${location.search}` } })}
            data-testid="practice-center-auth-login"
          >
            {PRACTICE_CENTER_COPY.auth.action}
          </MvpButton>
        </MvpCard>
      </MvpPage>
    );
  }

  return (
    <MvpPage
      eyebrow={PRACTICE_CENTER_COPY.pageEyebrow}
      title={PRACTICE_CENTER_COPY.pageTitle}
      subtitle={PRACTICE_CENTER_COPY.pageSubtitle}
      action={(
        <div className="relative">
          <MvpButton
            variant="secondary"
            icon={<Filter className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
            data-testid="practice-filter-toggle"
          >
            {PRACTICE_CENTER_COPY.filterToggle}
            {activeFilterLabels.length > 0 ? ` ${activeFilterLabels.length}` : ''}
          </MvpButton>
          <MvpFilterPanel open={filterOpen}>
            <div className="space-y-4" data-testid="practice-filter-panel">
              {filterDefinitions.map((filter) => (
                <label key={filter.key} className="grid gap-2 text-body font-semibold text-ink">
                  <span>{filter.label}</span>
                  <select
                    value={selectedFilters[filter.key]}
                    onChange={(event) => {
                      setFilter(filter.key, event.target.value as FilterState[typeof filter.key]);
                    }}
                    className="h-10 rounded-tiny border border-line-2 bg-paper px-3 text-body font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <MvpButton className="w-full" onClick={() => setFilterOpen(false)}>
                {PRACTICE_CENTER_COPY.filterApply}
              </MvpButton>
            </div>
          </MvpFilterPanel>
        </div>
      )}
      testId="practice-center-view"
    >
      <div className="space-y-5">
        <div
          className="inline-flex rounded-card border border-line bg-paper p-1"
          role="tablist"
          aria-label="练习科目"
          data-testid="practice-center-tabs"
        >
          {(Object.keys(subjectConfigs) as readonly Subject[]).map((item) => {
            const active = item === subject;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                className={[
                  'min-h-10 rounded-tiny px-5 text-body font-semibold transition-colors',
                  active ? 'bg-accent text-white' : 'text-ink-3 hover:bg-accent-50 hover:text-accent',
                ].join(' ')}
                onClick={() => changeSubject(item)}
                data-testid={`practice-center-tab-${item}`}
              >
                {subjectConfigs[item].tab}
              </button>
            );
          })}
        </div>

        {activeFilterLabels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="practice-filter-summary">
            <span className="text-tiny font-semibold uppercase tracking-eyebrow text-accent">
              {PRACTICE_CENTER_COPY.filterSummaryPrefix}
            </span>
            {activeFilterLabels.map((label) => (
              <MvpChip key={label} tone="blue">
                {label}
              </MvpChip>
            ))}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <PracticeHeroCard
              hero={hero}
              loading={heroLoading}
              error={heroError}
              onPrimary={() => navigate(hero.primaryTarget)}
              onSecondary={() => navigate(hero.secondaryTarget)}
              onRetry={() => {
                void lastSessionQ.refetch();
                if (subject === 'xingce') {
                  void weakQ.refetch();
                }
              }}
            />

            <section className="grid gap-5 md:grid-cols-2" aria-label={PRACTICE_CENTER_COPY.sections.entries}>
              {entries.map((entry, index) => (
                <PracticeEntryCard
                  key={entry.testId}
                  entry={entry}
                  onClick={() => navigate(index === 0 ? config.categoriesPath : config.papersPath)}
                />
              ))}
            </section>

            <section className="grid gap-5 md:grid-cols-2" aria-label={PRACTICE_CENTER_COPY.sections.support}>
              <RecentPracticeCard
                loading={lastSessionQ.isLoading}
                error={lastSessionQ.isError}
                session={lastSessionQ.data ?? null}
                onResume={(session) => navigate(`/practice/sessions/${session.id}`)}
                onOpenPapers={() => navigate(config.papersPath)}
              />
              <SubjectStateCard
                title={config.stateTitle}
                description={config.stateDescription}
                activeFilterLabels={activeFilterLabels}
                onOpenCategories={() => navigate(config.categoriesPath)}
                onOpenPapers={() => navigate(config.papersPath)}
              />
            </section>
          </div>

          <aside className="space-y-5">
            <PracticeFocusCard
              subject={subject}
              loading={weakQ.isLoading && subject === 'xingce'}
              error={weakQ.isError && subject === 'xingce'}
              modules={weakModules}
              onPracticeModule={(module) => navigate(buildWeakTarget(config, module))}
              onOpenCategories={() => navigate(config.categoriesPath)}
              onOpenPapers={() => navigate(config.papersPath)}
            />
            <PracticeReasonCard
              subjectReason={config.reason}
              activeFilterLabels={activeFilterLabels}
            />
          </aside>
        </div>
      </div>
    </MvpPage>
  );
}
