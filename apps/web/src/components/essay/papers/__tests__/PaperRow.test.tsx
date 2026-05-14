import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaperRow } from '../PaperRow';
import type { EssayPaperListItemV2Extended } from '@sikao/api-client/queries/essaySpecialtyQueries';

const BASE: EssayPaperListItemV2Extended = {
  id: 1,
  paperCode: 'AIPTA-2026-01',
  paperName: '2026 年浙江省公考《申论》题（A 卷）',
  examYear: 2026,
  sourceProvider: '浙江',
  sourceKind: '副省级',
  questionCount: 3,
  currentRevisionId: 1,
  region: '浙江',
  track: 'sk',
  difficulty: 1,
  status: 'todo',
  progress: '0/0',
  lastAttempt: null,
  pinned: false,
};

describe('PaperRow', () => {
  it('todo 状态 → "未做" pill + "开始" CTA', () => {
    render(<PaperRow paper={BASE} onClick={vi.fn()} />);
    expect(screen.getByTestId('essay-paper-row-status-todo')).toHaveTextContent(
      '未做',
    );
    expect(
      screen.getByTestId('essay-paper-row-AIPTA-2026-01-cta'),
    ).toHaveTextContent('开始');
  });

  it('doing 状态 → "进行中 3/5" pill + "继续" CTA', () => {
    render(
      <PaperRow
        paper={{ ...BASE, status: 'doing', progress: '3/5' }}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('essay-paper-row-status-doing')).toHaveTextContent(
      '进行中',
    );
    expect(
      screen.getByTestId('essay-paper-row-AIPTA-2026-01-cta'),
    ).toHaveTextContent('继续');
  });

  it('done 状态 → "已做" pill + "再练" CTA', () => {
    render(
      <PaperRow paper={{ ...BASE, status: 'done' }} onClick={vi.fn()} />,
    );
    expect(screen.getByTestId('essay-paper-row-status-done')).toHaveTextContent(
      '已做',
    );
    expect(
      screen.getByTestId('essay-paper-row-AIPTA-2026-01-cta'),
    ).toHaveTextContent('再练');
  });

  it('国考 region → badge 实心 ink (国考)', () => {
    render(<PaperRow paper={{ ...BASE, region: '国考' }} onClick={vi.fn()} />);
    const row = screen.getByTestId('essay-paper-row-AIPTA-2026-01');
    expect(row.textContent).toContain('国考');
  });

  it('lastAttempt 存在 → 显示上次日期', () => {
    render(
      <PaperRow
        paper={{
          ...BASE,
          status: 'done',
          lastAttempt: { score: 38.4, submittedAt: '2026-05-01T10:00:00Z' },
        }}
        onClick={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId('essay-paper-row-AIPTA-2026-01-last'),
    ).toHaveTextContent('2026-05-01');
  });

  it('点击 → onClick 接到 paper', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<PaperRow paper={BASE} onClick={onClick} />);
    await user.click(screen.getByTestId('essay-paper-row-AIPTA-2026-01-cta'));
    expect(onClick).toHaveBeenCalledWith(BASE);
  });
});
