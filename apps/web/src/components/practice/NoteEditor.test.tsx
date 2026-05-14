/**
 * Phase 3.9 fenbi-merge — NoteEditor markdown modal.
 *
 * 覆盖:
 *   - 加载 → 数据到位 → 渲染 textarea + 已存内容
 *   - 输入文本 → debounce 1.5s 后 PUT
 *   - 完成按钮 → flush 立即 PUT + onClose
 *   - 工具栏插入 markdown (**bold**, - list)
 *   - 已有笔记 → 显示 "删除笔记" 按钮; 点击 DELETE + onClose
 *   - 没笔记 → 不显示 "删除"
 *   - questionId 切换 → key remount, draft 重新初始化
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { NoteEditor } from './NoteEditor';

function mockGet(qid: number, content: string, hasNote: boolean) {
  return http.get(`/api/v2/notes/${qid}`, () =>
    HttpResponse.json({
      hasNote,
      content,
      updatedAt: hasNote ? '2026-05-06T10:00:00' : null,
    }),
  );
}

describe('NoteEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('loads existing content into textarea', async () => {
    server.use(mockGet(42, 'old note text', true));
    renderWithProviders(
      <NoteEditor open questionId={42} questionNo={5} onClose={() => {}} />,
    );
    const ta = (await screen.findByTestId('note-editor-textarea')) as HTMLTextAreaElement;
    expect(ta.value).toBe('old note text');
    expect(screen.getByText('第 5 题 · 笔记')).toBeInTheDocument();
  });

  it('shows loading then renders editor', async () => {
    server.use(
      http.get('/api/v2/notes/42', async () => {
        return HttpResponse.json({ hasNote: false, content: '', updatedAt: null });
      }),
    );
    renderWithProviders(<NoteEditor open questionId={42} onClose={() => {}} />);
    await screen.findByTestId('note-editor-textarea');
  });

  it('typing triggers PUT after 1.5s debounce', async () => {
    let putBody: { content: string } | null = null;
    server.use(
      mockGet(42, '', false),
      http.put('/api/v2/notes/42', async ({ request }) => {
        putBody = (await request.json()) as { content: string };
        return HttpResponse.json({ hasNote: true, content: putBody.content, updatedAt: '2026-05-06T10:00:00' });
      }),
    );
    renderWithProviders(<NoteEditor open questionId={42} onClose={() => {}} />);
    const ta = await screen.findByTestId('note-editor-textarea');
    fireEvent.change(ta, { target: { value: 'hello world' } });
    // < 1.5s 不发请求
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(putBody).toBeNull();
    // > 1.5s 发请求
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await waitFor(() => {
      expect(putBody).toEqual({ content: 'hello world' });
    });
  });

  it('完成按钮 flushes pending save and calls onClose', async () => {
    let putBody: { content: string } | null = null;
    const onClose = vi.fn();
    server.use(
      mockGet(42, '', false),
      http.put('/api/v2/notes/42', async ({ request }) => {
        putBody = (await request.json()) as { content: string };
        return HttpResponse.json({ hasNote: true, content: putBody.content, updatedAt: '2026-05-06T10:00:00' });
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NoteEditor open questionId={42} onClose={onClose} />);
    const ta = await screen.findByTestId('note-editor-textarea');
    fireEvent.change(ta, { target: { value: 'instant save' } });
    // 不等 debounce 直接点完成
    await user.click(screen.getByTestId('note-editor-close'));
    await waitFor(() => {
      expect(putBody).toEqual({ content: 'instant save' });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('toolbar 粗体 wraps selection in **', async () => {
    server.use(mockGet(42, 'abc', true));
    renderWithProviders(<NoteEditor open questionId={42} onClose={() => {}} />);
    const ta = (await screen.findByTestId('note-editor-textarea')) as HTMLTextAreaElement;
    ta.setSelectionRange(0, 3); // 选中 "abc"
    fireEvent.click(screen.getByLabelText('粗体'));
    await waitFor(() => {
      expect(ta.value).toBe('**abc**');
    });
  });

  it('已有笔记 → 显示删除按钮; 点击 DELETE 后 onClose', async () => {
    let deleteCalled = 0;
    const onClose = vi.fn();
    server.use(
      mockGet(42, 'to delete', true),
      http.delete('/api/v2/notes/42', () => {
        deleteCalled += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NoteEditor open questionId={42} onClose={onClose} />);
    await screen.findByTestId('note-editor-textarea');
    await user.click(screen.getByTestId('note-editor-delete'));
    await waitFor(() => {
      expect(deleteCalled).toBe(1);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('没笔记 → 不显示删除按钮', async () => {
    server.use(mockGet(42, '', false));
    renderWithProviders(<NoteEditor open questionId={42} onClose={() => {}} />);
    await screen.findByTestId('note-editor-textarea');
    expect(screen.queryByTestId('note-editor-delete')).toBeNull();
  });

  it('questionId 切换 → key remount, draft 重新初始化 (review-fix #10)', async () => {
    server.use(
      mockGet(42, 'note for q42', true),
      mockGet(43, 'note for q43', true),
    );
    const { rerender } = renderWithProviders(
      <NoteEditor open questionId={42} onClose={() => {}} />,
    );
    let ta = (await screen.findByTestId('note-editor-textarea')) as HTMLTextAreaElement;
    expect(ta.value).toBe('note for q42');
    rerender(<NoteEditor open questionId={43} onClose={() => {}} />);
    await waitFor(() => {
      ta = screen.getByTestId('note-editor-textarea') as HTMLTextAreaElement;
      expect(ta.value).toBe('note for q43');
    });
  });
});
