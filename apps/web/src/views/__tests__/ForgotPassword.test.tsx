import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import ForgotPassword from '../auth/ForgotPassword';

describe('ForgotPassword', () => {
  it('happy path: submit shows success state + dev magic link inline', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />, { initialEntries: ['/forgot-password'] });

    await user.type(screen.getByTestId('forgot-email'), 'alice@example.com');
    await user.click(screen.getByTestId('forgot-submit'));

    // 成功 EmptyState 显示中性文案 (D5: 不暴露 user 是否注册过)
    await waitFor(() => {
      expect(screen.getByText('已尝试发送')).toBeInTheDocument();
    });
    // dev_magic_link inline 显示 (default handler 返了 _devMagicLink)
    const devLink = screen.getByTestId('forgot-dev-link');
    expect(devLink).toHaveTextContent('mock-token-abc');
  });
});
