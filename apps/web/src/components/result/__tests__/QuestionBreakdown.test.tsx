import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionBreakdown } from '../QuestionBreakdown';
import type { QuestionBreakdownItem } from '../_essayResultHelpers';

const ITEM = (overrides: Partial<QuestionBreakdownItem> = {}): QuestionBreakdownItem => ({
  qnumLabel: 'Q1',
  qkindLabel: '归纳概括',
  qttl: '概括 S 市改革面临的三个主要矛盾',
  rubrics: [
    { label: '要点', score: 5, max: 5 },
    { label: '条理', score: 4, max: 4 },
    { label: '语言', score: 3, max: 4 },
  ],
  comment: '三条要点完整, 提炼准确.',
  score: 12,
  maxScore: 15,
  testIdSuffix: '1',
  ...overrides,
});

describe('QuestionBreakdown', () => {
  it('returns null for empty items', () => {
    const { container } = render(<QuestionBreakdown items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 1 row with qnum / qkind / qttl / rubric / qcom / score', () => {
    render(<QuestionBreakdown items={[ITEM()]} />);
    expect(screen.getByTestId('qbreak')).toBeInTheDocument();
    expect(screen.getByTestId('qbreak-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('qbreak-qnum-1').textContent).toBe('Q1');
    expect(screen.getByTestId('qbreak-qkind-1').textContent).toBe('归纳概括');
    expect(screen.getByTestId('qbreak-qttl-1').textContent).toMatch(/S 市改革/);
    expect(screen.getByTestId('qbreak-qcom-1').textContent).toMatch(/三条要点/);
    expect(screen.getByTestId('qbreak-qn-1').textContent).toMatch(/12/);
    expect(screen.getByTestId('qbreak-qn-1').textContent).toMatch(/15/);
  });

  it('qkind CJK 不带 italic (CLAUDE.md §4)', () => {
    render(<QuestionBreakdown items={[ITEM()]} />);
    const qkind = screen.getByTestId('qbreak-qkind-1');
    expect(qkind.className).not.toMatch(/italic/);
    // 显式 inline style: font-style normal
    expect(qkind.style.fontStyle).toBe('normal');
  });

  it('rubric tone — score/max >= 0.85 → ok (绿) / <0.6 → err (红) / 中间 → neutral', () => {
    render(
      <QuestionBreakdown
        items={[
          ITEM({
            rubrics: [
              { label: '要点', score: 5, max: 5 }, // 1.0 → ok
              { label: '语言', score: 2, max: 5 }, // 0.4 → err
              { label: '条理', score: 4, max: 6 }, // 0.667 → neutral
            ],
          }),
        ]}
      />,
    );
    const rubric = screen.getByTestId('qbreak-rubric-1');
    const items = rubric.querySelectorAll('[data-tone]');
    expect(items.length).toBe(3);
    expect(items[0].getAttribute('data-tone')).toBe('ok');
    expect(items[1].getAttribute('data-tone')).toBe('err');
    expect(items[2].getAttribute('data-tone')).toBe('neutral');
  });

  it('weak qrow (score/max <0.6) 设置 data-weak=true + bar fill var(--accent-1)', () => {
    render(
      <QuestionBreakdown
        items={[ITEM({ score: 5, maxScore: 15 })]} // 5/15 = 0.33 < 0.6 weak
      />,
    );
    const row = screen.getByTestId('qbreak-row-1');
    expect(row.getAttribute('data-weak')).toBe('true');
  });

  it('strong qrow (score/max >=0.6) 设置 data-weak=false', () => {
    render(
      <QuestionBreakdown
        items={[ITEM({ score: 12, maxScore: 15 })]} // 12/15 = 0.8 >= 0.6
      />,
    );
    const row = screen.getByTestId('qbreak-row-1');
    expect(row.getAttribute('data-weak')).toBe('false');
  });

  it('renders delta with up tone (green)', () => {
    render(
      <QuestionBreakdown
        items={[ITEM({ deltaLabel: '+2 vs 上次', deltaTone: 'up' })]}
      />,
    );
    const delta = screen.getByTestId('qbreak-delta-1');
    expect(delta.textContent).toBe('+2 vs 上次');
    expect(delta.style.color).toBe('var(--ok)');
  });

  it('renders delta with down tone (red)', () => {
    render(
      <QuestionBreakdown
        items={[ITEM({ deltaLabel: '-3 vs 上次', deltaTone: 'down' })]}
      />,
    );
    const delta = screen.getByTestId('qbreak-delta-1');
    expect(delta.style.color).toBe('var(--err)');
  });

  it('renders mark highlights in qcom', () => {
    render(
      <QuestionBreakdown
        items={[
          ITEM({
            comment: '要点提炼准确, "权责边界" 是亮点.',
            commentHighlights: ['权责边界'],
          }),
        ]}
      />,
    );
    const qcom = screen.getByTestId('qbreak-qcom-1');
    const marks = qcom.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('权责边界');
  });

  it('renders 4 qrows for multi-record exam mode', () => {
    const items = [
      ITEM({ qnumLabel: 'Q1', testIdSuffix: 'r1' }),
      ITEM({ qnumLabel: 'Q2', testIdSuffix: 'r2' }),
      ITEM({ qnumLabel: 'Q3', testIdSuffix: 'r3' }),
      ITEM({ qnumLabel: 'Q4', testIdSuffix: 'r4' }),
    ];
    render(<QuestionBreakdown items={items} />);
    expect(screen.getByTestId('qbreak-row-r1')).toBeInTheDocument();
    expect(screen.getByTestId('qbreak-row-r4')).toBeInTheDocument();
  });

  it('renders tail slot when provided', () => {
    render(
      <QuestionBreakdown
        items={[
          ITEM({
            tailSlot: <button data-testid="retry-tail">重新提交</button>,
          }),
        ]}
      />,
    );
    expect(screen.getByTestId('qbreak-tail-1')).toBeInTheDocument();
    expect(screen.getByTestId('retry-tail')).toBeInTheDocument();
  });

  it('respects testIdPrefix', () => {
    render(
      <QuestionBreakdown
        items={[ITEM()]}
        testIdPrefix="essay-exam-qbreak"
      />,
    );
    expect(screen.getByTestId('essay-exam-qbreak')).toBeInTheDocument();
    expect(screen.getByTestId('essay-exam-qbreak-row-1')).toBeInTheDocument();
  });
});
