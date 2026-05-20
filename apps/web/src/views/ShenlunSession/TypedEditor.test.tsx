import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import TypedEditor from './TypedEditor';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

//
// 覆盖:
//   - 渲染 required props 不崩 + question label 可见
//   - textarea 有 aria-labelledby 指向 header (frontend/CLAUDE.md §3.7 label 政策)
//   - onChange 触发后传递 new value
//   - placeholder 文案来自 ESSAY_SIKAO_COPY.typedEditorPlaceholder
//   - stem === label 不重复渲染 stem 段; stem ≠ label 时 stem 段渲染
//   - spellCheck=false (CJK 不要浏览器拼写检查)
//
// 不覆盖 (留给后续 phase):
//   - bodyChars 字数计算 (shell 持有, 不是组件本身)
//   - 视觉对比 (master Chrome MCP 验收)

interface BuildPropsOverrides {
  readonly questionId?: string;
  readonly questionLabel?: string;
  readonly questionStem?: string;
  readonly value?: string;
  readonly onChange?: (next: string) => void;
  readonly maxWordCount?: number;
}

function buildProps(overrides: BuildPropsOverrides = {}) {
  return {
    questionId: overrides.questionId ?? 'q3',
    questionLabel: overrides.questionLabel ?? '题目三',
    questionStem: overrides.questionStem ?? '题目三',
    value: overrides.value ?? '',
    onChange: overrides.onChange ?? vi.fn(),
    maxWordCount: overrides.maxWordCount ?? 500,
  };
}

describe('TypedEditor', () => {
  it('renders without crashing with required props', () => {
    renderWithProviders(<TypedEditor {...buildProps()} />);
    expect(screen.getByTestId('shenlun-typed-editor')).toBeInTheDocument();
  });

  it('renders visible question label as header heading', () => {
    renderWithProviders(<TypedEditor {...buildProps({ questionLabel: '题目三' })} />);
    expect(screen.getByRole('heading', { level: 2, name: '题目三' })).toBeInTheDocument();
  });

  it('binds textarea via aria-labelledby to the visible header id (CLAUDE.md §3.7)', () => {
    renderWithProviders(<TypedEditor {...buildProps({ questionId: 'q3' })} />);
    const textarea = screen.getByTestId('shenlun-typed-editor-textarea');
    const header = screen.getByTestId('shenlun-typed-editor-header');
    const labelledBy = textarea.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    expect(labelledBy).toBe(header.id);
    expect(header.id).toMatch(/^shenlun-question-stem-q3-/);
  });

  it('fires onChange with the new textarea value', () => {
    const onChange = vi.fn();
    renderWithProviders(<TypedEditor {...buildProps({ onChange })} />);
    const textarea = screen.getByTestId('shenlun-typed-editor-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '改革开放四十年来' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('改革开放四十年来');
  });

  it('uses ESSAY_SIKAO_COPY.typedEditorPlaceholder for placeholder text', () => {
    renderWithProviders(<TypedEditor {...buildProps()} />);
    const textarea = screen.getByTestId('shenlun-typed-editor-textarea');
    expect(textarea.getAttribute('placeholder')).toBe(
      ESSAY_SIKAO_COPY.typedEditorPlaceholder,
    );
  });

  it('omits stem paragraph when stem equals label (avoid visual duplication)', () => {
    renderWithProviders(
      <TypedEditor {...buildProps({ questionLabel: '题目三', questionStem: '题目三' })} />,
    );
    const header = screen.getByTestId('shenlun-typed-editor-header');
    expect(header.querySelector('p')).toBeNull();
  });

  it('renders stem paragraph when stem differs from label', () => {
    renderWithProviders(
      <TypedEditor
        {...buildProps({
          questionLabel: '题目三',
          questionStem: '请就基层治理写一篇议论文，不少于 500 字。',
        })}
      />,
    );
    const header = screen.getByTestId('shenlun-typed-editor-header');
    const p = header.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.textContent).toContain('请就基层治理写一篇议论文');
  });

  it('disables browser spellcheck on the textarea (CJK)', () => {
    renderWithProviders(<TypedEditor {...buildProps()} />);
    const textarea = screen.getByTestId('shenlun-typed-editor-textarea');
    expect(textarea.getAttribute('spellcheck')).toBe('false');
  });
});
