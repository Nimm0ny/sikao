import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { EmailPanel } from '../EmailPanel';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('EmailPanel', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });
  });

  it('user=null -> renders nothing', () => {
    useAuthStore.setState({ user: null });
    const { container } = renderWithProviders(<EmailPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('email missing -> shows unbound state and bind-email entry', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailPanel />);

    expect(screen.getByTestId('profile-email-display')).toHaveTextContent('尚未绑定邮箱');
    expect(screen.getByTestId('profile-email-bind-link')).toHaveTextContent('绑定邮箱');
    expect(screen.queryByTestId('profile-email-verified-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-email-pending-chip')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('profile-email-bind-link'));
    expect(navigateMock).toHaveBeenCalledWith('/bind-email');
  });

  it('verified email -> shows email and verified chip without old edit or send controls', () => {
    useAuthStore.setState({
      user: {
        id: 1,
        username: 'tester',
        displayName: 'Tester',
        email: 'tester@example.com',
        emailVerified: true,
      },
    });

    renderWithProviders(<EmailPanel />);

    expect(screen.getByTestId('profile-email-display')).toHaveTextContent('tester@example.com');
    expect(screen.getByTestId('profile-email-verified-chip')).toHaveTextContent('已验证');
    expect(screen.getByTestId('profile-email-bind-link')).toHaveTextContent('更换邮箱');
    expect(screen.queryByTestId('profile-email-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-email-send-verify')).not.toBeInTheDocument();
  });

  it('unverified email -> shows pending chip and still routes through bind-email flow', async () => {
    useAuthStore.setState({
      user: {
        id: 1,
        username: 'tester',
        displayName: 'Tester',
        email: 'tester@example.com',
        emailVerified: false,
      },
    });
    const user = userEvent.setup();

    renderWithProviders(<EmailPanel />);

    expect(screen.getByTestId('profile-email-pending-chip')).toHaveTextContent('未验证');
    expect(screen.queryByTestId('profile-email-send-verify')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('profile-email-bind-link'));
    expect(navigateMock).toHaveBeenCalledWith('/bind-email');
  });
});
