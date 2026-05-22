import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';

import { RailMini } from '../RailMini';
import { TabBar } from '../TabBar';

describe('Legacy shell nav parity', () => {
  it('keeps TabBar aligned with canonical Home routes', () => {
    renderWithProviders(<TabBar />, { initialEntries: ['/'] });

    expect(screen.getByTestId('tabbar-home')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('tabbar-practice')).toHaveAttribute('href', '/practice');
    expect(screen.getByTestId('tabbar-review')).toHaveAttribute('href', '/review');
    expect(screen.getByTestId('tabbar-notes')).toHaveAttribute('href', '/notes');
    expect(screen.getByTestId('tabbar-profile')).toHaveAttribute('href', '/profile');
  });

  it('marks TabBar items active on nested canonical subroutes', () => {
    renderWithProviders(<TabBar />, { initialEntries: ['/review/items/12'] });

    expect(screen.getByTestId('tabbar-review')).toHaveClass('tab-item--active');
    expect(screen.getByTestId('tabbar-home')).not.toHaveClass('tab-item--active');
  });

  it('keeps RailMini aligned with canonical Home routes', () => {
    renderWithProviders(<RailMini />, { initialEntries: ['/'] });

    expect(screen.getByTestId('rail-mini-home')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('rail-mini-practice')).toHaveAttribute('href', '/practice');
    expect(screen.getByTestId('rail-mini-review')).toHaveAttribute('href', '/review');
    expect(screen.getByTestId('rail-mini-notes')).toHaveAttribute('href', '/notes');
    expect(screen.getByTestId('rail-mini-profile')).toHaveAttribute('href', '/profile');
  });

  it('marks RailMini items active on nested canonical subroutes', () => {
    renderWithProviders(<RailMini />, { initialEntries: ['/profile/records'] });

    expect(screen.getByTestId('rail-mini-profile')).toHaveClass('rail-mini__item--active');
    expect(screen.getByTestId('rail-mini-home')).not.toHaveClass('rail-mini__item--active');
  });
});
