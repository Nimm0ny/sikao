import type { PracticeSessionSummary, WeakModule } from '@sikao/domain/dashboard/useHomeData';
import { PRACTICE_CENTER_COPY } from '@/lib/ui-copy';

export type Subject = 'xingce' | 'essay';
export type DifficultyFilter = 'all' | 'basic' | 'standard' | 'sprint';
export type ModeFilter = 'all' | 'categories' | 'papers' | 'review';
export type SourceFilter = 'all' | 'real' | 'recommended' | 'favorites';

export type FilterState = {
  readonly difficulty: DifficultyFilter;
  readonly mode: ModeFilter;
  readonly source: SourceFilter;
};

export type FilterKey = keyof FilterState;

export type PracticeFilterDefinition = {
  readonly key: FilterKey;
  readonly label: string;
  readonly options: ReadonlyArray<{
    readonly value: FilterState[FilterKey];
    readonly label: string;
  }>;
};

export type PracticeHeroModel = {
  readonly chipTone: 'blue' | 'amber';
  readonly title: string;
  readonly context: string;
  readonly description: string;
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
  readonly primaryTarget: string;
  readonly secondaryTarget: string;
};

export type SubjectConfig = {
  readonly tab: string;
  readonly stateTitle: string;
  readonly stateDescription: string;
  readonly categoriesLabel: string;
  readonly papersLabel: string;
  readonly focusEmpty: string;
  readonly reason: string;
  readonly categoriesPath: string;
  readonly papersPath: string;
};

export const subjectConfigs: Record<Subject, SubjectConfig> = {
  xingce: {
    ...PRACTICE_CENTER_COPY.subjects.xingce,
    categoriesPath: '/practice/center/xingce/categories',
    papersPath: '/practice/center/xingce/papers',
  },
  essay: {
    ...PRACTICE_CENTER_COPY.subjects.essay,
    categoriesPath: '/practice/center/essay/categories',
    papersPath: '/practice/center/essay/papers',
  },
};

export const filterDefinitions: readonly PracticeFilterDefinition[] = [
  {
    key: 'difficulty',
    label: PRACTICE_CENTER_COPY.filters.difficulty.label,
    options: [
      { value: 'all', label: PRACTICE_CENTER_COPY.filters.difficulty.options.all },
      { value: 'basic', label: PRACTICE_CENTER_COPY.filters.difficulty.options.basic },
      { value: 'standard', label: PRACTICE_CENTER_COPY.filters.difficulty.options.standard },
      { value: 'sprint', label: PRACTICE_CENTER_COPY.filters.difficulty.options.sprint },
    ],
  },
  {
    key: 'mode',
    label: PRACTICE_CENTER_COPY.filters.mode.label,
    options: [
      { value: 'all', label: PRACTICE_CENTER_COPY.filters.mode.options.all },
      { value: 'categories', label: PRACTICE_CENTER_COPY.filters.mode.options.categories },
      { value: 'papers', label: PRACTICE_CENTER_COPY.filters.mode.options.papers },
      { value: 'review', label: PRACTICE_CENTER_COPY.filters.mode.options.review },
    ],
  },
  {
    key: 'source',
    label: PRACTICE_CENTER_COPY.filters.source.label,
    options: [
      { value: 'all', label: PRACTICE_CENTER_COPY.filters.source.options.all },
      { value: 'real', label: PRACTICE_CENTER_COPY.filters.source.options.real },
      { value: 'recommended', label: PRACTICE_CENTER_COPY.filters.source.options.recommended },
      { value: 'favorites', label: PRACTICE_CENTER_COPY.filters.source.options.favorites },
    ],
  },
];

export const defaultFilters: FilterState = {
  difficulty: 'all',
  mode: 'all',
  source: 'all',
};

export function parseSubject(raw: string | null): Subject {
  return raw === 'essay' ? 'essay' : 'xingce';
}

export function buildWeakTarget(config: SubjectConfig, module: WeakModule | null): string {
  if (module === null) return config.categoriesPath;
  return `${config.categoriesPath}#${encodeURIComponent(module.subject)}`;
}

function getFilterLabel(key: FilterKey, value: FilterState[FilterKey]): string {
  const definition = filterDefinitions.find((item) => item.key === key);
  if (definition === undefined) return '';
  return definition.options.find((option) => option.value === value)?.label ?? '';
}

export function getActiveFilterLabels(filters: FilterState): readonly string[] {
  const labels: string[] = [];

  if (filters.difficulty !== 'all') {
    labels.push(getFilterLabel('difficulty', filters.difficulty));
  }

  if (filters.mode !== 'all') {
    labels.push(getFilterLabel('mode', filters.mode));
  }

  if (filters.source !== 'all') {
    labels.push(getFilterLabel('source', filters.source));
  }

  return labels;
}

export function buildHeroModel({
  subject,
  config,
  filters,
  lastSession,
  weakModule,
}: {
  readonly subject: Subject;
  readonly config: SubjectConfig;
  readonly filters: FilterState;
  readonly lastSession: PracticeSessionSummary | null;
  readonly weakModule: WeakModule | null;
}): PracticeHeroModel {
  const categoriesTarget = buildWeakTarget(config, weakModule);
  const papersTarget = config.papersPath;

  if (filters.mode === 'review') {
    return {
      chipTone: 'amber',
      title: PRACTICE_CENTER_COPY.hero.startTitle,
      context: `${PRACTICE_CENTER_COPY.hero.filterContextPrefix} ${getFilterLabel('mode', filters.mode)}`,
      description: PRACTICE_CENTER_COPY.hero.weakDescription,
      primaryLabel: PRACTICE_CENTER_COPY.hero.primary.review,
      secondaryLabel: PRACTICE_CENTER_COPY.hero.secondary.categories,
      primaryTarget: '/wrong-book',
      secondaryTarget: categoriesTarget,
    };
  }

  if (filters.mode === 'papers') {
    return {
      chipTone: 'amber',
      title: PRACTICE_CENTER_COPY.hero.startTitle,
      context: `${PRACTICE_CENTER_COPY.hero.filterContextPrefix} ${getFilterLabel('mode', filters.mode)}`,
      description: PRACTICE_CENTER_COPY.hero.startDescription,
      primaryLabel: PRACTICE_CENTER_COPY.hero.primary.papers,
      secondaryLabel: PRACTICE_CENTER_COPY.hero.secondary.categories,
      primaryTarget: papersTarget,
      secondaryTarget: categoriesTarget,
    };
  }

  if (filters.mode === 'categories') {
    return {
      chipTone: 'amber',
      title: subject === 'essay'
        ? PRACTICE_CENTER_COPY.hero.essayTitle
        : `${PRACTICE_CENTER_COPY.hero.weakPrefix}${weakModule?.subject ?? config.tab}`,
      context: `${PRACTICE_CENTER_COPY.hero.filterContextPrefix} ${getFilterLabel('mode', filters.mode)}`,
      description: subject === 'essay'
        ? PRACTICE_CENTER_COPY.hero.essayDescription
        : PRACTICE_CENTER_COPY.hero.weakDescription,
      primaryLabel: subject === 'essay'
        ? PRACTICE_CENTER_COPY.hero.primary.essay
        : PRACTICE_CENTER_COPY.hero.primary.categories,
      secondaryLabel: PRACTICE_CENTER_COPY.hero.secondary.papers,
      primaryTarget: categoriesTarget,
      secondaryTarget: papersTarget,
    };
  }

  if (subject === 'xingce' && lastSession !== null) {
    return {
      chipTone: 'blue',
      title: PRACTICE_CENTER_COPY.hero.continueTitle,
      context: PRACTICE_CENTER_COPY.hero.continueContext,
      description: PRACTICE_CENTER_COPY.hero.continueDescription,
      primaryLabel: PRACTICE_CENTER_COPY.hero.primary.continue,
      secondaryLabel: PRACTICE_CENTER_COPY.hero.secondary.papers,
      primaryTarget: `/practice/sessions/${lastSession.id}`,
      secondaryTarget: papersTarget,
    };
  }

  if (subject === 'essay') {
    return {
      chipTone: 'blue',
      title: PRACTICE_CENTER_COPY.hero.essayTitle,
      context: PRACTICE_CENTER_COPY.hero.essayContext,
      description: PRACTICE_CENTER_COPY.hero.essayDescription,
      primaryLabel: PRACTICE_CENTER_COPY.hero.primary.essay,
      secondaryLabel: PRACTICE_CENTER_COPY.hero.secondary.papers,
      primaryTarget: categoriesTarget,
      secondaryTarget: papersTarget,
    };
  }

  if (weakModule !== null) {
    return {
      chipTone: 'blue',
      title: `${PRACTICE_CENTER_COPY.hero.weakPrefix}${weakModule.subject}`,
      context: PRACTICE_CENTER_COPY.hero.weakContext,
      description: PRACTICE_CENTER_COPY.hero.weakDescription,
      primaryLabel: PRACTICE_CENTER_COPY.hero.primary.categories,
      secondaryLabel: PRACTICE_CENTER_COPY.hero.secondary.papers,
      primaryTarget: categoriesTarget,
      secondaryTarget: papersTarget,
    };
  }

  return {
    chipTone: 'blue',
    title: PRACTICE_CENTER_COPY.hero.startTitle,
    context: PRACTICE_CENTER_COPY.hero.startContext,
    description: PRACTICE_CENTER_COPY.hero.startDescription,
    primaryLabel: PRACTICE_CENTER_COPY.hero.primary.start,
    secondaryLabel: PRACTICE_CENTER_COPY.hero.secondary.papers,
    primaryTarget: categoriesTarget,
    secondaryTarget: papersTarget,
  };
}
