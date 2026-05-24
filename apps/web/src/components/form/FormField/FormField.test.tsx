import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';

/*
 * FormField tests — V5 D.3.16 form wrapper.
 * Why: cover the 4 spec'd contracts — required asterisk, helper rendering,
 *      error rendering with priority over helper, and fail-fast on
 *      helper+error simultaneous use. Plus htmlFor wiring for a11y. Inputs
 *      below carry aria-label so jsx-a11y/control-has-associated-label is
 *      satisfied without depending on FormField's own <label htmlFor> link
 *      (which is exercised by the dedicated htmlFor test).
 */

describe('FormField', () => {
  it('renders the required asterisk when required=true', () => {
    render(
      <FormField label="姓名" required>
        <input id="name" aria-label="姓名输入" />
      </FormField>,
    );
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders helper text when only helper is provided', () => {
    render(
      <FormField label="邮箱" helper="可选填，用于找回密码">
        <input id="email" aria-label="邮箱输入" />
      </FormField>,
    );
    expect(screen.getByTestId('formfield-helper')).toHaveTextContent('可选填，用于找回密码');
    expect(screen.queryByTestId('formfield-error')).toBeNull();
  });

  it('renders error text and suppresses any sibling helper rendering', () => {
    render(
      <FormField label="密码" error="密码不能为空">
        <input id="pw" aria-label="密码输入" />
      </FormField>,
    );
    expect(screen.getByTestId('formfield-error')).toHaveTextContent('密码不能为空');
    expect(screen.queryByTestId('formfield-helper')).toBeNull();
  });

  it('throws fail-fast when both helper and error are supplied (spec mutex)', () => {
    // React 18 logs the thrown error to the console — silence it for the
    // assertion run only.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <FormField label="x" helper="h" error="e">
          <input id="x" aria-label="x" />
        </FormField>,
      ),
    ).toThrow(/mutually exclusive/);
    spy.mockRestore();
  });

  it('wires htmlFor onto the <label> so the control id binds for a11y', () => {
    render(
      <FormField label="姓名" htmlFor="name-input">
        <input id="name-input" aria-label="姓名输入" />
      </FormField>,
    );
    const labelEl = screen.getByText('姓名').closest('label');
    expect(labelEl?.getAttribute('for')).toBe('name-input');
  });
});
