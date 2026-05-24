import { useSearchParams } from 'react-router-dom';
import styles from './BootCard.module.css';

/*
 * BootCard — V5 placeholder for routes whose real view hasn't landed yet.
 *
 * V5-M0.5 originally seeded this as the sole "/" element; V5-M3.5 wave 16
 * keeps it as the placeholder for /practice / /review / /note /
 * /question-hub / /me until each page view ships in its own commit, plus
 * the catch-all "*" fallback for typos / deep links into deprecated paths.
 *
 * SIK-89 Home M-Auth wave 2 (2026-05-24): added `?reason=` query param
 * support so each Tab's cross-Tab jump fallback (per plan §7.2) can
 * surface a more specific copy variant. Four reasons are recognised:
 *
 *   - missing-route       — typo / deep link into a route that never existed
 *   - coming-soon-practice / coming-soon-review / coming-soon-notes
 *                         — cross-Tab jumps whose target Tab milestone has
 *                           not landed yet (Practice M-Session, Review
 *                           M-Hub, Note M-Editor)
 *
 * Unknown / missing reasons fall back to the generic "页面骨架尚未落地"
 * copy (also the V5-M0.5 baseline), which keeps existing call sites
 * working without source edits.
 *
 * Lives inside <Workspace> via <RootLayout><Outlet /></RootLayout>, so
 * inherits the workspace padding and max-width — no full-viewport sizing
 * needed here.
 */

// lint-allow-ui-copy: V5 placeholder copy. Router-level file (not under
// views/components/), so lint-ui-copy-ssot does not scan it; the CJK copy
// table below is the SSOT for placeholder/coming-soon states.

type BootCardReason =
  | 'missing-route'
  | 'coming-soon-practice'
  | 'coming-soon-review'
  | 'coming-soon-notes';

interface BootCardCopy {
  readonly title: string;
  readonly body: string;
}

const REASON_COPY: Record<BootCardReason, BootCardCopy> = {
  'missing-route': {
    title: '页面未找到',
    body:
      '该地址不在当前可用的路由列表里。请检查链接，或回到首页选择目标 Tab。',
  },
  'coming-soon-practice': {
    title: '答题功能即将上线',
    body:
      '当前点击的入口将跳转到 Practice 答题页，但 Practice M-Session 尚未发布。请在功能上线后再次尝试。',
  },
  'coming-soon-review': {
    title: '题目复盘页即将上线',
    body:
      '当前点击的入口将跳转到 Review 题目中枢页，但 Review M-Hub 尚未发布。请在功能上线后再次尝试。',
  },
  'coming-soon-notes': {
    title: '笔记功能即将上线',
    body:
      '当前点击的入口将跳转到 Note 编辑器，但 Note M-Editor 尚未发布。请在功能上线后再次尝试。',
  },
};

const GENERIC_COPY: BootCardCopy = {
  title: 'Sikao V5-M3.5 boot',
  body:
    '当前路由的页面骨架尚未落地。V5-M3.5 wave 16 / 17 会逐页接入：Practice / Note / Me / Question Hub / Review。看到这张卡片说明 Rail 导航与 V5 token surface 正常加载。',
};

function isKnownReason(value: string | null): value is BootCardReason {
  return value !== null && Object.prototype.hasOwnProperty.call(REASON_COPY, value);
}

export function BootCard() {
  const [params] = useSearchParams();
  const rawReason = params.get('reason');
  // Fail-fast surface: unknown reasons fall back to the generic copy and
  // are NOT silently coerced. The known-reason guard keeps the type-narrow
  // and prevents `?? defaultValue`-style coercion for arbitrary strings.
  const copy = isKnownReason(rawReason) ? REASON_COPY[rawReason] : GENERIC_COPY;

  return (
    <article className={styles.root} data-testid="boot-card">
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.body}>{copy.body}</p>
    </article>
  );
}
