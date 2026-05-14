import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';

// a11y note: `<MessageBubble role="user|assistant">` 的 `role` 是 React component
// prop, 不是 HTML ARIA role. jsx-a11y plugin 不能区分, 三处 render 行级 escape.

describe('MessageBubble', () => {
  it('user role: 右对齐 + ink 实底', () => {
    // eslint-disable-next-line jsx-a11y/aria-role
    render(<MessageBubble role="user">为什么</MessageBubble>);
    const bubble = screen.getByTestId('message-bubble-user');
    expect(bubble).toHaveTextContent('为什么');
    expect(bubble.className).toContain('justify-end');
  });

  it('assistant role: 左对齐 + surface 软底', () => {
    // eslint-disable-next-line jsx-a11y/aria-role
    render(<MessageBubble role="assistant">回答</MessageBubble>);
    const bubble = screen.getByTestId('message-bubble-assistant');
    expect(bubble).toHaveTextContent('回答');
    expect(bubble.className).toContain('justify-start');
  });

  it('whitespace-pre-wrap: 多行 content 保留换行', () => {
    render(
      // eslint-disable-next-line jsx-a11y/aria-role
      <MessageBubble role="assistant">
        步骤 1{'\n'}步骤 2{'\n'}步骤 3
      </MessageBubble>,
    );
    const bubble = screen.getByTestId('message-bubble-assistant');
    const inner = bubble.querySelector('div');
    expect(inner?.className).toContain('whitespace-pre-wrap');
  });
});
