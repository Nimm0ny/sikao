import { Button } from '@sikao/ui/ui';
import { HomeHero } from './HomeHero';
import { HOME_COPY } from '@/lib/ui-copy';

// HeroSection — Home 页顶部 Hero 卡 wrapper. 当前是 PoC 文案 ("每天 60 分钟,
// 把考点想清楚"); 学习中心 V1 (Phase B) 会被 HomeContinueCard 替换为基于
// useStudyPlanToday + recent unfinished session 的 3 级 fallback 行动 hero.

interface HeroSectionProps {
  readonly startDisabled: boolean;
  readonly onPrimary: () => void;
  readonly onSecondary: () => void;
}

export function HeroSection({ startDisabled, onPrimary, onSecondary }: HeroSectionProps) {
  return (
    <HomeHero
      eyebrow="2026 公考真题 · 今日推荐"
      title={
        <>
          每天 60 分钟，
          <br />
          {HOME_COPY.heroTitle}
        </>
      }
      description={`${HOME_COPY.heroSubtitle1} · 自动判分 · 错题回看。${HOME_COPY.heroSubtitle2}，${HOME_COPY.heroSubtitle3}。`}
      primaryCta={
        <Button
          variant="primary"
          disabled={startDisabled}
          onClick={onPrimary}
          data-testid="home-cta-primary"
        >
          立即开始
        </Button>
      }
      secondaryCta={
        <Button variant="ghost" onClick={onSecondary} data-testid="home-cta-secondary">
          {HOME_COPY.heroCtaAll}
        </Button>
      }
    />
  );
}
