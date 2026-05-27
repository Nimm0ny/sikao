// lint-allow-ui-copy: SIK-122 Home topbar — copy-strings flagged by
// lint-ui-copy-ssot are page-skeleton CN strings for the V5 prototype
// contract. Future i18n / SSOT migration tracked under future Phase 6+.
import { SpriteIcon } from '../../../components/atom';
import { Button } from '../../../components/form';
import { useCommandPaletteStore } from '@/lib/commandPalette';
import { useProgressWeeklySummary } from '@sikao/api-client/progressQueries';
import styles from './HomeTopbar.module.css';

/*
 * HomeTopbar — SIK-122 (V5 Home v2.1 topbar contract).
 *
 * Why: replaces PageHeader for Home only. Renders 4 elements:
 *      1. greeting (h2 title) + subtitle (date · streak)
 *      2. cmd-k search box (clicking opens the shared CommandPalette
 *         via useCommandPaletteStore — same store the Rail cmd row uses)
 *      3. notification bell + settings gear icon-btn placeholders
 *         (disabled — non-goals SIK-122)
 *      4. primary CTA (开始今日练习)
 *
 *      AGENT-H7: subtitle streak is fetched lazily via
 *      useProgressWeeklySummary(); when the request is loading, errored,
 *      or returns streakDays === 0 we render only the date — never a
 *      fabricated "已连续签到 0 天" string.
 */

const SUBTITLE_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function formatDateZh(date: Date): string {
  return SUBTITLE_DATE_FORMATTER.format(date);
}

export interface HomeTopbarProps {
  /**
   * Override "now" for tests / Storybook — real callers omit this and the
   * component reads from the real Date constructor.
   */
  readonly nowOverride?: Date;
}

export function HomeTopbar({ nowOverride }: HomeTopbarProps = {}) {
  const openPalette = useCommandPaletteStore((s) => s.openPalette);
  const weekly = useProgressWeeklySummary();

  const now = nowOverride ?? new Date();
  const dateText = formatDateZh(now);
  const streakDays = weekly.data?.streakDays;
  const subtitle =
    typeof streakDays === 'number' && streakDays > 0
      ? `${dateText} · 已连续签到 ${streakDays} 天`
      : dateText;

  return (
    <header className={styles.root} data-testid="home-topbar">
      <div className={styles.greet}>
        <h1 className={styles.title}>早上好，lhr</h1>
        <p className={styles.subtitle} data-testid="home-topbar-subtitle">
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        className={styles.cmd}
        data-testid="home-topbar-cmd"
        aria-label="打开命令面板"
        onClick={openPalette}
      >
        <SpriteIcon id="search" size={16} className={styles.cmdIcon} />
        <span className={styles.cmdPlaceholder}>搜索题目、笔记、跳转、命令…</span>
        <kbd className={styles.cmdKbd} aria-hidden="true">⌘K</kbd>
      </button>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="通知"
          data-testid="home-topbar-bell"
          disabled
        >
          <SpriteIcon id="bell" size={18} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="设置"
          data-testid="home-topbar-settings"
          disabled
        >
          <SpriteIcon id="settings" size={18} />
        </button>
        <Button variant="primary">
          开始今日练习
        </Button>
      </div>
    </header>
  );
}
