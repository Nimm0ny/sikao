import styles from './BootCard.module.css';

/*
 * BootCard — V5 placeholder for routes whose real view hasn't landed yet.
 *
 * V5-M0.5 originally seeded this as the sole "/" element; V5-M3.5 wave 16
 * keeps it as the placeholder for /practice / /review / /note /
 * /question-hub / /me until each page view ships in its own commit, plus
 * the catch-all "*" fallback for typos / deep links into deprecated paths.
 *
 * Lives inside <Workspace> via <RootLayout><Outlet /></RootLayout>, so
 * inherits the workspace padding and max-width — no full-viewport sizing
 * needed here.
 */

// lint-allow-ui-copy: V5 placeholder copy; replaced by real page views in
// follow-up commits 17.2-17.6.

export function BootCard() {
  return (
    <article className={styles.root} data-testid="boot-card">
      <h1 className={styles.title}>Sikao V5-M3.5 boot</h1>
      <p className={styles.body}>
        当前路由的页面骨架尚未落地。V5-M3.5 wave 16 / 17 会逐页接入：Practice /
        Note / Me / Question Hub / Review。看到这张卡片说明 Rail 导航与 V5
        token surface 正常加载。
      </p>
    </article>
  );
}
