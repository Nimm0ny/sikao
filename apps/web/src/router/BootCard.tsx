/*
 * BootCard — V5-M0.5 placeholder (2026-05-24).
 *
 * Renders a single card confirming V5 token surface is loaded. Intentionally
 * uses only V5 semantic + component tokens (no V4 names) so this file also
 * doubles as a smoke test for tokens.css after the V1/V4 alias region was
 * dropped in commit 2.
 *
 * Replaced by real Home view in V5-M9 (SIK-81) or earlier when the SIK-29
 * Home family takes over the "/" route under V5 framework.
 */
export function BootCard() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--max-w-form)',
          padding: 'var(--card-padding)',
          background: 'var(--card-bg)',
          border: 'var(--card-border)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow-rest)',
          color: 'var(--color-text-primary)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--font-h2)',
            fontWeight: 'var(--font-weight-semibold)',
            margin: 0,
            marginBottom: 'var(--space-3)',
          }}
        >
          Sikao V5-M0.5 boot
        </h1>
        <p
          style={{
            fontSize: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          V4 业务层与 packages/ui 已在 V5-M0.5 big-bang 重建中清空。当前仅
          挂载最小启动壳，等 V5-M3 35 组件骨架与 V5-M9 6 桌面页骨架落地。
          看到这张卡片说明 V5 token surface（tokens.css §1-§7）正常加载。
        </p>
      </div>
    </div>
  );
}
