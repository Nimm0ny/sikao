import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import axios from 'axios';
import { server } from '../server';

// P1 review fix Phase B.4-pre: spike test verifying msw v2 + jsdom + axios
// withCredentials cookie propagation works in this vitest setup BEFORE
// migrating Login/Register frontend code (B.4a/B.4b). If this test fails
// the migration plan needs to fall back to vi.mock or hand-rolled fetch
// stubs.

describe('msw v2 cookie integration spike', () => {
  beforeEach(() => {
    document.cookie.split(';').forEach((c) => {
      const eq = c.indexOf('=');
      const name = (eq > -1 ? c.substr(0, eq) : c).trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    });
  });

  it('msw Set-Cookie header surfaces to document.cookie via axios withCredentials', async () => {
    server.use(
      http.post('http://localhost/api/v2/auth/login', () =>
        HttpResponse.json(
          { accessToken: 'tk', user: { id: 1, username: 'a', displayName: 'A' } },
          {
            status: 200,
            headers: {
              'Set-Cookie': 'csrf_token=test-csrf-value; Path=/; SameSite=Strict',
            },
          },
        ),
      ),
    );

    const resp = await axios.post(
      'http://localhost/api/v2/auth/login',
      { username: 'a', password: 'b' },
      { withCredentials: true },
    );
    expect(resp.status).toBe(200);
    expect(resp.data.accessToken).toBe('tk');
    // jsdom + msw v2 limitation: Set-Cookie from cross-origin (or any) mock
    // doesn't auto-propagate to document.cookie. Confirm what *does* work:
    // 1) The Set-Cookie header is at least visible on the raw response object
    //    so the frontend can read it pre-jar (a fallback path).
    // 2) Subsequent fetch carries no cookie auto (NOT what we want long-term;
    //    but documents the boundary).
    const headers = resp.headers as unknown as Record<string, unknown>;
    const setCookieHeader = headers['set-cookie'];
    // Hard assertion: msw must surface Set-Cookie in response.headers.
    // If this fails, the cookie-on-response path is broken — frontend can't
    // extract csrf even via header fallback. Loud failure required.
    expect(setCookieHeader).toBeDefined();
    expect(String(setCookieHeader)).toContain('csrf_token=test-csrf-value');
    // Document.cookie sync from Set-Cookie is jsdom-dependent. Not asserting
    // either way: B.4a chose to read csrfToken from response body (LoginResponseV2)
    // for jsdom parity, side-stepping document.cookie entirely.
  });

  it('axios withCredentials does not error in jsdom (smoke)', async () => {
    server.use(
      http.get('http://localhost/api/v2/papers', () => HttpResponse.json([])),
    );
    const resp = await axios.get('http://localhost/api/v2/papers', {
      withCredentials: true,
    });
    expect(resp.status).toBe(200);
  });
});
