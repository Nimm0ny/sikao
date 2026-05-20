import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import ResetPassword from '../auth/ResetPassword';

describe('ResetPassword', () => {
  it('410 expired/invalid token: shows tone=error EmptyState + 重新申请 link', async () => {
    server.use(
      http.post('/api/v2/auth/reset-password', () =>
        HttpResponse.json(
          { detail: 'invalid or expired token', code: 'token_invalid' },
          { status: 410 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ResetPassword />, {
      initialEntries: ['/reset-password?token=expired-token-1234567890ab'],
    });

    await user.type(screen.getByTestId('reset-new-password'), 'NewPass456!');
    await user.type(screen.getByTestId('reset-confirm-password'), 'NewPass456!');
    await user.click(screen.getByTestId('reset-submit'));

    await waitFor(() => {
      expect(screen.getByText('链接已失效')).toBeInTheDocument();
    });
    // 重新申请 link 进 forgot-password 即可断言失败态.
    const requestNew = screen.getByTestId('reset-request-new');
    expect(requestNew).toHaveAttribute('href', '/forgot-password');
  });
});
