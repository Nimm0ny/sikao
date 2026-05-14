import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentResultPreview } from '../RecentResultPreview';
import type {
  PracticeSessionSummaryV2,
  PracticeSubtypeSummaryV2,
} from '@sikao/api-client/types/api';

function makeSession(
  overrides: Partial<PracticeSessionSummaryV2> = {},
): PracticeSessionSummaryV2 {
  return {
    sessionId: 4321,
    mode: 'paper_bound',
    paperCode: '2024-guokao-shenlun-fu',
    paperName: '2024 国考 副省级',
    startedAt: '2026-05-11T08:00:00Z',
    completedAt: '2026-05-11T08:28:00Z',
    totalQuestions: 20,
    answeredQuestions: 20,
    correctCount: 14,
    wrongCount: 6,
    accuracyRate: 70,
    ...overrides,
  };
}

function makeSubtype(
  overrides: Partial<PracticeSubtypeSummaryV2> = {},
): PracticeSubtypeSummaryV2 {
  return {
    subject: '言语理解',
    subtype: '逻辑填空',
    questionCount: 10,
    answeredQuestions: 10,
    correctCount: 6,
    wrongCount: 4,
    accuracyRate: 60,
    ...overrides,
  };
}

function renderPreview(
  session: PracticeSessionSummaryV2 | null,
  subtypes: readonly PracticeSubtypeSummaryV2[],
  className?: string,
) {
  return render(
    <MemoryRouter>
      <RecentResultPreview
        session={session}
        subtypes={subtypes}
        className={className}
      />
    </MemoryRouter>,
  );
}

describe('RecentResultPreview', () => {
  it('data 态: 渲染 session + 3 subtypes → eyebrow / title / count·用时 / 3 行 hint / 查看完整 link', () => {
    const subtypes: readonly PracticeSubtypeSummaryV2[] = [
      makeSubtype({ subject: '判断推理', subtype: '图形推理', wrongCount: 7, accuracyRate: 30 }),
      makeSubtype({ subject: '言语理解', subtype: '逻辑填空', wrongCount: 4, accuracyRate: 60 }),
      makeSubtype({ subject: '资料分析', subtype: '增长率', wrongCount: 1, accuracyRate: 90 }),
    ];
    renderPreview(makeSession(), subtypes);

    expect(screen.getByText('最近一次模考')).toBeInTheDocument();
    expect(screen.getByTestId('recent-result-preview-title')).toHaveTextContent(
      '2024 国考 副省级',
    );
    // 20 题 · 用时 28 min (28 分钟差)
    expect(screen.getByText('20 题 · 用时 28 min')).toBeInTheDocument();

    const hints = screen.getByTestId('recent-result-preview-hints');
    expect(hints).toHaveTextContent('判断推理·图形推理 错 7 题, 这是当前最大弱项');
    expect(hints).toHaveTextContent('言语理解·逻辑填空 正确率 60%, 巩固空间大');
    expect(hints).toHaveTextContent(
      '建议: 错题本针对前两个考点优先重做 (≥30 题), 后续再触发新材料',
    );

    const link = screen.getByTestId('recent-result-preview-link');
    expect(link).toHaveAttribute('href', '/practice/result/4321');
    expect(link).toHaveTextContent('查看完整');
  });

  it('subtypes=[] (弱 state) → empty state 形态 (跟 session=null 一致)', () => {
    renderPreview(makeSession(), []);
    expect(screen.getByText('最近一次模考')).toBeInTheDocument();
    expect(
      screen.getByText(/暂无练习记录, 完成首场练习后这里会显示最近一次表现/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('recent-result-preview-empty-link')).toHaveAttribute(
      'href',
      '/papers',
    );
    expect(screen.queryByTestId('recent-result-preview-link')).not.toBeInTheDocument();
  });

  it('session=null → empty state 占位 + 去做一套 link 跳 /papers', () => {
    renderPreview(null, [makeSubtype()]);
    expect(
      screen.getByText(/暂无练习记录, 完成首场练习后这里会显示最近一次表现/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('recent-result-preview-empty-link')).toHaveAttribute(
      'href',
      '/papers',
    );
    expect(screen.queryByTestId('recent-result-preview-hints')).not.toBeInTheDocument();
  });

  it('subtypes=1 (降级): 1 真 hint + 2 fallback (中段 fallback + 固定 action)', () => {
    const subtypes = [makeSubtype({ subject: null, subtype: '逻辑填空', wrongCount: 3, accuracyRate: 70 })];
    renderPreview(makeSession(), subtypes);

    const hints = screen.getByTestId('recent-result-preview-hints');
    expect(hints).toHaveTextContent('逻辑填空 错 3 题, 这是当前最大弱项');
    // 中段 fallback (FALLBACK_HINTS[1])
    expect(hints).toHaveTextContent(
      '建议先打通一套完整模考，让系统沉淀基线数据',
    );
    // 固定 action hint
    expect(hints).toHaveTextContent(
      '建议: 错题本针对前两个考点优先重做 (≥30 题), 后续再触发新材料',
    );
  });

  it('completedAt=null → meta 不带"用时" 段', () => {
    renderPreview(
      makeSession({ completedAt: null }),
      [makeSubtype(), makeSubtype({ subtype: '资料分析' })],
    );
    expect(screen.getByText('20 题')).toBeInTheDocument();
    expect(screen.queryByText(/用时/)).not.toBeInTheDocument();
  });

  it('paperName=null → fallback 到 paperCode', () => {
    renderPreview(
      makeSession({ paperName: null, paperCode: 'PAPER-X' }),
      [makeSubtype(), makeSubtype({ subtype: '资料分析' })],
    );
    expect(screen.getByTestId('recent-result-preview-title')).toHaveTextContent('PAPER-X');
  });

  it('paperName + paperCode 都 null → 显 "未命名练习"', () => {
    renderPreview(
      makeSession({ paperName: null, paperCode: null }),
      [makeSubtype(), makeSubtype({ subtype: '资料分析' })],
    );
    expect(screen.getByTestId('recent-result-preview-title')).toHaveTextContent('未命名练习');
  });

  it('className prop forward 到根容器', () => {
    renderPreview(null, [], 'custom-foo-bar');
    const root = screen.getByTestId('recent-result-preview');
    expect(root.className).toContain('custom-foo-bar');
  });

  it('determinism: 同输入两次渲染 hint 文案一致', () => {
    const subtypes: readonly PracticeSubtypeSummaryV2[] = [
      makeSubtype({ subject: '判断推理', subtype: '图形推理', wrongCount: 7, accuracyRate: 30 }),
      makeSubtype({ subject: '言语理解', subtype: '逻辑填空', wrongCount: 4, accuracyRate: 60 }),
    ];
    const { unmount } = renderPreview(makeSession(), subtypes);
    const firstText = screen
      .getByTestId('recent-result-preview-hints')
      .textContent;
    unmount();
    renderPreview(makeSession(), subtypes);
    const secondText = screen
      .getByTestId('recent-result-preview-hints')
      .textContent;
    expect(secondText).toBe(firstText);
  });
});
