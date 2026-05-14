import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderStemWithMarks } from '../renderStemWithMarks';
import type { Mark } from '@sikao/domain/xingce/useHighlightStore';

// P5b/2 renderStemWithMarks 单测.
// 验证: sanitize chain / text node 切片 / 跨 inline element wrap / 多 mark 不重叠 /
// 空 input / empty marks / 颜色 data-c 正确.

function makeMark(overrides: Partial<Mark> = {}): Mark {
  return {
    id: 'm1',
    questionId: 'q1',
    textStart: 0,
    textLength: 3,
    colorKey: 'y',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('renderStemWithMarks', () => {
  it('empty html → empty array', () => {
    expect(renderStemWithMarks('', [])).toEqual([]);
  });

  it('no marks → plain text 输出 (sanitized HTML 内文本)', () => {
    const nodes = renderStemWithMarks('<p>hello world</p>', []);
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toBe('hello world');
    expect(container.querySelector('mark')).toBeNull();
  });

  it('1 mark covering range → <mark data-c=y> wrap 该段', () => {
    const marks = [makeMark({ textStart: 0, textLength: 5, colorKey: 'y' })];
    const nodes = renderStemWithMarks('hello world', marks);
    const { container } = render(<>{nodes}</>);
    const mark = container.querySelector('mark.fb-hl');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('hello');
    expect(mark?.getAttribute('data-c')).toBe('y');
    expect(mark?.getAttribute('data-mark-id')).toBe('m1');
  });

  it('mark 跨 inline element (em) 多段 wrap', () => {
    const html = '前缀<em>中段</em>后缀';
    // textIndex: "前缀中段后缀" → start=1 length=4 ("缀中段后")
    const marks = [makeMark({ textStart: 1, textLength: 4, colorKey: 'g' })];
    const nodes = renderStemWithMarks(html, marks);
    const { container } = render(<>{nodes}</>);
    const allMarks = container.querySelectorAll('mark.fb-hl');
    expect(allMarks.length).toBe(3); // "缀" / "中段" (em 内) / "后"
    allMarks.forEach((m) => {
      expect(m.getAttribute('data-c')).toBe('g');
    });
  });

  it('2 不重叠 marks → 各自 wrap (含切片正确)', () => {
    const marks = [
      makeMark({ id: 'm1', textStart: 0, textLength: 3, colorKey: 'y' }),
      makeMark({ id: 'm2', textStart: 6, textLength: 5, colorKey: 'b' }),
    ];
    const nodes = renderStemWithMarks('hello world bye', marks);
    const { container } = render(<>{nodes}</>);
    const m1 = container.querySelector('mark[data-mark-id="m1"]');
    const m2 = container.querySelector('mark[data-mark-id="m2"]');
    expect(m1?.textContent).toBe('hel');
    expect(m1?.getAttribute('data-c')).toBe('y');
    expect(m2?.textContent).toBe('world');
    expect(m2?.getAttribute('data-c')).toBe('b');
  });

  it('sanitize: <script> 剥掉, mark 仍正确算 textIndex', () => {
    const html = 'hi<script>alert(1)</script>world';
    // sanitize 后 textContent = "hiworld" (script 整体剥)
    const marks = [makeMark({ textStart: 2, textLength: 5, colorKey: 'p' })];
    const nodes = renderStemWithMarks(html, marks);
    const { container } = render(<>{nodes}</>);
    // 验证没有 script tag
    expect(container.querySelector('script')).toBeNull();
    const mark = container.querySelector('mark.fb-hl');
    expect(mark?.textContent).toBe('world');
    expect(mark?.getAttribute('data-c')).toBe('p');
  });

  it('mark textStart 越界 → no-op (不渲染 mark)', () => {
    // text length = 5 ("hello"), mark start=100 → 切片不命中
    const marks = [makeMark({ textStart: 100, textLength: 3 })];
    const nodes = renderStemWithMarks('hello', marks);
    const { container } = render(<>{nodes}</>);
    expect(container.querySelector('mark.fb-hl')).toBeNull();
    expect(container.textContent).toBe('hello');
  });

  it('marks 乱序 input → 内部按 textStart asc 处理 (结果一致)', () => {
    const marks = [
      makeMark({ id: 'second', textStart: 6, textLength: 5, colorKey: 'b' }),
      makeMark({ id: 'first', textStart: 0, textLength: 3, colorKey: 'y' }),
    ];
    const nodes = renderStemWithMarks('hello world', marks);
    const { container } = render(<>{nodes}</>);
    const firstM = container.querySelector('mark[data-mark-id="first"]');
    const secondM = container.querySelector('mark[data-mark-id="second"]');
    expect(firstM?.textContent).toBe('hel');
    expect(secondM?.textContent).toBe('world');
  });

  it('preserve <strong> / <em> tags + class attribute', () => {
    const html = '<p>前<strong class="x">粗</strong>后</p>';
    const nodes = renderStemWithMarks(html, []);
    const { container } = render(<>{nodes}</>);
    const strong = container.querySelector('strong.x');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('粗');
  });
});
