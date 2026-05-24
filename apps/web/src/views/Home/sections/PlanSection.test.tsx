/*
 * PlanSection tests — SIK-90 Home M-A wave 1 (2026-05-24).
 *
 * Cover the segment switch contract:
 *   1. renders the 3 known views with the persisted (or default) one selected
 *   2. clicking a tab triggers usePlanStore.setCurrentView AND
 *      useDashboardPreferenceStore.patchPreferences({ homeCalendarView })
 *   3. invalid persisted preference values fall back to the store default
 *      (no `?? defaultValue` over arbitrary input — AGENT-H7)
 *   4. countdown chip renders the placeholder when no override is provided
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';
import { PlanSection } from './PlanSection';

const PREF_KEY = 'homeCalendarView';

describe('PlanSection (Home M-A wave 1)', () => {
  beforeEach(() => {
    // Reset both stores between tests so persisted view from one case
    // doesn't bleed into the next.
    usePlanStore.setState({ currentView: 'week' });
    useDashboardPreferenceStore.setState({
      preferences: {},
      profileLoaded: false,
      isPersisting: false,
      lastPersistedAt: null,
      lastPersistError: null,
    });
  });

  it('renders the 3 segment tabs with default "week" selected', () => {
    render(<PlanSection>body</PlanSection>);
    const today = screen.getByRole('tab', { name: '今日' });
    const week = screen.getByRole('tab', { name: '周' });
    const month = screen.getByRole('tab', { name: '月' });
    expect(today).toHaveAttribute('aria-selected', 'false');
    expect(week).toHaveAttribute('aria-selected', 'true');
    expect(month).toHaveAttribute('aria-selected', 'false');
  });

  it('reads the persisted preference (today) and selects that tab', () => {
    useDashboardPreferenceStore.setState({
      preferences: { [PREF_KEY]: 'today' },
    });
    render(<PlanSection>body</PlanSection>);
    expect(screen.getByRole('tab', { name: '今日' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '周' })).toHaveAttribute('aria-selected', 'false');
  });

  it('falls back to store default when persisted value is invalid', () => {
    useDashboardPreferenceStore.setState({
      preferences: { [PREF_KEY]: 'bogus-value' },
    });
    usePlanStore.setState({ currentView: 'month' });
    render(<PlanSection>body</PlanSection>);
    // No coercion: invalid -> use store default (which we set to 'month').
    expect(screen.getByRole('tab', { name: '月' })).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking a tab updates usePlanStore and triggers patchPreferences', async () => {
    const patchSpy = vi.fn().mockResolvedValue(undefined);
    useDashboardPreferenceStore.setState({ patchPreferences: patchSpy });
    const user = userEvent.setup();

    render(<PlanSection>body</PlanSection>);

    await user.click(screen.getByRole('tab', { name: '今日' }));

    expect(usePlanStore.getState().currentView).toBe('today');
    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).toHaveBeenCalledWith({ [PREF_KEY]: 'today' });
  });

  it('renders the countdown chip with placeholder copy by default', () => {
    render(<PlanSection>body</PlanSection>);
    const chip = screen.getByTestId('home-plan-countdown');
    expect(chip).toHaveTextContent('国考');
    expect(chip).toHaveTextContent('138');
  });

  it('renders the countdown chip with overridden values when provided', () => {
    render(
      <PlanSection countdown={{ label: '省考', daysUntil: 200 }}>body</PlanSection>,
    );
    const chip = screen.getByTestId('home-plan-countdown');
    expect(chip).toHaveTextContent('省考');
    expect(chip).toHaveTextContent('200');
  });
});
