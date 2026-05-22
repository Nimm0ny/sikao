import type {
  DashboardFullPlanFilters,
  DashboardWeeklyPlanFilters,
  EventWindowFilters,
  ProfileRecordsFilters,
  ProgressTimeseriesFilters,
  RecommendationHistoryFilters,
} from './types/home';

export const homeQueryKeys = {
  root: ['home-v2'] as const,
  plans: {
    all: () => [...homeQueryKeys.root, 'plans'] as const,
    list: () => [...homeQueryKeys.plans.all(), 'list'] as const,
    detail: (planId: number) => [...homeQueryKeys.plans.all(), 'detail', planId] as const,
    events: (filters: EventWindowFilters) =>
      [...homeQueryKeys.plans.all(), 'events', filters] as const,
    event: (eventId: string | number) =>
      [...homeQueryKeys.plans.all(), 'event', String(eventId)] as const,
    adjustments: (status?: string | null) =>
      [...homeQueryKeys.plans.all(), 'adjustments', status ?? 'all'] as const,
    adjustment: (adjustmentId: number) =>
      [...homeQueryKeys.plans.all(), 'adjustment', adjustmentId] as const,
  },
  recommendations: {
    all: () => [...homeQueryKeys.root, 'recommendations'] as const,
    today: () => [...homeQueryKeys.recommendations.all(), 'today'] as const,
    history: (filters: RecommendationHistoryFilters = {}) =>
      [...homeQueryKeys.recommendations.all(), 'history', filters] as const,
  },
  progress: {
    all: () => [...homeQueryKeys.root, 'progress'] as const,
    overview: (planId?: number | null) =>
      [...homeQueryKeys.progress.all(), 'overview', planId ?? 'all'] as const,
    timeseries: (filters: ProgressTimeseriesFilters) =>
      [...homeQueryKeys.progress.all(), 'timeseries', filters] as const,
    weakness: () => [...homeQueryKeys.progress.all(), 'weakness'] as const,
    diagnosis: () => [...homeQueryKeys.progress.all(), 'diagnosis'] as const,
  },
  dashboard: {
    all: () => [...homeQueryKeys.root, 'dashboard'] as const,
    overview: () => [...homeQueryKeys.dashboard.all(), 'overview'] as const,
    today: () => [...homeQueryKeys.dashboard.all(), 'today'] as const,
    todayContinue: () => [...homeQueryKeys.dashboard.all(), 'today-continue'] as const,
    todayReview: () => [...homeQueryKeys.dashboard.all(), 'today-review'] as const,
    weeklyPlan: (filters: DashboardWeeklyPlanFilters = {}) =>
      [...homeQueryKeys.dashboard.all(), 'weekly-plan', filters] as const,
    weeklyGoal: () => [...homeQueryKeys.dashboard.all(), 'weekly-goal'] as const,
    todayCompletion: () => [...homeQueryKeys.dashboard.all(), 'today-completion'] as const,
    fullPlan: (filters: DashboardFullPlanFilters) =>
      [...homeQueryKeys.dashboard.all(), 'full-plan', filters] as const,
  },
  profile: {
    all: () => [...homeQueryKeys.root, 'profile'] as const,
    info: () => [...homeQueryKeys.profile.all(), 'info'] as const,
    goals: () => [...homeQueryKeys.profile.all(), 'goals'] as const,
    records: (filters: ProfileRecordsFilters = {}) =>
      [...homeQueryKeys.profile.all(), 'records', filters] as const,
  },
} as const;
