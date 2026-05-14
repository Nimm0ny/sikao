/**
 * SIKAO Wave 4 Phase 2D · NoteEditor view test.
 *
 * 三态覆盖:
 * 1. new (路由 /notes/new): 显空表单 + 创建 cta
 * 2. edit (路由 /notes/:id): hydrate BE data → 显 prefilled
 * 3. invalid id: 显 invalid empty state
 * 4. auth fail: fallback
 */
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@sikao/test-utils/server';
import NoteEditor from '../NoteEditor';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
}

function renderAt(path: string, client?: QueryClient) {
  return render(
    <QueryClientProvider client={client ?? makeClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/notes/:noteId" element={<NoteEditor />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NoteEditor · view', () => {
  it('new: 空表单 + 保存 cta', () => {
    renderAt('/notes/new');
    expect(screen.getByTestId('note-editor-view')).toBeInTheDocument();
    expect(screen.getByTestId('note-editor-save')).toHaveTextContent('保存笔记');
    expect(screen.getByTestId('note-editor-title')).toHaveValue('');
  });

  it('edit: hydrate BE data → 显 prefilled', async () => {
    server.use(
      http.get('/api/v2/notebook/notes/42', () =>
        HttpResponse.json({
          id: 42,
          type: 'reflect',
          body: { text: '反思内容' },
          sourceKind: 'manual',
          sourceRef: '源',
          sourceQuote: null,
          sourceDomain: 'essay',
          title: '已存在标题',
          tags: ['#tag-a'],
          attachedTo: null,
          visibility: 'self',
          ease: 2.5,
          reviewCount: 0,
          reviewedAt: null,
          nextReviewAt: null,
          createdAt: '2026-05-12T00:00:00Z',
          updatedAt: '2026-05-12T00:00:00Z',
        }),
      ),
    );
    renderAt('/notes/42');
    await waitFor(() => {
      expect(screen.getByTestId('note-editor-title')).toHaveValue(
        '已存在标题',
      );
    });
    expect(screen.getByTestId('note-editor-body-textarea')).toHaveValue(
      '反思内容',
    );
    expect(screen.getByTestId('note-editor-save')).toHaveTextContent(
      '保存修改',
    );
  });

  it('invalid id (非数字): 显 invalid empty state', () => {
    renderAt('/notes/not-a-number');
    expect(screen.getByTestId('note-editor-invalid')).toBeInTheDocument();
  });

  it('auth fail: 401 → fallback', async () => {
    server.use(
      http.get('/api/v2/notebook/notes/7', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
    );
    renderAt('/notes/7');
    await waitFor(() =>
      expect(
        screen.getByTestId('note-editor-auth-fallback'),
      ).toBeInTheDocument(),
    );
  });

  it('method type: 切换 type → body 区切到 method form', () => {
    renderAt('/notes/new');
    const typeSel = screen.getByTestId('note-editor-type');
    expect(typeSel).toBeInTheDocument();
    // fireEvent.change wraps React state update in act() automatically.
    fireEvent.change(typeSel, { target: { value: 'method' } });
    expect(screen.queryByTestId('note-editor-body-method')).toBeInTheDocument();
  });
});
