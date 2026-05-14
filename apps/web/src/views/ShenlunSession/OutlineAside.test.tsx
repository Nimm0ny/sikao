import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import OutlineAside from './OutlineAside';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

// OutlineAside tests (PR13 P4, 2026-05-13).
//
// 覆盖:
//   - 默认 collapsed (defaultCollapsed 未传) → 渲染 32px 浮条 (role=button +
//     data-label + aria-label "展开大纲" + is-collapsed class)
//   - 浮条 click → 展开为 panel (data-collapsed=false + textarea 可见)
//   - 浮条 Enter / Space 键 → 展开 (键盘 a11y)
//   - defaultCollapsed=false → 直接渲染 panel (不走浮条)
//   - 展开态点 collapse 按钮 → 收回浮条
//   - textarea 通过 aria-labelledby 绑 header h2 id (CLAUDE.md §3.7 label 政策)
//   - onChange 触发后传新值
//   - placeholder 来自 ESSAY_SIKAO_COPY.outlineAsidePlaceholder
//
// 不覆盖 (后续 phase):
//   - CSS .t-aside.is-collapsed 视觉 (jsdom 不模拟 absolute / ::before, 走 chrome MCP)
//   - 跨题 outline state 持久化 (shell 持有, 不是组件)

interface BuildPropsOverrides {
  readonly questionId?: string;
  readonly questionLabel?: string;
  readonly value?: string;
  readonly onChange?: (next: string) => void;
  readonly defaultCollapsed?: boolean;
}

function buildProps(overrides: BuildPropsOverrides = {}) {
  return {
    questionId: overrides.questionId ?? 'q3',
    questionLabel: overrides.questionLabel ?? '题目三',
    value: overrides.value ?? '',
    onChange: overrides.onChange ?? vi.fn(),
    defaultCollapsed: overrides.defaultCollapsed,
  };
}

describe('OutlineAside', () => {
  it('renders 32px collapsed bar by default (defaultCollapsed not passed)', () => {
    renderWithProviders(<OutlineAside {...buildProps()} />);
    const aside = screen.getByTestId('shenlun-outline-aside');
    expect(aside).toBeInTheDocument();
    expect(aside.getAttribute('role')).toBe('button');
    expect(aside.getAttribute('data-collapsed')).toBe('true');
    expect(aside.getAttribute('data-label')).toBe(
      ESSAY_SIKAO_COPY.outlineAsideLabel,
    );
    expect(aside.getAttribute('aria-label')).toBe(
      ESSAY_SIKAO_COPY.outlineAsideExpandAria,
    );
    expect(aside.className).toContain('is-collapsed');
    // 浮条态不渲染 textarea / collapse button
    expect(screen.queryByTestId('shenlun-outline-textarea')).toBeNull();
    expect(screen.queryByTestId('shenlun-outline-collapse')).toBeNull();
  });

  it('expands to full panel when collapsed bar clicked', () => {
    renderWithProviders(<OutlineAside {...buildProps()} />);
    const bar = screen.getByTestId('shenlun-outline-aside');
    fireEvent.click(bar);
    const expanded = screen.getByTestId('shenlun-outline-aside');
    expect(expanded.getAttribute('data-collapsed')).toBe('false');
    expect(expanded.className).not.toContain('is-collapsed');
    expect(screen.getByTestId('shenlun-outline-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('shenlun-outline-collapse')).toBeInTheDocument();
  });

  it('expands on Enter key (keyboard a11y)', () => {
    renderWithProviders(<OutlineAside {...buildProps()} />);
    const bar = screen.getByTestId('shenlun-outline-aside');
    fireEvent.keyDown(bar, { key: 'Enter' });
    expect(
      screen.getByTestId('shenlun-outline-aside').getAttribute('data-collapsed'),
    ).toBe('false');
  });

  it('expands on Space key (keyboard a11y)', () => {
    renderWithProviders(<OutlineAside {...buildProps()} />);
    const bar = screen.getByTestId('shenlun-outline-aside');
    fireEvent.keyDown(bar, { key: ' ' });
    expect(
      screen.getByTestId('shenlun-outline-aside').getAttribute('data-collapsed'),
    ).toBe('false');
  });

  it('renders panel directly when defaultCollapsed=false', () => {
    renderWithProviders(
      <OutlineAside {...buildProps({ defaultCollapsed: false })} />,
    );
    const aside = screen.getByTestId('shenlun-outline-aside');
    expect(aside.getAttribute('data-collapsed')).toBe('false');
    expect(screen.getByTestId('shenlun-outline-textarea')).toBeInTheDocument();
  });

  it('collapse button returns aside to 32px bar', () => {
    renderWithProviders(
      <OutlineAside {...buildProps({ defaultCollapsed: false })} />,
    );
    expect(
      screen.getByTestId('shenlun-outline-aside').getAttribute('data-collapsed'),
    ).toBe('false');
    fireEvent.click(screen.getByTestId('shenlun-outline-collapse'));
    expect(
      screen.getByTestId('shenlun-outline-aside').getAttribute('data-collapsed'),
    ).toBe('true');
    expect(screen.queryByTestId('shenlun-outline-textarea')).toBeNull();
  });

  it('binds textarea via aria-labelledby to the visible header h2 id (CLAUDE.md §3.7)', () => {
    renderWithProviders(
      <OutlineAside {...buildProps({ defaultCollapsed: false, questionId: 'q3' })} />,
    );
    const textarea = screen.getByTestId('shenlun-outline-textarea');
    const labelledBy = textarea.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    // header h2 carries the same id; verify the id naming convention + DOM hit
    const headerNode = labelledBy ? document.getElementById(labelledBy) : null;
    expect(headerNode).not.toBeNull();
    expect(headerNode?.tagName).toBe('H2');
    expect(headerNode?.textContent).toBe(ESSAY_SIKAO_COPY.outlineAsideLabel);
    expect(labelledBy).toMatch(/^shenlun-outline-header-q3-/);
  });

  it('fires onChange with the new textarea value', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <OutlineAside
        {...buildProps({ defaultCollapsed: false, onChange })}
      />,
    );
    const textarea = screen.getByTestId(
      'shenlun-outline-textarea',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '1. 引论 改革开放' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('1. 引论 改革开放');
  });

  it('uses ESSAY_SIKAO_COPY.outlineAsidePlaceholder for textarea placeholder', () => {
    renderWithProviders(
      <OutlineAside {...buildProps({ defaultCollapsed: false })} />,
    );
    const textarea = screen.getByTestId('shenlun-outline-textarea');
    expect(textarea.getAttribute('placeholder')).toBe(
      ESSAY_SIKAO_COPY.outlineAsidePlaceholder,
    );
  });
});
