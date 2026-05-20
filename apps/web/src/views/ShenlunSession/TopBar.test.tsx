import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import TopBar from './TopBar';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

//
// 覆盖:
//   - 渲染 required props 不崩
//   - IconBtn aria-label 全到位 (退出 / 上一题 / 下一题)
//   - onClick handler (exit / prev / next / submit) 触发正确
//   - saveStatus prop → 文案切换
//   - canPrev=false / canNext=false → 对应 IconBtn disabled
//   - 计时器 elapsedSeconds 格式化 (mm:ss / h:mm:ss)
//
// 不覆盖 (留给后续 phase):
//   - 视觉对比 / chrome MCP user-simulation (master 验收)

interface BuildPropsOverrides {
  readonly examLabel?: string;
  readonly elapsedSeconds?: number;
  readonly currentWordCount?: number;
  readonly maxWordCount?: number;
  readonly saveStatus?: 'saved' | 'saving' | 'unsaved';
  readonly canPrev?: boolean;
  readonly canNext?: boolean;
  readonly onExit?: () => void;
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
  readonly onSubmit?: () => void;
}

function buildProps(overrides: BuildPropsOverrides = {}) {
  return {
    examLabel: overrides.examLabel ?? '2024 国考 · 模拟一',
    elapsedSeconds: overrides.elapsedSeconds ?? 3374,
    currentWordCount: overrides.currentWordCount ?? 427,
    maxWordCount: overrides.maxWordCount ?? 500,
    saveStatus: overrides.saveStatus ?? ('saved' as const),
    onExit: overrides.onExit ?? vi.fn(),
    onPrev: overrides.onPrev ?? vi.fn(),
    onNext: overrides.onNext ?? vi.fn(),
    onSubmit: overrides.onSubmit ?? vi.fn(),
    canPrev: overrides.canPrev ?? true,
    canNext: overrides.canNext ?? true,
  };
}

describe('TopBar', () => {
  it('renders without crashing with required props', () => {
    renderWithProviders(<TopBar {...buildProps()} />);
    expect(screen.getByTestId('shenlun-topbar')).toBeInTheDocument();
  });

  it('renders exam label, timer, and word count', () => {
    renderWithProviders(<TopBar {...buildProps()} />);
    expect(screen.getByTestId('shenlun-topbar-exam-label')).toHaveTextContent(
      '2024 国考 · 模拟一',
    );
    expect(screen.getByTestId('shenlun-topbar-timer')).toHaveTextContent('56:14');
    const wc = screen.getByTestId('shenlun-topbar-wordcount');
    expect(wc).toHaveTextContent('427');
    expect(wc).toHaveTextContent('/ 500');
  });

  it('formats elapsed > 1h as h:mm:ss', () => {
    renderWithProviders(<TopBar {...buildProps({ elapsedSeconds: 3661 })} />);
    expect(screen.getByTestId('shenlun-topbar-timer')).toHaveTextContent('1:01:01');
  });

  it('has correct aria-labels on all IconBtn (exit / prev / next)', () => {
    renderWithProviders(<TopBar {...buildProps()} />);
    const exit = screen.getByTestId('shenlun-topbar-exit');
    const prev = screen.getByTestId('shenlun-topbar-prev');
    const next = screen.getByTestId('shenlun-topbar-next');
    expect(exit.getAttribute('aria-label')).toBe(ESSAY_SIKAO_COPY.topbarExitFocus);
    expect(prev.getAttribute('aria-label')).toBe(ESSAY_SIKAO_COPY.topbarPrevQuestion);
    expect(next.getAttribute('aria-label')).toBe(ESSAY_SIKAO_COPY.topbarNextQuestion);
  });

  it('fires onExit when exit IconBtn clicked', () => {
    const onExit = vi.fn();
    renderWithProviders(<TopBar {...buildProps({ onExit })} />);
    fireEvent.click(screen.getByTestId('shenlun-topbar-exit'));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('fires onPrev / onNext / onSubmit when respective buttons clicked', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onSubmit = vi.fn();
    renderWithProviders(
      <TopBar {...buildProps({ onPrev, onNext, onSubmit })} />,
    );
    fireEvent.click(screen.getByTestId('shenlun-topbar-prev'));
    fireEvent.click(screen.getByTestId('shenlun-topbar-next'));
    fireEvent.click(screen.getByTestId('shenlun-topbar-submit'));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('renders saveStatus="saved" with 已保存 text', () => {
    renderWithProviders(<TopBar {...buildProps({ saveStatus: 'saved' })} />);
    const save = screen.getByTestId('shenlun-topbar-save');
    expect(save).toHaveTextContent(ESSAY_SIKAO_COPY.topbarSaveStatusSaved);
    expect(save.getAttribute('data-save-status')).toBe('saved');
  });

  it('renders saveStatus="saving" with 保存中… text', () => {
    renderWithProviders(<TopBar {...buildProps({ saveStatus: 'saving' })} />);
    const save = screen.getByTestId('shenlun-topbar-save');
    expect(save).toHaveTextContent(ESSAY_SIKAO_COPY.topbarSaveStatusSaving);
    expect(save.getAttribute('data-save-status')).toBe('saving');
  });

  it('renders saveStatus="unsaved" with 未保存 text', () => {
    renderWithProviders(<TopBar {...buildProps({ saveStatus: 'unsaved' })} />);
    const save = screen.getByTestId('shenlun-topbar-save');
    expect(save).toHaveTextContent(ESSAY_SIKAO_COPY.topbarSaveStatusUnsaved);
    expect(save.getAttribute('data-save-status')).toBe('unsaved');
  });

  it('disables prev button when canPrev=false', () => {
    renderWithProviders(<TopBar {...buildProps({ canPrev: false })} />);
    expect(screen.getByTestId('shenlun-topbar-prev')).toBeDisabled();
    expect(screen.getByTestId('shenlun-topbar-next')).not.toBeDisabled();
  });

  it('disables next button when canNext=false', () => {
    renderWithProviders(<TopBar {...buildProps({ canNext: false })} />);
    expect(screen.getByTestId('shenlun-topbar-next')).toBeDisabled();
    expect(screen.getByTestId('shenlun-topbar-prev')).not.toBeDisabled();
  });

  it('does not fire onPrev when prev is disabled', () => {
    const onPrev = vi.fn();
    renderWithProviders(<TopBar {...buildProps({ canPrev: false, onPrev })} />);
    fireEvent.click(screen.getByTestId('shenlun-topbar-prev'));
    expect(onPrev).not.toHaveBeenCalled();
  });
});
