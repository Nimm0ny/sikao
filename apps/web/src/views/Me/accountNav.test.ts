import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_NAV_ITEMS,
  getActiveAccountNavKey,
  isAccountFamilyPath,
} from './accountNav';

describe('accountNav SSOT', () => {
  it('exports the locked 8-item account map in the expected order', () => {
    expect(
      ACCOUNT_NAV_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        to: item.to,
        enabled: item.enabled,
      })),
    ).toEqual([
      { key: 'overview', label: '概览', to: '/me', enabled: true },
      { key: 'info', label: '个人信息', to: '/me/info', enabled: false },
      { key: 'goals', label: '考试目标', to: '/me/goals', enabled: false },
      { key: 'learning', label: '学情', to: '/profile/learning', enabled: true },
      { key: 'records', label: '学习记录', to: '/profile/records', enabled: true },
      { key: 'preferences', label: '偏好', to: '/profile/practice-preferences', enabled: true },
      { key: 'security', label: '安全', to: '/me/security', enabled: false },
      { key: 'settings', label: '设置', to: '/me/settings', enabled: false },
    ]);
  });

  it('matches Me/Profile family routes with one shared helper', () => {
    expect(getActiveAccountNavKey('/me')).toBe('overview');
    expect(getActiveAccountNavKey('/me/info')).toBe('info');
    expect(getActiveAccountNavKey('/me/goals/foo')).toBe('goals');
    expect(getActiveAccountNavKey('/profile/learning')).toBe('learning');
    expect(getActiveAccountNavKey('/profile/records/weekly')).toBe('records');
    expect(getActiveAccountNavKey('/profile/practice-preferences')).toBe('preferences');
    expect(getActiveAccountNavKey('/me/security')).toBe('security');
    expect(getActiveAccountNavKey('/me/settings/notifications')).toBe('settings');
    expect(getActiveAccountNavKey('/practice')).toBeNull();
  });

  it('exposes a single profile-family predicate for RailMe trigger active state', () => {
    expect(isAccountFamilyPath('/me')).toBe(true);
    expect(isAccountFamilyPath('/profile/learning')).toBe(true);
    expect(isAccountFamilyPath('/profile/records')).toBe(true);
    expect(isAccountFamilyPath('/profile/practice-preferences')).toBe(true);
    expect(isAccountFamilyPath('/review')).toBe(false);
  });
});
