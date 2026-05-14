import { WifiOffIcon } from '@sikao/ui/icons';
import { useOnline } from '@sikao/shared-utils/hooks/useOnline';
import { OFFLINE_COPY } from '@/lib/ui-copy';

// OfflineBanner — layout-level strip wired into AppShell. Renders only when
// the browser reports offline. style-guide §3.4 "warn = 你需要注意" — 离线
// 不是错误（不是 danger），而是一个状态提示，所以走 warn-bg + ink 文字。
//
// Marketing 静态页不挂 AppShell，所以拿不到本横条；接受。
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="bg-warn-bg text-ink text-sm flex items-center justify-center gap-2 px-4 py-2 border-b border-warn"
    >
      <WifiOffIcon size={16} className="w-4 h-4" />
      <span>{OFFLINE_COPY.banner}</span>
    </div>
  );
}
