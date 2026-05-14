import { Button } from '@sikao/ui/ui';
import { HomeHero } from './HomeHero';

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
          把考点想清楚
        </>
      }
      description="按套卷练习 · 自动判分 · 错题回看。专为公考真题场景设计，不做花哨功能。"
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
          查看全部题库
        </Button>
      }
    />
  );
}
