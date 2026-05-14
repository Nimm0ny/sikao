/**
 * SIKAO Wave 6E · NoteCaptureModal test.
 *
 * 覆盖: open/close 行为 / form pre-fill / type 切换 / submit payload shape /
 * attachedTo 三 kind 分支 (xingce_question / essay_question / wrong_question).
 *
 * Mock useCreateNote — 不打真 BE. 验 mutation.mutate 收到的 payload 字段.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { NoteCaptureModal, type NoteAttachTarget } from '../NoteCaptureModal';

// Hoisted mock — 保 useCreateNote 引用 + 收集 mutate 调用
const mutateSpy = vi.fn();
const resetSpy = vi.fn();

vi.mock('@sikao/api-client/queries/notebookQueries', async () => {
  const actual = await vi.importActual<typeof import('@sikao/api-client/queries/notebookQueries')>(
    '@sikao/api-client/queries/notebookQueries',
  );
  return {
    ...actual,
    useCreateNote: () => ({
      mutate: mutateSpy,
      reset: resetSpy,
      isPending: false,
      isError: false,
      error: null,
    }),
  };
});

describe('NoteCaptureModal', () => {
  beforeEach(() => {
    mutateSpy.mockReset();
    resetSpy.mockReset();
  });

  function makeTarget(
    kind: NoteAttachTarget['kind'] = 'xingce_question',
    refId = 42,
  ): NoteAttachTarget {
    return { kind, refId };
  }

  it('open=false: 不渲染 modal 主体', () => {
    renderWithProviders(
      <NoteCaptureModal
        open={false}
        onClose={() => {}}
        target={makeTarget()}
      />,
    );
    expect(screen.queryByTestId('note-capture-modal')).not.toBeInTheDocument();
  });

  it('open=true: 渲染 attached chip + type select + body textarea', () => {
    renderWithProviders(
      <NoteCaptureModal
        open
        onClose={() => {}}
        target={makeTarget('xingce_question', 42)}
      />,
    );
    expect(screen.getByTestId('note-capture-modal')).toBeInTheDocument();
    expect(screen.getByTestId('note-capture-modal-attached')).toHaveTextContent(
      '关联行测题 #42',
    );
    expect(screen.getByTestId('note-capture-modal-type')).toBeInTheDocument();
    expect(screen.getByTestId('note-capture-modal-body')).toBeInTheDocument();
  });

  it('空 body submit 按钮 disabled', () => {
    renderWithProviders(
      <NoteCaptureModal open onClose={() => {}} target={makeTarget()} />,
    );
    expect(screen.getByTestId('note-capture-modal-submit')).toBeDisabled();
  });

  it('输入 body + 切 type → submit 触发 mutate, payload 含 attachedTo + type + body', async () => {
    renderWithProviders(
      <NoteCaptureModal
        open
        onClose={() => {}}
        target={makeTarget('xingce_question', 42)}
        defaultSourceQuote="这道题考点是什么"
      />,
    );
    fireEvent.change(screen.getByTestId('note-capture-modal-type'), {
      target: { value: 'method' },
    });
    fireEvent.change(screen.getByTestId('note-capture-modal-body'), {
      target: { value: '抓主体 / 分维度 / 整合表达' },
    });
    fireEvent.click(screen.getByTestId('note-capture-modal-submit'));
    await waitFor(() => expect(mutateSpy).toHaveBeenCalledTimes(1));
    const payload = mutateSpy.mock.calls[0][0];
    expect(payload).toMatchObject({
      type: 'method',
      body: { text: '抓主体 / 分维度 / 整合表达' },
      sourceKind: 'practice',
      sourceDomain: 'xingce',
      attachedTo: { xingceQuestionIds: [42] },
      sourceQuote: '这道题考点是什么',
    });
  });

  it('attachedTo: essay_question → questionTypeIds=[String(refId)]', async () => {
    renderWithProviders(
      <NoteCaptureModal
        open
        onClose={() => {}}
        target={makeTarget('essay_question', 1001)}
      />,
    );
    fireEvent.change(screen.getByTestId('note-capture-modal-body'), {
      target: { value: '论据偏弱' },
    });
    fireEvent.click(screen.getByTestId('note-capture-modal-submit'));
    await waitFor(() => expect(mutateSpy).toHaveBeenCalledTimes(1));
    const payload = mutateSpy.mock.calls[0][0];
    expect(payload.attachedTo).toEqual({ questionTypeIds: ['1001'] });
    expect(payload.sourceDomain).toBe('essay');
  });

  it('attachedTo: wrong_question → wrongAnswerIds=[refId]', async () => {
    renderWithProviders(
      <NoteCaptureModal
        open
        onClose={() => {}}
        target={makeTarget('wrong_question', 99)}
      />,
    );
    fireEvent.change(screen.getByTestId('note-capture-modal-body'), {
      target: { value: '马虎了' },
    });
    fireEvent.click(screen.getByTestId('note-capture-modal-submit'));
    await waitFor(() => expect(mutateSpy).toHaveBeenCalledTimes(1));
    const payload = mutateSpy.mock.calls[0][0];
    expect(payload.attachedTo).toEqual({ wrongAnswerIds: [99] });
  });

  it('cancel 按钮调 onClose, 不 mutate', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <NoteCaptureModal open onClose={onClose} target={makeTarget()} />,
    );
    fireEvent.click(screen.getByTestId('note-capture-modal-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutateSpy).not.toHaveBeenCalled();
  });

  it('sourceQuote toggle: 默认收起, 点击展开 blockquote', () => {
    renderWithProviders(
      <NoteCaptureModal
        open
        onClose={() => {}}
        target={makeTarget()}
        defaultSourceQuote="原文测试"
      />,
    );
    expect(
      screen.queryByTestId('note-capture-modal-quote-body'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('note-capture-modal-quote-toggle'));
    expect(
      screen.getByTestId('note-capture-modal-quote-body'),
    ).toHaveTextContent('原文测试');
  });
});
