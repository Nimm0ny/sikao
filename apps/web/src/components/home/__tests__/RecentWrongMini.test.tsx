/**
 * Phase B (P0 #5) — RecentWrongMini 三态测试.
 *
 * 覆盖:
 *   - count=undefined → loading 占位 ("—" 数字 + "加载中…" 副字)
 *   - count=0 → 空态副字 + 不显 unit "条"
 *   - count>0 + lastWrongTime → 数字 + "条 · 上次 N 天前"
 *   - 点击 CTA 调 onNavigate
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecentWrongMini } from '../RecentWrongMini';

function noop(): void {
  /* test stub */
}

describe('RecentWrongMini', () => {
  it('loading: count=undefined → 显示 "—" + 加载中…', () => {
    render(
      <RecentWrongMini
        count={undefined}
        lastWrongTime={null}
        onNavigate={noop}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('加载中…')).toBeInTheDocument();
    // unit "条" 不显 (loading 时不知道是不是 0)
    expect(screen.queryByText('条')).toBeNull();
  });

  it('empty: count=0 → 显 0 + "暂无错题, 做新题吧"', () => {
    render(
      <RecentWrongMini count={0} lastWrongTime={null} onNavigate={noop} />,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('暂无错题, 做新题吧')).toBeInTheDocument();
    // count=0 不应显 unit "条" (避免 "0 条" 视觉)
    expect(screen.queryByText('条')).toBeNull();
  });

  it('active: count>0 + lastWrongTime → 显数字 + "上次 N 天前"', () => {
    // lastWrongTime 设成 5 天前
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    render(
      <RecentWrongMini
        count={42}
        lastWrongTime={fiveDaysAgo.toISOString()}
        onNavigate={noop}
      />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    // unit 行 ("条")
    expect(screen.getByText('条')).toBeInTheDocument();
    // description 行
    expect(screen.getByText('上次 5 天前')).toBeInTheDocument();
  });

  it('active: lastWrongTime=今天 → 显 "今天刚错过"', () => {
    render(
      <RecentWrongMini
        count={2}
        lastWrongTime={new Date().toISOString()}
        onNavigate={noop}
      />,
    );
    expect(screen.getByText('今天刚错过')).toBeInTheDocument();
  });

  it('active: count>0 + lastWrongTime null → 显 "待复习" 副字', () => {
    render(
      <RecentWrongMini count={3} lastWrongTime={null} onNavigate={noop} />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('待复习')).toBeInTheDocument();
  });

  it('点击 CTA 调 onNavigate 一次', () => {
    const onNavigate = vi.fn();
    render(
      <RecentWrongMini
        count={3}
        lastWrongTime={null}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByTestId('recent-wrong-mini-cta'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
