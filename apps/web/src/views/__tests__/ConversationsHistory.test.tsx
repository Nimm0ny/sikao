import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import ConversationsHistory from '../ConversationsHistory';

describe('ConversationsHistory', () => {
  it('空列表 → 显示 empty state + 返回按钮', async () => {
    server.use(
      http.get('/api/v2/llm/conversations', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderWithProviders(<ConversationsHistory />);
    await waitFor(() =>
      expect(screen.getByText('还没有解析问答会话.')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('conversations-back')).toBeInTheDocument();
  });

  it('list 渲染每行: title / 预览 / 消息数', async () => {
    server.use(
      http.get('/api/v2/llm/conversations', () =>
        HttpResponse.json({
          items: [
            {
              id: 11,
              title: '为什么 B 不对',
              contextKind: 'question',
              contextId: 1,
              messageCount: 4,
              lastPreview: '题干在问 X, 你的答案 B...',
              createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
              updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
            },
            {
              id: 12,
              title: '解题思路',
              contextKind: 'general',
              contextId: null,
              messageCount: 2,
              lastPreview: null,
              createdAt: '2026-04-01T00:00:00Z',
              updatedAt: '2026-04-01T00:00:00Z',
            },
          ],
        }),
      ),
    );
    renderWithProviders(<ConversationsHistory />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-11')).toBeInTheDocument(),
    );
    expect(screen.getByText('为什么 B 不对')).toBeInTheDocument();
    expect(screen.getByText('题干在问 X, 你的答案 B...')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-item-12')).toBeInTheDocument();
  });

  it('list HTTP error → 显示 error state + retry button', async () => {
    server.use(
      http.get('/api/v2/llm/conversations', () =>
        HttpResponse.json({ detail: 'server error' }, { status: 500 }),
      ),
    );
    renderWithProviders(<ConversationsHistory />);
    await waitFor(() =>
      expect(screen.getByTestId('conversations-retry')).toBeInTheDocument(),
    );
    expect(screen.getByText('历史会话加载失败')).toBeInTheDocument();
  });
});
