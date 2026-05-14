import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EssayGradingCard } from '../EssayGradingCard';
import type { EssayFeedbackV2 } from '@sikao/api-client/types/api';

// Phase 1A polish: weak threshold = 0.6 of weight*10.
//  - weight 0.30 → max 3.0 → weak if score < 1.8
//  - weight 0.25 → max 2.5 → weak if score < 1.5
//  - weight 0.20 → max 2.0 → weak if score < 1.2
//  - weight 0.15 → max 1.5 → weak if score < 0.9
//  - weight 0.10 → max 1.0 → weak if score < 0.6
//
// Note: spec L60-61 "申论 Q3 默认展开,其余折叠" — Q3 (weight 0.20) 默认弱
// 是设计预期, 但本组件对所有 weak 维度生效, 不绑定 Q3 题号. 测试用真实 score
// 触发 weak 态而非依赖 question id.
const FB_BASE: EssayFeedbackV2 = {
  overallScore: 78,
  dimensions: [
    { name: '论点准确', weight: 0.3, score: 2.5, comment: '论点鲜明' },     // 2.5/3.0=0.83 not weak
    { name: '材料运用', weight: 0.25, score: 2.0, comment: '引用得当' },    // 2.0/2.5=0.80 not weak
    { name: '语言', weight: 0.2, score: 1.0, comment: '语言尚可改进' },     // 1.0/2.0=0.50 weak ✓
    { name: '结构', weight: 0.15, score: 1.2, comment: '层次清晰' },        // 1.2/1.5=0.80 not weak
    { name: '字数符合度', weight: 0.1, score: 0.4, comment: '字数偏少' },   // 0.4/1.0=0.40 weak ✓
  ],
  strengths: [],
  weaknesses: [],
  suggestions: [],
  sampleAnswer: null,
  suspicious: false,
};

// Legacy fixture: 全部分高 (0.83-1.0), 无 weak. 用于 baseline 测试.
const FB_ALL_STRONG: EssayFeedbackV2 = {
  overallScore: 88,
  dimensions: [
    { name: '论点准确', weight: 0.3, score: 2.8, comment: '论点鲜明' },
    { name: '材料运用', weight: 0.25, score: 2.3, comment: '引用得当' },
    { name: '语言', weight: 0.2, score: 1.8, comment: '语言流畅' },
    { name: '结构', weight: 0.15, score: 1.4, comment: '层次清晰' },
    { name: '字数符合度', weight: 0.1, score: 1.0, comment: '字数符合要求' },
  ],
  strengths: [],
  weaknesses: [],
  suggestions: [],
  sampleAnswer: null,
  suspicious: false,
};

describe('EssayGradingCard', () => {
  it('renders overall score + radar + 5 dimension rows when feedback complete', () => {
    render(<EssayGradingCard feedback={FB_BASE} />);
    expect(screen.getByTestId('essay-grading-card')).toBeInTheDocument();
    expect(screen.getByTestId('essay-radar')).toBeInTheDocument();
    expect(screen.getByTestId('essay-grading-dimensions-list')).toBeInTheDocument();
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`essay-grading-dimension-${i}`)).toBeInTheDocument();
    }
    // 各 dim score formatted "X.X / 10"
    expect(screen.getByTestId('essay-grading-dimension-score-0')).toHaveTextContent('2.5 / 10');
    expect(screen.getByTestId('essay-grading-dimension-score-4')).toHaveTextContent('0.4 / 10');
    // weight 转 %
    expect(screen.getByText('权重 30%')).toBeInTheDocument();
    expect(screen.getByText('权重 10%')).toBeInTheDocument();
  });

  it('does NOT render suspicious banner when suspicious=false', () => {
    render(<EssayGradingCard feedback={FB_BASE} />);
    expect(
      screen.queryByTestId('essay-grading-suspicious-banner'),
    ).not.toBeInTheDocument();
  });

  it('renders suspicious banner when suspicious=true', () => {
    render(<EssayGradingCard feedback={{ ...FB_BASE, suspicious: true }} />);
    const banner = screen.getByTestId('essay-grading-suspicious-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent('批改结果存在异常, 仅供复盘参考');
    expect(banner).toHaveClass('text-warn');
  });

  it('shows dimension comments below scores', () => {
    render(<EssayGradingCard feedback={FB_BASE} />);
    expect(screen.getByText('论点鲜明')).toBeInTheDocument();
    expect(screen.getByText('引用得当')).toBeInTheDocument();
    expect(screen.getByText('字数偏少')).toBeInTheDocument();
  });

  it('renders ScoreRing aria-label with overallScore + max=100', () => {
    render(<EssayGradingCard feedback={{ ...FB_BASE, overallScore: 92.5 }} />);
    // ScoreRing 内 round(value), 92.5 → 93 (Math.round 半数取偶 → 但 92.5 → 92? 实际
    // JS Math.round 对 0.5 向上, 92.5 → 93). 用 aria-label 中含原始 value 直接验.
    expect(screen.getByLabelText(/Score 92.5 of 100/)).toBeInTheDocument();
  });

  // Phase 1A polish: weak 行视觉差 + 默认折叠 / weak 展开
  describe('Phase 1A polish — weak indicator + collapse', () => {
    it('marks weak rows (score/maxScore < 0.6) with data-weak=true', () => {
      render(<EssayGradingCard feedback={FB_BASE} />);
      // FB_BASE: row 2 (语言 1.0/2.0=0.5) 和 row 4 (字数 0.4/1.0=0.4) 是 weak.
      expect(screen.getByTestId('essay-grading-dimension-0')).toHaveAttribute('data-weak', 'false');
      expect(screen.getByTestId('essay-grading-dimension-1')).toHaveAttribute('data-weak', 'false');
      expect(screen.getByTestId('essay-grading-dimension-2')).toHaveAttribute('data-weak', 'true');
      expect(screen.getByTestId('essay-grading-dimension-3')).toHaveAttribute('data-weak', 'false');
      expect(screen.getByTestId('essay-grading-dimension-4')).toHaveAttribute('data-weak', 'true');
    });

    it('weak row has border-l-danger class on the details container', () => {
      render(<EssayGradingCard feedback={FB_BASE} />);
      const weakLi = screen.getByTestId('essay-grading-dimension-2');
      // border-l-2 border-l-danger 在 <details> 上, 不在 <li>
      const details = weakLi.querySelector('details');
      expect(details).not.toBeNull();
      expect(details!.className).toContain('border-l-danger');
      expect(details!.className).toContain('border-l-2');
    });

    it('non-weak row does NOT have border-l-danger', () => {
      render(<EssayGradingCard feedback={FB_BASE} />);
      const okLi = screen.getByTestId('essay-grading-dimension-0');
      const details = okLi.querySelector('details');
      expect(details!.className).not.toContain('border-l-danger');
    });

    it('weak row renders dot indicator with bg-err', () => {
      render(<EssayGradingCard feedback={FB_BASE} />);
      const dot = screen.getByTestId('essay-grading-dimension-weak-dot-2');
      expect(dot).toBeInTheDocument();
      expect(dot.className).toContain('bg-err');
      expect(dot.className).toContain('rounded-pill');
      expect(dot).toHaveAttribute('data-pattern', 'dot');
      expect(dot).toHaveAttribute('aria-hidden');
    });

    it('non-weak row does NOT render dot indicator', () => {
      render(<EssayGradingCard feedback={FB_BASE} />);
      expect(
        screen.queryByTestId('essay-grading-dimension-weak-dot-0'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('essay-grading-dimension-weak-dot-1'),
      ).not.toBeInTheDocument();
    });

    it('weak rows are open by default; non-weak rows are collapsed by default', () => {
      render(<EssayGradingCard feedback={FB_BASE} />);
      // 5 details elements: row 2 + row 4 open, others closed
      const rows = [0, 1, 2, 3, 4].map((i) => {
        const li = screen.getByTestId(`essay-grading-dimension-${i}`);
        return li.querySelector('details') as HTMLDetailsElement;
      });
      expect(rows[0].open).toBe(false);
      expect(rows[1].open).toBe(false);
      expect(rows[2].open).toBe(true);  // weak
      expect(rows[3].open).toBe(false);
      expect(rows[4].open).toBe(true);  // weak
    });

    it('all rows collapsed by default when none are weak', () => {
      render(<EssayGradingCard feedback={FB_ALL_STRONG} />);
      for (let i = 0; i < 5; i++) {
        const li = screen.getByTestId(`essay-grading-dimension-${i}`);
        const details = li.querySelector('details') as HTMLDetailsElement;
        expect(details.open).toBe(false);
      }
      // 同理 0 dot
      for (let i = 0; i < 5; i++) {
        expect(
          screen.queryByTestId(`essay-grading-dimension-weak-dot-${i}`),
        ).not.toBeInTheDocument();
      }
    });

    it('summary aria-label includes 弱项 suffix for weak rows', () => {
      render(<EssayGradingCard feedback={FB_BASE} />);
      const weakSummary = screen.getByTestId('essay-grading-dimension-summary-2');
      expect(weakSummary.getAttribute('aria-label')).toContain('弱项');
      const okSummary = screen.getByTestId('essay-grading-dimension-summary-0');
      expect(okSummary.getAttribute('aria-label')).not.toContain('弱项');
    });
  });
});
