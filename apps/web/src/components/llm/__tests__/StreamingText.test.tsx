import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingText } from '../StreamingText';

describe('StreamingText', () => {
  it('text="" + isStreaming → 显示 thinking 占位', () => {
    render(<StreamingText text="" isStreaming />);
    expect(screen.getByTestId('streaming-thinking')).toBeInTheDocument();
    expect(screen.getByTestId('streaming-thinking')).toHaveTextContent(
      '正在整理回答…',
    );
  });

  it('text 非空 + isStreaming → 显示 text + 光标 ▍', () => {
    render(<StreamingText text="Hello" isStreaming />);
    const span = screen.getByTestId('streaming-active');
    expect(span).toHaveTextContent('Hello');
    expect(span).toHaveTextContent('▍');
  });

  it('!isStreaming → 显示 text 不带光标', () => {
    render(<StreamingText text="Final" isStreaming={false} />);
    const span = screen.getByTestId('streaming-final');
    expect(span).toHaveTextContent('Final');
    expect(span).not.toHaveTextContent('▍');
  });
});
