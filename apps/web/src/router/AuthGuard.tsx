/*
 * AuthGuard — SIK-89 Home M-Auth (2026-05-24).
 *
 * Wraps the root route subtree (RootLayout + nested views). Two failure
 * surfaces, both intentionally landing on BootCard:
 *
 *   1. Not logged in (useAuthStore.user == null)
 *      → renders <BootCard /> with no reason; BootCard's generic copy
 *        ("页面骨架尚未落地") covers this until the Auth Phase ships a
 *        real /login page.
 *
 *   2. Logged in but onboardingCompleted === false
 *      → also renders <BootCard /> (no reason). The Onboarding Phase has
 *        only README placeholders (docs/vault/05-migration/Phase/Onboarding/);
 *        when it ships, this branch flips to a redirect to the Onboarding
 *        flow.
 *
 *      Note: `onboardingCompleted === undefined` is treated as "completed"
 *      so old users (created before the field existed) and the DEV bypass
 *      both render through to <Outlet />. AGENT-H7 (fail-fast) is satisfied
 *      because we explicitly opt-out of the gate only on `=== false`, not
 *      on missing data.
 *
 * Why no react-router redirect?  The Auth / Onboarding phases haven't
 * landed real routes yet (`/login`, `/onboarding/*` are not registered).
 * Redirecting to a non-existent route would 404 / loop. BootCard is the
 * single placeholder per the cross-Tab fallback contract in §3.1.
 */
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@sikao/domain';
import { BootCard } from './BootCard';

export function AuthGuard() {
  const user = useAuthStore((s) => s.user);

  if (user === null) {
    return <BootCard />;
  }

  // Treat undefined as "completed" — see file header comment.
  if (user.onboardingCompleted === false) {
    return <BootCard />;
  }

  return <Outlet />;
}
