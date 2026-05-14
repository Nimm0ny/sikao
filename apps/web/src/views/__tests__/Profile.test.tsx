import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import Profile from '../Profile';

vi.mock('@/components/profile/EmailPanel', () => ({
  EmailPanel: () => <div data-testid="profile-email-card-mock" />,
}));

vi.mock('@/components/profile/AccountSecuritySection', () => ({
  AccountSecuritySection: () => <div data-testid="profile-security-card-mock" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Profile compact entry page', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });
  });

  it('renders the account shell and keeps logout outside the identity card', () => {
    renderWithProviders(<Profile />, { initialEntries: ['/profile'] });

    expect(screen.getByTestId('profile-display-name')).toHaveTextContent('Tester');
    expect(screen.getByTestId('profile-security-card-mock')).toBeInTheDocument();
    expect(screen.getByTestId('profile-email-card-mock')).toBeInTheDocument();

    const logout = screen.getByTestId('profile-logout-btn');
    const identityCard = screen.getByTestId('profile-identity-card');
    expect(identityCard.contains(logout)).toBe(false);
    expect(logout.closest('[class*="border-t"]')).not.toBeNull();
  });

  it('renders the learning tools card rows in the fixed order', () => {
    renderWithProviders(<Profile />, { initialEntries: ['/profile'] });

    const card = screen.getByTestId('profile-learning-tools-card');
    const rows = [
      screen.getByTestId('profile-dashboard-entry'),
      screen.getByTestId('profile-study-plan-entry'),
      screen.getByTestId('profile-essay-history-entry'),
      screen.getByTestId('profile-conversations-entry'),
    ];

    expect(rows.every((row) => card.contains(row))).toBe(true);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('学情数据'),
      expect.stringContaining('学习计划'),
      expect.stringContaining('我的申论'),
      expect.stringContaining('解析问答'),
    ]);

    const buttons = within(card).getAllByRole('button');
    expect(buttons).toEqual(rows);
  });

  it('does not render the old embedded data cards', () => {
    renderWithProviders(<Profile />, { initialEntries: ['/profile'] });

    expect(screen.queryByTestId('profile-practice-breakdown-eyebrow')).not.toBeInTheDocument();
    expect(screen.queryByTestId('predicted-score-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-llm-usage-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-settings-placeholder')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-stats-card')).not.toBeInTheDocument();
  });
});
