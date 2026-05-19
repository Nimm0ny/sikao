const DEFAULT_POST_LOGIN_PATH = '/app';

interface RedirectStateShape {
  readonly from?: unknown;
}

function isRedirectStateShape(value: unknown): value is RedirectStateShape {
  return typeof value === 'object' && value !== null;
}

function isSafeInternalPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

export function buildReturnTarget(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

export function resolvePostLoginTarget(
  state: unknown,
  fallback = DEFAULT_POST_LOGIN_PATH,
): string {
  if (!isRedirectStateShape(state)) {
    return fallback;
  }
  return isSafeInternalPath(state.from) ? state.from : fallback;
}
