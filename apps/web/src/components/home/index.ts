// Phase 3.1 home barrel — same rationale as components/ui/index.ts: keep this
// file pure .ts so react-refresh/only-export-components stays quiet.

export { HomeHero } from './HomeHero';
export type { HomeHeroProps } from './HomeHero';

export { PaperListCard } from './PaperListCard';
export type { PaperListCardProps } from './PaperListCard';

export { HomePageSkeleton } from './HomePageSkeleton';

export { HeroSection } from './HeroSection';
export { PaperListSection } from './PaperListSection';
export { HomeContinueCard } from './HomeContinueCard';
export { pickContinueAction } from './pickContinueAction';
export type { ContinueAction } from './pickContinueAction';

export { CategoryChipRow } from './CategoryChipRow';
export { EssayPreviewCard } from './EssayPreviewCard';
export { HomeMoreFeatures } from './HomeMoreFeatures';

export { RecentWrongMini } from './RecentWrongMini';
export type { RecentWrongMiniProps } from './RecentWrongMini';
