/**
 * Phase 1.3 fenbi-merge — PaperListCard status chip 三态测试.
 *
 * 覆盖 D1 状态机:
 *   - status undefined / 'untouched' → "未做" hairline chip
 *   - status 'in_progress' + progress → "进行中 N/M" warn chip with dot
 *   - status 'done' attemptCount=1 → "已做"
 *   - status 'done' attemptCount=3 → "已做 3 次"
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaperListCard } from '../PaperListCard';
import type { PaperSummaryV2, PaperUserStatusV2 } from '@sikao/api-client/types/api';

const PAPER: PaperSummaryV2 = {
  paperCode: 'P-2024-G-001',
  paperName: '2024 国考行测',
  currentRevisionId: 'rev-1',
  questionCount: 130,
};

function noop() {
  /* test stub */
}

describe('PaperListCard status chip', () => {
  it('status undefined → 显示 "未做"', () => {
    render(<PaperListCard paper={PAPER} onStart={noop} />);
    expect(screen.getByText('未做')).toBeTruthy();
  });

  it('status untouched → 显示 "未做"', () => {
    const status: PaperUserStatusV2 = {
      paperCode: PAPER.paperCode,
      userStatus: 'untouched',
      attemptCount: 0,
    };
    render(<PaperListCard paper={PAPER} onStart={noop} status={status} />);
    expect(screen.getByText('未做')).toBeTruthy();
  });

  it('status in_progress → 显示 "进行中 N/M"', () => {
    const status: PaperUserStatusV2 = {
      paperCode: PAPER.paperCode,
      userStatus: 'in_progress',
      attemptCount: 0,
      progress: { answered: 42, total: 130 },
    };
    render(<PaperListCard paper={PAPER} onStart={noop} status={status} />);
    expect(screen.getByText('进行中 42/130')).toBeTruthy();
  });

  it('status done attemptCount=1 → 显示 "已做"', () => {
    const status: PaperUserStatusV2 = {
      paperCode: PAPER.paperCode,
      userStatus: 'done',
      attemptCount: 1,
    };
    render(<PaperListCard paper={PAPER} onStart={noop} status={status} />);
    expect(screen.getByText('已做')).toBeTruthy();
  });

  it('status done attemptCount=3 → 显示 "已做 3 次"', () => {
    const status: PaperUserStatusV2 = {
      paperCode: PAPER.paperCode,
      userStatus: 'done',
      attemptCount: 3,
    };
    render(<PaperListCard paper={PAPER} onStart={noop} status={status} />);
    expect(screen.getByText('已做 3 次')).toBeTruthy();
  });

  it('点击 "开始练习" 调 onStart, 传当前 paper', () => {
    const onStart = vi.fn();
    render(<PaperListCard paper={PAPER} onStart={onStart} />);
    fireEvent.click(screen.getByTestId(`paper-start-${PAPER.paperCode}`));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(PAPER);
  });

  it('in_progress 但 progress 字段缺失 → 显示 "进行中" 不假装 "已做"', () => {
    // 后端契约违约时的 fail-safe (StatusChip 不应 silent fall-through 到 done).
    const status: PaperUserStatusV2 = {
      paperCode: PAPER.paperCode,
      userStatus: 'in_progress',
      attemptCount: 0,
    };
    render(<PaperListCard paper={PAPER} onStart={noop} status={status} />);
    expect(screen.getByText('进行中')).toBeTruthy();
    expect(screen.queryByText(/已做/)).toBeNull();
  });
});
