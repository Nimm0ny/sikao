import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScopeToggle } from './ScopeToggle';

describe('ScopeToggle', () => {
  it('renders an internal Tabs with variant=segmented', () => {
    render(
      <ScopeToggle
        scopes={[
          { key: 'xc', label: '行测' },
          { key: 'sl', label: '申论' },
        ]}
        active="xc"
        onChange={() => {}}
      />,
    );
    const list = screen.getByRole('tablist');
    expect(list.dataset.variant).toBe('segmented');
  });

  it('forwards onChange when a different scope is selected', () => {
    const onChange = vi.fn();
    render(
      <ScopeToggle
        scopes={[
          { key: 'xc', label: '行测' },
          { key: 'sl', label: '申论' },
        ]}
        active="xc"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: '申论' }));
    expect(onChange).toHaveBeenCalledWith('sl');
  });

  it('marks the active scope via aria-selected', () => {
    render(
      <ScopeToggle
        scopes={[
          { key: 'xc', label: '行测' },
          { key: 'sl', label: '申论' },
        ]}
        active="sl"
        onChange={() => {}}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });
});
