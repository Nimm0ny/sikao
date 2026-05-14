import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@sikao/test-utils/server';
import SendCodeButton from '../SendCodeButton';

describe('SendCodeButton', () => {
  // 仅 fake setInterval / clearInterval (倒计时用), setTimeout 留真实让
  // msw fetch interceptor 内部 microtask / promise queue 正常 flush.
  // 之前 vi.useFakeTimers() 全 fake 导致 user.click 等 msw 响应永远 timeout.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disabled when phone < 11 digits', () => {
    render(<SendCodeButton phone="12345" purpose="register" />);
    const btn = screen.getByTestId('send-code-button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('发送验证码');
  });

  it('enabled when phone ≥ 11 digits', () => {
    render(<SendCodeButton phone="13800138000" purpose="register" />);
    expect(screen.getByTestId('send-code-button')).toBeEnabled();
  });

  it('happy click → countdown starts at 60s, button disabled', async () => {
    server.use(
      http.post('/api/v2/auth/sms/send-code', () =>
        HttpResponse.json({ ok: true, _devMagicCode: '123456' }),
      ),
    );
    const user = userEvent.setup();
    render(<SendCodeButton phone="13800138000" purpose="register" />);

    await user.click(screen.getByTestId('send-code-button'));

    await waitFor(() => {
      expect(screen.getByTestId('send-code-button')).toHaveTextContent('60s 后重发');
    });
    expect(screen.getByTestId('send-code-button')).toBeDisabled();
  });

  it('countdown ticks down each second', async () => {
    server.use(
      http.post('/api/v2/auth/sms/send-code', () => HttpResponse.json({ ok: true })),
    );
    const user = userEvent.setup();
    render(<SendCodeButton phone="13800138000" purpose="register" />);

    await user.click(screen.getByTestId('send-code-button'));
    await waitFor(() => {
      expect(screen.getByTestId('send-code-button')).toHaveTextContent('60s 后重发');
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('send-code-button')).toHaveTextContent('59s 后重发');

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('send-code-button')).toHaveTextContent('57s 后重发');
  });

  it('countdown ends → button re-enabled with default label', async () => {
    server.use(
      http.post('/api/v2/auth/sms/send-code', () => HttpResponse.json({ ok: true })),
    );
    const user = userEvent.setup();
    render(<SendCodeButton phone="13800138000" purpose="register" />);

    await user.click(screen.getByTestId('send-code-button'));
    await waitFor(() => {
      expect(screen.getByTestId('send-code-button')).toHaveTextContent('60s 后重发');
    });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    const btn = screen.getByTestId('send-code-button');
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent('发送验证码');
  });

  it('429 rate limit → countdown does NOT start, button stays clickable', async () => {
    server.use(
      http.post('/api/v2/auth/sms/send-code', () =>
        HttpResponse.json({ detail: 'rate_limited' }, { status: 429 }),
      ),
    );
    const user = userEvent.setup();
    render(<SendCodeButton phone="13800138000" purpose="register" />);

    await user.click(screen.getByTestId('send-code-button'));

    // wait for the failed request to settle (isSending → false)
    await waitFor(() => {
      expect(screen.getByTestId('send-code-button')).toBeEnabled();
    });
    expect(screen.getByTestId('send-code-button')).toHaveTextContent('发送验证码');
  });

  it('disabled prop blocks click even if phone valid', () => {
    render(<SendCodeButton phone="13800138000" purpose="register" disabled />);
    expect(screen.getByTestId('send-code-button')).toBeDisabled();
  });
});
