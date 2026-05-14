import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimingByModule } from '../TimingByModule';
import type { PracticeSectionSummaryV2, QuestionDetailV2 } from '@sikao/api-client/types/api';
import type { QuestionTiming } from '@sikao/shared-utils';

function sec(id: string, title: string): PracticeSectionSummaryV2 {
  return {
    sectionId: id,
    title,
    instructionText: '',
    questionCount: 0,
    answeredQuestions: 0,
    correctCount: 0,
    wrongCount: 0,
    accuracyRate: 0,
  };
}

function q(qid: string, sectionId: string): QuestionDetailV2 {
  return {
    questionId: Number(qid),
    questionNo: Number(qid),
    sectionId,
    rendererKey: 'single_choice',
    stem: '',
    choices: [],
    correctAnswerKeys: [],
    materials: [],
  } as unknown as QuestionDetailV2;
}

function t(qid: string, secs: number): QuestionTiming {
  return { questionId: qid, questionNo: Number(qid), elapsedSec: secs, paused: false };
}

describe('TimingByModule', () => {
  it('aggregates timings per section, marks over-time as danger', () => {
    render(
      <TimingByModule
        timings={[t('1', 60 * 25), t('2', 60 * 30)]}  // 数量 25min, 言语 30min
        sections={[sec('A', '数量关系'), sec('B', '言语理解')]}
        questions={[q('1', 'A'), q('2', 'B')]}
      />,
    );
    // 数量关系推荐 20 → 25 超时
    const rowA = screen.getByTestId('timing-module-row-A');
    expect(rowA.textContent).toMatch(/25/);
    expect(rowA.querySelector('.text-err')).not.toBeNull();
    // 言语理解推荐 35 → 30 不超
    const rowB = screen.getByTestId('timing-module-row-B');
    expect(rowB.textContent).toMatch(/30/);
    expect(rowB.querySelector('.text-err')).toBeNull();
    // 总超时显示
    expect(screen.getByTestId('timing-by-module-over').textContent).toMatch(/超时/);
  });

  it('returns null when no section title matches recommended config', () => {
    const { container } = render(
      <TimingByModule
        timings={[t('1', 600)]}
        sections={[sec('Z', '申论')]}
        questions={[q('1', 'Z')]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('partial match: configured sections render + skipped count shown in footer', () => {
    render(
      <TimingByModule
        timings={[t('1', 60 * 25), t('2', 60 * 30)]}
        sections={[sec('A', '数量关系'), sec('Z', '申论')]}
        questions={[q('1', 'A'), q('2', 'Z')]}
      />,
    );
    expect(screen.getByTestId('timing-module-row-A')).toBeInTheDocument();
    expect(screen.queryByTestId('timing-module-row-Z')).toBeNull();
    expect(screen.getByTestId('timing-by-module-skipped').textContent).toMatch(/1 个模块/);
  });

  it('overSec uses raw seconds not rounded minutes (precision)', () => {
    // 数量关系推荐 20min = 1200s. 实际 23min10s = 1390s. 真实超 190s = 3:10.
    // 若用 round 后分钟差 (23-20=3min=180s) 会丢 10s.
    render(
      <TimingByModule
        timings={[t('1', 1390)]}
        sections={[sec('A', '数量关系')]}
        questions={[q('1', 'A')]}
      />,
    );
    expect(screen.getByTestId('timing-by-module-over').textContent).toMatch(/3:10/);
  });

  it('skips paused timings from section sums', () => {
    render(
      <TimingByModule
        timings={[
          { questionId: '1', questionNo: 1, elapsedSec: 0, paused: true },
          t('2', 60 * 10),
        ]}
        sections={[sec('A', '数量关系')]}
        questions={[q('1', 'A'), q('2', 'A')]}
      />,
    );
    // 只算 10 分钟, 不超 20 推荐
    const rowA = screen.getByTestId('timing-module-row-A');
    expect(rowA.textContent).toMatch(/10\/20/);
    expect(screen.queryByTestId('timing-by-module-over')).toBeNull();
  });
});
