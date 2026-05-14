import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { ChatPanel } from '../ChatPanel';

// ChatPanel 单元测试聚焦静态 UI 行为 (intent chip / 输入 / disabled state).
// 流式 SSE 行为走 streamingFetch.test.ts + 后续浏览器 e2e self-verify;
// 这里 mock fetch 既麻烦又脆 (state 异步链, msw RT stream 不稳).

describe('ChatPanel', () => {
  it('open=false → 不渲染 panel content', () => {
    renderWithProviders(
      <ChatPanel
        open={false}
        onClose={() => {}}
        contextKind="general"
        contextId={null}
      />,
    );
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument();
  });

  it('open=true → 渲染 5 个 intent chip + empty state + 输入框', () => {
    renderWithProviders(
      <ChatPanel
        open
        onClose={() => {}}
        contextKind="question"
        contextId={42}
      />,
    );
    // 5 类 intent chip 全部存在
    expect(screen.getByTestId('chat-intent-why_wrong')).toBeInTheDocument();
    expect(screen.getByTestId('chat-intent-common_traps')).toBeInTheDocument();
    expect(screen.getByTestId('chat-intent-solving_path')).toBeInTheDocument();
    expect(screen.getByTestId('chat-intent-category_summary')).toBeInTheDocument();
    expect(screen.getByTestId('chat-intent-freeform')).toBeInTheDocument();
    // 输入框 + empty state
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByText('从一个问题开始')).toBeInTheDocument();
  });

  it('默认选中 freeform; 点 why_wrong 切换 active', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChatPanel
        open
        onClose={() => {}}
        contextKind="general"
        contextId={null}
      />,
    );
    expect(screen.getByTestId('chat-intent-freeform')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(screen.getByTestId('chat-intent-why_wrong'));
    expect(screen.getByTestId('chat-intent-why_wrong')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('chat-intent-freeform')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('send button disabled 当 draft 为空', () => {
    renderWithProviders(
      <ChatPanel
        open
        onClose={() => {}}
        contextKind="general"
        contextId={null}
      />,
    );
    const sendBtn = screen.getByTestId('chat-send');
    expect(sendBtn).toBeDisabled();
  });

  it('输入文本后 send button 启用', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChatPanel
        open
        onClose={() => {}}
        contextKind="general"
        contextId={null}
      />,
    );
    const input = screen.getByTestId('chat-input');
    await user.type(input, '你好');
    expect(screen.getByTestId('chat-send')).not.toBeDisabled();
  });

  it('key 变化触发 React 重 mount → state 重置 (P1 #1 跨 context 隔离)', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <ChatPanel
        key="question-100"
        open
        onClose={() => {}}
        contextKind="question"
        contextId={100}
      />,
    );
    const input1 = screen.getByTestId('chat-input') as HTMLTextAreaElement;
    await user.type(input1, '题 A 的问题');
    expect(input1.value).toBe('题 A 的问题');

    // 切到题 B (key 变化触发 React 重建实例).
    rerender(
      <ChatPanel
        key="question-200"
        open
        onClose={() => {}}
        contextKind="question"
        contextId={200}
      />,
    );
    const input2 = screen.getByTestId('chat-input') as HTMLTextAreaElement;
    // 新实例 → draft 重置, 不再含上一题输入.
    expect(input2.value).toBe('');
    // send button 也 disabled (空 draft).
    expect(screen.getByTestId('chat-send')).toBeDisabled();
  });
});
