import { useMemo } from 'react';
import { Button } from '@sikao/ui/ui';
import { HomeHero } from './HomeHero';
import type { ContinueAction } from './pickContinueAction';
import type { PaperSummaryV2, PracticeSessionSummaryV2 } from '@sikao/api-client/types/api';
import { HOME_COPY } from '@/lib/ui-copy';

// HomeContinueCard — 学习中心首页 §1 Hero. 三级 fallback (今日计划 → 最近未完
// 卷 → 推荐第 1 卷). 调性: 备考同伴, 不喊话; 单 CTA 主行动 + ghost 次行动.
//
// 不 mutation: 任务 fallback 跳 /dashboard#today-plan 让 TodayPlanCard 接管
// (Home 不持有 startStudyPlanSession + usePatchStudyTask, 减少表面积).
// 未完 session fallback 直接跳 /practice/sessions/{id} 复用既有 immersive view.

interface HomeContinueCardProps {
  readonly action: ContinueAction;
  readonly onPickTask: () => void;
  readonly onContinueSession: (session: PracticeSessionSummaryV2) => void;
  readonly onStartPaper: (paper: PaperSummaryV2) => void;
  readonly onSecondary: () => void;
}

export function HomeContinueCard({
  action,
  onPickTask,
  onContinueSession,
  onStartPaper,
  onSecondary,
}: HomeContinueCardProps) {
  const view = useMemo(() => buildHeroView(action), [action]);

  const primary =
    action.kind === 'empty' ? null : (
      <Button
        variant="primary"
        onClick={() => {
          if (action.kind === 'task') onPickTask();
          else if (action.kind === 'session') onContinueSession(action.session);
          else if (action.kind === 'paper') onStartPaper(action.paper);
        }}
        data-testid={`home-continue-${action.kind}`}
      >
        {view.cta}
      </Button>
    );

  // onClick 仅给 smooth scroll 体验, 不 preventDefault — native anchor (CMD-click /
  // 中键 / 右键 复制地址) 全部保留. (subagent review 2026-05-08 P2 #3)
  const handleSecondary = () => onSecondary();

  return (
    <HomeHero
      eyebrow={view.eyebrow}
      title={view.title}
      description={view.description}
      primaryCta={primary}
      secondaryCta={
        // a + href="#paper-list" 让 a11y / middle-click / hover URL 预览全
        // 拿回来 (subagent review 2026-05-08 P2 #3). onClick smooth scroll.
        //
        // Brand v2 PR1 (2026-05-08): ghost button 从 border + bg-surface 框感
        // 改 text-link 风 (design 静读-E-flomo风.html line 307-317 .btn-text 同款).
        // 主 CTA ink 黑底白字保留单一锚点, secondary 退到 muted 文字 + hover ink
        // 升对比 + underline (a11y 色盲用户). 减视觉密度, 跟 paper-tint 调性对齐.
        <a
          href="#paper-list"
          onClick={handleSecondary}
          className="inline-flex items-center justify-center px-2 py-2 text-sm font-medium text-ink-3 hover:text-ink underline underline-offset-4 decoration-line hover:decoration-ink-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 rounded-tiny"
          data-testid="home-cta-secondary"
        >
          {HOME_COPY.continueViewAll}
        </a>
      }
    />
  );
}

interface HeroView {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly cta: string;
}

function buildHeroView(action: ContinueAction): HeroView {
  if (action.kind === 'task') {
    return {
      eyebrow: '今日计划',
      title: action.task.payload.title,
      description: action.task.payload.subtitle ?? `${HOME_COPY.continueTodayPrefix}，${HOME_COPY.continueTodaySuffix}。`,
      cta: '去做这个 →',
    };
  }
  if (action.kind === 'session') {
    const remain = action.session.totalQuestions - action.session.answeredQuestions;
    const paperName = action.session.paperName ?? HOME_COPY.continueLast;
    return {
      eyebrow: '继续上次',
      title: paperName,
      description:
        remain > 0
          ? `还剩 ${remain} 题没做，${HOME_COPY.continueResume}。`
          : `${HOME_COPY.continueFinished}，${HOME_COPY.continueFinishedHint}。`,
      cta: '继续做 →',
    };
  }
  if (action.kind === 'paper') {
    return {
      eyebrow: '今日推荐',
      title: action.paper.paperName,
      description: `${HOME_COPY.continueByPaper} · 自动判分 · 错题回看。选这卷，${HOME_COPY.continueByPaperHint}。`,
      cta: '开始练习 →',
    };
  }
  return {
    eyebrow: '正在准备',
    title: HOME_COPY.continueImporting,
    // 不许诺时长 — fail-fast 延伸: false ETA 等 5 分钟还没好就掉信任.
    // (subagent review 2026-05-08 P2 修法 #5)
    description: `${HOME_COPY.continuePreparing}，${HOME_COPY.continuePreparingHint1}。${HOME_COPY.continuePreparingHint2}。`,
    cta: '',
  };
}
