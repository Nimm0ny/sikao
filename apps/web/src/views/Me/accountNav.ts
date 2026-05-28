/*
 * Account navigation SSOT for the Me / Profile family.
 *
 * Why: RailMe popover and in-page Profile SubNav must render from the same
 *      8-item account map so shared shell baseline stays frozen at 4 tabs
 *      while account-level expansion happens in one owned place only.
 */

export type AccountNavKey =
  | 'overview'
  | 'info'
  | 'goals'
  | 'learning'
  | 'records'
  | 'preferences'
  | 'security'
  | 'settings';

export interface AccountNavItem {
  readonly key: AccountNavKey;
  readonly label: string;
  readonly to: string;
  readonly enabled: boolean;
}

export const ACCOUNT_NAV_ITEMS: readonly AccountNavItem[] = [
  { key: 'overview', label: '概览', to: '/me', enabled: true },
  { key: 'info', label: '个人信息', to: '/me/info', enabled: false },
  { key: 'goals', label: '考试目标', to: '/me/goals', enabled: false },
  { key: 'learning', label: '学情', to: '/profile/learning', enabled: true },
  { key: 'records', label: '学习记录', to: '/profile/records', enabled: true },
  { key: 'preferences', label: '偏好', to: '/profile/practice-preferences', enabled: true },
  { key: 'security', label: '安全', to: '/me/security', enabled: false },
  { key: 'settings', label: '设置', to: '/me/settings', enabled: false },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getActiveAccountNavKey(pathname: string): AccountNavKey | null {
  if (pathname === '/me') return 'overview';
  if (matchesPrefix(pathname, '/me/info')) return 'info';
  if (matchesPrefix(pathname, '/me/goals')) return 'goals';
  if (matchesPrefix(pathname, '/profile/learning')) return 'learning';
  if (matchesPrefix(pathname, '/profile/records')) return 'records';
  if (matchesPrefix(pathname, '/profile/practice-preferences')) return 'preferences';
  if (matchesPrefix(pathname, '/me/security')) return 'security';
  if (matchesPrefix(pathname, '/me/settings')) return 'settings';
  return null;
}

export function isAccountFamilyPath(pathname: string): boolean {
  return getActiveAccountNavKey(pathname) !== null;
}
