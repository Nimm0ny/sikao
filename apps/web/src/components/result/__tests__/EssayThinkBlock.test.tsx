import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EssayThinkBlock } from '../EssayThinkBlock';

describe('EssayThinkBlock', () => {
  it('renders tag + title + paragraphs', () => {
    render(
      <EssayThinkBlock
        title="对你来说, 最值得练的是 '引用更稳'."
        paragraphs={['四道题里 -7 分集中在引用.', '下一步: 稳定半句直接引语.']}
      />,
    );
    expect(screen.getByTestId('essay-think-block')).toBeInTheDocument();
    expect(screen.getByTestId('essay-think-block-tag').textContent).toBe('AI · 思考');
    expect(screen.getByTestId('essay-think-block-title').textContent).toMatch(/最值得练的/);
    expect(screen.getByTestId('essay-think-block-p-0')).toBeInTheDocument();
    expect(screen.getByTestId('essay-think-block-p-1')).toBeInTheDocument();
  });

  it('accepts custom tag', () => {
    render(
      <EssayThinkBlock
        tag="自定义 · 思考"
        title="A"
        paragraphs={['p1']}
      />,
    );
    expect(screen.getByTestId('essay-think-block-tag').textContent).toBe('自定义 · 思考');
  });

  it('renders mark highlights across paragraphs', () => {
    render(
      <EssayThinkBlock
        title="A"
        paragraphs={[
          '扣分集中在 论据 + 引用',
          '其中 Q3 一题贡献 -6 分',
        ]}
        highlights={['论据 + 引用', 'Q3']}
      />,
    );
    const p0 = screen.getByTestId('essay-think-block-p-0');
    const p1 = screen.getByTestId('essay-think-block-p-1');
    expect(p0.querySelectorAll('mark').length).toBe(1);
    expect(p0.querySelector('mark')?.textContent).toBe('论据 + 引用');
    expect(p1.querySelectorAll('mark').length).toBe(1);
    expect(p1.querySelector('mark')?.textContent).toBe('Q3');
  });

  it('renders footer slot when provided', () => {
    render(
      <EssayThinkBlock
        title="A"
        paragraphs={['p1']}
        footer={<a data-testid="think-cta" href="/x">进入专项 →</a>}
      />,
    );
    expect(screen.getByTestId('essay-think-block-footer')).toBeInTheDocument();
    expect(screen.getByTestId('think-cta')).toBeInTheDocument();
  });

  it('omits footer when not provided', () => {
    render(<EssayThinkBlock title="A" paragraphs={['p1']} />);
    expect(screen.queryByTestId('essay-think-block-footer')).toBeNull();
  });

  it('title CJK 不带 italic (CLAUDE.md §4)', () => {
    render(<EssayThinkBlock title="结构稳了" paragraphs={['正文']} />);
    const title = screen.getByTestId('essay-think-block-title');
    expect(title.className).not.toMatch(/italic/);
  });
});
