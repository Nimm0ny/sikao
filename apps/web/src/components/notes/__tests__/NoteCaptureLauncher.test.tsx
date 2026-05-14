/**
 * SIKAO Wave 6E · NoteCaptureLauncher test.
 *
 * 覆盖: ✎ IconBtn 渲染 + aria-label / 点击展开 modal / target 透传 / 不点击不渲染.
 *
 * 关注 launcher 自身行为 (modal 打开 / 关闭). modal 内 form / mutate 行为
 * 走 NoteCaptureModal.test 覆盖.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { NoteCaptureLauncher } from '../NoteCaptureLauncher';

// 跟 NoteCaptureModal.test 共享 mock pattern. Launcher 实际调 useCreateNote
// 通过 modal 子组件; 这里只验 launcher → modal 装载链.
vi.mock('@sikao/api-client/queries/notebookQueries', async () => {
  const actual = await vi.importActual<typeof import('@sikao/api-client/queries/notebookQueries')>(
    '@sikao/api-client/queries/notebookQueries',
  );
  return {
    ...actual,
    useCreateNote: () => ({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    }),
  };
});

describe('NoteCaptureLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染 IconBtn 含 aria-label "添加到笔记" (default)', () => {
    renderWithProviders(
      <NoteCaptureLauncher
        target={{ kind: 'xingce_question', refId: 7 }}
      />,
    );
    const btn = screen.getByTestId('note-capture-launcher');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label', '添加到笔记');
  });

  it('自定义 tooltip → aria-label 跟随', () => {
    renderWithProviders(
      <NoteCaptureLauncher
        target={{ kind: 'wrong_question', refId: 1 }}
        tooltip="添加错因笔记"
      />,
    );
    expect(screen.getByTestId('note-capture-launcher')).toHaveAttribute(
      'aria-label',
      '添加错因笔记',
    );
  });

  it('默认 modal 关闭 (不渲染 modal body)', () => {
    renderWithProviders(
      <NoteCaptureLauncher
        target={{ kind: 'xingce_question', refId: 7 }}
      />,
    );
    expect(
      screen.queryByTestId('note-capture-launcher-modal'),
    ).not.toBeInTheDocument();
  });

  it('点击 IconBtn → 弹 modal (target 透传 attached chip)', () => {
    renderWithProviders(
      <NoteCaptureLauncher
        target={{ kind: 'wrong_question', refId: 99 }}
      />,
    );
    fireEvent.click(screen.getByTestId('note-capture-launcher'));
    const modal = screen.getByTestId('note-capture-launcher-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.querySelector('[data-testid="note-capture-modal-attached"]'))
      .toHaveTextContent('关联错题 #99');
  });

  it('testId 自定义 → IconBtn + modal data-testid 都跟着', () => {
    renderWithProviders(
      <NoteCaptureLauncher
        target={{ kind: 'xingce_question', refId: 7 }}
        testId="fb-action-capture-7"
      />,
    );
    expect(screen.getByTestId('fb-action-capture-7')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fb-action-capture-7'));
    expect(
      screen.getByTestId('fb-action-capture-7-modal'),
    ).toBeInTheDocument();
  });
});
