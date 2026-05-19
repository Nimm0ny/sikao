export const ROUTE_MAP = {
  app: '/app',
  login: '/login',
  dashboard: '/dashboard',
  studyOnboarding: '/study/onboarding',
  studyToday: '/study/today',
  bindEmail: '/bind-email',
  bindPhone: '/bind-phone',
  practiceCenter: '/practice/center',
  legacyXingcePapers: '/papers',
  legacyEssayPapers: '/essay/papers',
} as const;

export type PracticeCenterSubject = 'xingce' | 'essay';
export type PracticeCenterCollection = 'categories' | 'papers';

type PracticeCenterPath<
  TSubject extends PracticeCenterSubject,
  TCollection extends PracticeCenterCollection,
> = `/practice/center/${TSubject}/${TCollection}`;

export function buildPracticeCenterPath<
  TSubject extends PracticeCenterSubject,
  TCollection extends PracticeCenterCollection,
>(
  subject: TSubject,
  collection: TCollection,
): PracticeCenterPath<TSubject, TCollection> {
  return `${ROUTE_MAP.practiceCenter}/${subject}/${collection}` as PracticeCenterPath<
    TSubject,
    TCollection
  >;
}

export const LEGACY_QUERY_PRESERVE_REDIRECTS = {
  xingcePapers: {
    from: ROUTE_MAP.legacyXingcePapers,
    to: buildPracticeCenterPath('xingce', 'papers'),
  },
  essayPapers: {
    from: ROUTE_MAP.legacyEssayPapers,
    to: buildPracticeCenterPath('essay', 'papers'),
  },
} as const;

export const ONBOARDING_ALLOWED_PATHS: ReadonlySet<string> = new Set([
  ROUTE_MAP.studyOnboarding,
  ROUTE_MAP.bindEmail,
  ROUTE_MAP.bindPhone,
]);
