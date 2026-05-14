/**
 * AccountSecuritySection · Identity v2 wire 补漏 (Profile v2 §B2, 2026-05-08).
 *
 * 4 case 覆盖:
 * 1. phone=null + email=null → 两 row 显「尚未绑定」+ 「绑定邮箱」/「绑定手机」文案
 * 2. email 已绑 + verified=true → 显示邮箱 + verified Badge (success hairline)
 * 3. PasswordRow disabled (aria-disabled / tabIndex=-1 / cursor-not-allowed)
 * 4. click 「绑定手机」row → useNavigate 收到 '/bind-phone'
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { AccountSecuritySection } from '../AccountSecuritySection';

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

describe('AccountSecuritySection', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('phone=null + email=null → 两 row 显「尚未绑定」+ 提示文案', () => {
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });
    renderWithProviders(<AccountSecuritySection />);

    const emailRow = screen.getByTestId('profile-security-email-row');
    const phoneRow = screen.getByTestId('profile-security-phone-row');
    expect(emailRow).toHaveTextContent('尚未绑定');
    expect(phoneRow).toHaveTextContent('尚未绑定');
    expect(emailRow).toHaveTextContent('绑定邮箱');
    expect(phoneRow).toHaveTextContent('绑定手机');
    // 未绑定不显 verified/pending chip
    expect(
      screen.queryByTestId('profile-security-email-verified-chip'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('profile-security-phone-pending-chip'),
    ).not.toBeInTheDocument();
  });

  it('email 已绑 + verified=true → 显示邮箱 + verified Badge (hairline success)', () => {
    useAuthStore.setState({
      user: {
        id: 1,
        username: 'tester',
        displayName: 'Tester',
        email: 'tester@example.com',
        emailVerified: true,
      },
    });
    renderWithProviders(<AccountSecuritySection />);

    const emailRow = screen.getByTestId('profile-security-email-row');
    expect(emailRow).toHaveTextContent('tester@example.com');
    const chip = screen.getByTestId('profile-security-email-verified-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('已验证');
  });

  it('PasswordRow disabled (aria-disabled / tabIndex=-1 / cursor-not-allowed)', () => {
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });
    renderWithProviders(<AccountSecuritySection />);

    const passwordRow = screen.getByTestId('profile-password-row-disabled');
    expect(passwordRow).toHaveAttribute('aria-disabled', 'true');
    expect(passwordRow).toHaveAttribute('tabindex', '-1');
    expect(passwordRow.className).toContain('cursor-not-allowed');
    expect(passwordRow).toHaveTextContent('修改密码');
    expect(passwordRow).toHaveTextContent('改密功能即将上线');
  });

  it('click 「绑定手机」row → useNavigate 收到 /bind-phone', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });
    const user = userEvent.setup();
    renderWithProviders(<AccountSecuritySection />);

    await user.click(screen.getByTestId('profile-security-phone-row'));
    expect(navigateMock).toHaveBeenCalledWith('/bind-phone');
  });
});
