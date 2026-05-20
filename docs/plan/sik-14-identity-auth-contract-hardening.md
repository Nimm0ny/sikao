---
type: engineering
status: active
owner: codex
last-reviewed: 2026-05-20
source: multica
multica-issue: SIK-14
---

# SIK-14 Identity/Auth Contract Hardening

## Problem

`SIK-13` Phase 1 backend skeleton has the right `/api/v2/auth/*` surface, but its current contract still leaks secrets and splits auth semantics:

- `POST /api/v2/auth/send-code` returns the verification code in JSON.
- register/login/session responses expose the raw session token in JSON while also setting the auth cookie.
- register/login responses expose the CSRF token in JSON even though the cookie is already the transport SSOT.
- v2 cookie `secure` is hardcoded to `false`.
- `reset-password` rotates the password hash but leaves existing sessions alive.
- v2 CSRF verification blocks bearer-authenticated callers because it always requires the CSRF cookie.

## Target Contract

### Auth transport

- Auth session secret SSOT is the `auth_session_v2` httpOnly cookie.
- CSRF secret SSOT is the `csrf_token_v2` cookie.
- `/api/v2/auth/register/email`
- `/api/v2/auth/register/phone`
- `/api/v2/auth/login`
  - still set both cookies
  - return `user` plus non-secret session metadata only
  - do not return raw session token
  - do not return raw CSRF token
- `/api/v2/auth/session`
  - accepts cookie auth or bearer auth
  - returns non-secret session metadata only

### Verification code flow

- `POST /api/v2/auth/send-code` must never return the plaintext verification code in the JSON body.
- `POST /api/v2/auth/register/phone` must require `smsCode` and verify it against `purpose="register"` before user/session creation.
- successful phone registration must write a verified primary phone contact instead of creating an unverified phone login.
- test/dev verification should use deterministic monkeypatching in tests, not production contract leaks.

### CSRF semantics

- If request uses the auth cookie, CSRF double-submit remains required.
- If request uses bearer auth only, CSRF check is skipped.
- This rule must apply uniformly to v2 mutating routes that share `verify_csrf_v2`.

### Password reset

- `POST /api/v2/auth/reset-password` must revoke all active `auth_sessions_v2` for that user after rotating the password hash.

### Cookie policy

- v2 auth cookie and CSRF cookie `secure` flag must come from `Settings.auth_cookie_secure`.

## Tests

- register/login response does not expose raw session token or CSRF token.
- send-code response does not expose plaintext OTP.
- phone register without `smsCode` is rejected.
- phone register with wrong `smsCode` is rejected.
- bearer-only `/api/v2/auth/session` works.
- bearer-only `/api/v2/auth/logout` works without CSRF cookie.
- cookie-auth mutating request without CSRF still returns `403 csrf_missing`.
- `/api/v2/auth/session` does not expose raw session token.
- expired or revoked v2 session returns explicit `401` codes.
- reset-password revokes existing sessions and old password stops working.
- `auth_cookie_secure=True` sets `Secure` on v2 cookies.
