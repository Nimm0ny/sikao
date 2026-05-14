import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@sikao/shared-utils';
import { MOTION_DURATION, MOTION_SPRING_SOFT, VIEW_FADE_VARIANTS } from '@sikao/shared-utils';
import { LogoMark } from '@sikao/ui/brand/LogoMark';
import { OfflineBanner } from '@/layouts/OfflineBanner';
import { TweaksDrawer } from '@sikao/ui/ui/TweaksDrawer';
import { IconBtn } from '@sikao/ui/ui/IconBtn';
import {
  NoteIcon,
  SubjectHomeIcon,
  SubjectPlanIcon,
  SubjectWrongbookIcon,
  ToolSettingsIcon,
  type IconProps,
} from '@sikao/ui/icons';
import { useTweaks } from '@sikao/shared-utils/hooks/useTweaks';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';

/**
 * DesktopShell — desktop / tablet-landscape layout skeleton (PR7, 2026-05-13).
 *
 * 历史: 原 AppShell.tsx 单一 shell (pre-PR7) 拆出 — 由 PR7 device-aware AppShell
 * dispatch (frontend/src/layouts/AppShell.tsx) 在 useDevice() === 'desktop' 或
 * tablet-landscape 时挂. mobile / tablet-portrait 走对应 shell.
 *
 * 改动 vs 原 AppShell:
 *   - 删 MobileTabBar 引用 (mobile 走 MobileShell + TabBar 不再桌面兜底)
 *   - export 名 AppShell → DesktopShell (Outlet 渲染契约不变)
 *
 * Sidebar v3 (Block H, 2026-05-08): 行测试炼 + 申论试炼 嵌套分组.
 * 在 v2 平铺基础上把"专项练习 / 申论真题"重组成 group, 每组 2 子项
 * (专项 / 套卷). 路由零变更 — 只改 sidebar 视觉与导航语义.
 *
 * Brand v2「静读 Quiet Read」PR0 (2026-05-08):
 *   - sidebar bg: deep ink (`--surface-sidebar` #020617) → paper-tint warm 22%
 *     (color-mix oklch 派生, design 静读-E-flomo风.html `.sb-side` 同款公式).
 *   - sidebar 文字: 白色系 → ink 系 (text-ink / ink-muted / muted / placeholder).
 *   - active item: bg-sidebar-hover (slate-800 反衬白字) → bg-ink-1 (深底反衬白字,
 *     light 模式 brand=ink black, dark 模式 brand=blue-500 自动主题切换).
 *   - LogoMark variant on-dark → on-light (浅底 sidebar 显示 dark logo).
 *   - 不引入新 token --paper-tint 避三处 SSOT 改动 (CLAUDE.md §4); 后续 PR1+ 全
 *     app 多处用 paper-tint 才考虑 token 化.
 *
 * Brand v2「静读」PR1 (2026-05-08):
 *   - main bg: bg-surface (纯白冷) → paper-tint warm 22% (复用 PAPER_TINT_BG 同款
 *     color-mix oklch 公式). 跟 sidebar 形成 paper-on-paper 隐喻, 不再纯白冷感.
 *     影响所有 view (Home / Dashboard / Profile / WrongBook / Papers / EssayPapers
 *     / Result / 等) 主体 bg, view-level layout 不动. Card 默认 bg-surface 白底
 *     在 paper-tint 上**浮起**形成对比层 (规范 §2.1 面积权重: paper-tint 50% 大块
 *     + bg 卡 22% 浮起).
 *
 * 设计稿: design/sidebar-redesign-2026-05-08.html (v3 嵌套分组结构) + design/静
 * 读-E-flomo风.html (v2 paper-tint 配色).
 *
 * Scope notes:
 *   - Layout-level component, not a dumb UI primitive: 订阅 router context
 *     (useLocation) 是允许的；components/ui/* 维持 dumb（frontend/CLAUDE.md §2.2）。
 *   - /health 绑在本壳外（router/index.tsx），让探针返回干净 JSON。
 *   - Sidebar 旧 `--sidebar-*` token 保留 (其他历史代码仍引用), 但本 shell 内部
 *     改走通用 token (--bg-alt / --line / --ink / --ink-muted) 让 paper-tint 主导.
 */

type GroupSlug = 'xingce' | 'essay';
type SidebarIconComponent = ComponentType<IconProps>;

/** Top-level link (no nested children). */
interface NavLinkEntry {
  readonly kind: 'link';
  readonly slug: string;
  readonly label: string;
  /** Inline-SVG icon component, sized 18x18, currentColor stroke. */
  readonly icon: SidebarIconComponent;
  readonly to: string;
  readonly testId: string;
  readonly match: (pathname: string, hash: string) => boolean;
}

/** Group with nested children (行测试炼 / 申论试炼). */
interface NavGroupEntry {
  readonly kind: 'group';
  readonly slug: GroupSlug;
  readonly label: string;
  /** Inline-SVG icon component, sized 14×14, currentColor stroke. */
  readonly icon: 'subject-xingce' | 'subject-essay';
  readonly children: readonly NavChildEntry[];
}

/** Group child: link or disabled placeholder ("敬请期待"). */
interface NavChildEntry {
  readonly slug: string;
  readonly label: string;
  readonly to: string | null; // null = disabled
  readonly testId: string;
  readonly match: (pathname: string, hash: string) => boolean;
  /** Override "active" detection (rare; e.g. /app#paper-list 区分行测套卷 vs 首页). */
  readonly disabledHint?: string;
}

type NavEntry = NavLinkEntry | NavGroupEntry;

/**
 * Sidebar v3 nav 结构 — 行测试炼 + 申论试炼 嵌套分组.
 *
 * 路由策略 (D1, 详见 design/sidebar-redesign-2026-05-08.html):
 *   - 首页 → /app (学习中心整合 hub)
 *   - 行测·专项练习 → /xingce/specialty (Wave 5c IA cleanup, 跟 /essay/specialty
 *     对称; /categories 老路径由 router Navigate redirect 兼容老书签)
 *   - 行测·套卷练习 → /papers (9view-audit batch 3 独立 view, 替代旧
 *     /app#paper-list anchor; batch 4 删 Home §9 完整列表)
 *   - 申论·专项练习 → /essay/specialty (Phase D 跨卷单题)
 *   - 申论·套卷练习 → /essay/papers (745 套申论真题)
 *   - 错题本 / 学情数据 / 考试日历 平铺 (复盘组)
 */
const NAV_ENTRIES: readonly NavEntry[] = [
  {
    kind: 'link',
    slug: 'home',
    label: '首页',
    icon: SubjectHomeIcon,
    // SIKAO Wave 1 (2026-05-11, IA 拍板 #1): 首页链改 /dashboard (Dashboard
    // SIKAO 02 hifi 接管学习中心入口). /app 由 router redirect /dashboard,
    // 老书签 / 外链自动 follow. match 仍接受 /app / / 让历史路径 active 兼容.
    to: '/dashboard',
    testId: 'nav-home',
    // brief 显式约定: match (p) => p === '/dashboard' || p === '/'. 仍兼容
    // /app (router 已 redirect /dashboard, 此处仅守门极端冷启动 path snapshot).
    match: (p) => p === '/dashboard' || p === '/' || p === '/app',
  },
  {
    kind: 'group',
    slug: 'xingce',
    label: '行测练习',
    icon: 'subject-xingce',
    children: [
      // PR16 (2026-05-13): 入口收编进 /practice/center hub. nav `to` 直接指向
      // 新 canonical /practice/center/xingce/{categories|papers}; 旧路径
      // (/xingce/specialty, /categories, /papers) 由 router 层 redirect 兜底,
      // sidebar match 同时认 5 条路径保留 active 高亮.
      {
        slug: 'xingce-specialty',
        label: '专项练习',
        to: '/practice/center/xingce/categories',
        testId: 'nav-xingce-specialty',
        match: (p) =>
          p.startsWith('/practice/center/xingce/categories') ||
          p.startsWith('/xingce/specialty') ||
          p.startsWith('/categories'),
      },
      {
        slug: 'xingce-papers',
        label: '套卷练习',
        to: '/practice/center/xingce/papers',
        testId: 'nav-xingce-papers',
        match: (p) =>
          p.startsWith('/practice/center/xingce/papers') || p === '/papers',
      },
    ],
  },
  {
    kind: 'group',
    slug: 'essay',
    label: '申论练习',
    icon: 'subject-essay',
    children: [
      // PR16 (2026-05-13): 跟行测对称, 收编进 /practice/center/essay/{categories|papers}.
      // 旧 /essay/specialty / /essay/categories / /essay/papers 全 redirect 兜底.
      {
        slug: 'essay-specialty',
        label: '专项练习',
        to: '/practice/center/essay/categories',
        testId: 'nav-essay-specialty',
        match: (p) =>
          p.startsWith('/practice/center/essay/categories') ||
          p.startsWith('/essay/specialty') ||
          p.startsWith('/essay/categories'),
      },
      {
        slug: 'essay-papers',
        label: '套卷练习',
        to: '/practice/center/essay/papers',
        testId: 'nav-essay-papers',
        match: (p) =>
          p.startsWith('/practice/center/essay/papers') ||
          p.startsWith('/essay/papers'),
      },
    ],
  },
  {
    kind: 'link',
    slug: 'wrong-book',
    label: '错题本',
    icon: SubjectWrongbookIcon,
    to: '/wrong-book',
    testId: 'nav-wrong-book',
    match: (p) => p.startsWith('/wrong-book'),
  },
  // SIKAO Wave 4 Phase 2D (2026-05-12): 笔记本 nav 入口. 在复盘组下, 跟错题
  // 本平级. /notes (主页) + /notes/:noteId (编辑器) 都走 active. 集成入口
  // (xingce-exam / essay) 推 Phase 5.
  {
    kind: 'link',
    slug: 'notes',
    label: '我的笔记',
    icon: NoteIcon,
    to: '/notes',
    testId: 'nav-notes',
    match: (p) => p.startsWith('/notes'),
  },
  // Wave 1 Round 2 (2026-05-11): 删 'dashboard' nav entry. IA #1 立意 sidebar
  // home → /dashboard (学习中心), 独立"学情数据"nav 跟首页落点重叠 = redundant.
  // /dashboard 路由仍保留 (sidebar home logo + /app redirect 均落到该路由).
  {
    kind: 'link',
    slug: 'calendar',
    label: '考试日历',
    icon: SubjectPlanIcon,
    to: '/calendar',
    testId: 'nav-calendar',
    match: (p) => p.startsWith('/calendar'),
  },
] as const;

/** 主练习 / 复盘 二段分组 — 把 NAV_ENTRIES 拆两半渲染. 边界靠 'wrong-book' slug. */
const REVIEW_FIRST_SLUG = 'wrong-book';

export function DesktopShell() {
  const { pathname } = useLocation();
  // SIKAO Phase 1' (2026-05-09): tweaks drawer 顶层挂载, sidebar 触发.
  // useTweaks() 在 layout 顶层调用一次, 让 mount 后第一帧把 localStorage
  // 偏好写到 <html data-*> attribute (即使用户没打开 drawer 也生效).
  const [tweaksOpen, setTweaksOpen] = useState(false);
  useTweaks();
  return (
    <div className="flex min-h-screen text-ink" style={PAPER_TINT_BG}>
      <Sidebar onOpenTweaks={() => setTweaksOpen(true)} />
      <TweaksDrawer open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
      <main
        className="flex-1 min-w-0 flex flex-col"
        // Brand v2 PR1: main bg → paper-tint warm 22% (复用 sidebar 同款 const).
        // root <div> 也带 PAPER_TINT_BG 防 main flex shrink 后右侧 gap 露白.
        style={PAPER_TINT_BG}
      >
        <OfflineBanner />
        {/* Phase 4.2 — route-level fade. `mode="wait"` prevents double-mount
           during transitions. pathname 作 key 让每次路由切换触发 enter/exit。 */}
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={VIEW_FADE_VARIANTS.initial}
              animate={VIEW_FADE_VARIANTS.animate}
              exit={VIEW_FADE_VARIANTS.exit}
              transition={{ duration: MOTION_DURATION.base }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Brand v2 paper-tint inline bg (PR0)
 * ──────────────────────────────────────────────────────────────────────────
 *
 * paper-tint 暖米白 = `--bg-alt` (slate-50 #f8fafc) 78% + 暖锚点 oklch(0.97 0.012
 * 80) 22% 的 oklch 混合. design 静读-E-flomo风.html 同款公式 (line 37).
 *
 * 不引入 --paper-tint token 避三处 SSOT (CLAUDE.md §4) 改动; 单 sidebar inline
 * 接受. 后续 PR1+ main bg 也用 paper-tint 时再提升为 token.
 *
 * Browser support: color-mix(in oklch) 在 Chrome 111+ / Firefox 113+ / Safari
 * 16.4+ 全部生效, 生产用户 99%+ 覆盖. 不支持的浏览器 fallback 到 var(--paper-2)
 * (CSS 解析失败回退到上一级 background, 这里是 var(--paper-1) 白底), 视觉降级可接受.
 *
 * Dark mode: --bg-alt 在 dark 下 = #0f172a (slate-900), color-mix 输出偏暗灰带
 * 微弱暖移. 验证记录见 docs/plan/g-plan-pr0-2026-05-08.md §3.
 */
const PAPER_TINT_BG: CSSProperties = {
  background: 'color-mix(in oklch, var(--paper-2) 78%, oklch(0.97 0.012 80) 22%)',
};

/* ──────────────────────────────────────────────────────────────────────────
 * Group collapse persistence
 * ────────────────────────────────────────────────────────────────────────── */

const COLLAPSE_STORAGE_KEY = 'sikao.sidebar.collapsedGroups';

function readCollapsed(): readonly GroupSlug[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
  if (raw === null) return [];
  // Fail-fast 软化: 解析失败回退空数组而非 throw — sidebar 视觉降级 (默认全展开)
  // 比 layout crash 体验更好. 解析失败的概率只在 user 手改 storage 才发生.
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is GroupSlug => s === 'xingce' || s === 'essay',
    );
  } catch {
    return [];
  }
}

function writeCollapsed(slugs: readonly GroupSlug[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(slugs));
}

function useCollapsedGroups(): {
  readonly isCollapsed: (slug: GroupSlug) => boolean;
  readonly toggle: (slug: GroupSlug) => void;
} {
  const [collapsed, setCollapsed] = useState<readonly GroupSlug[]>(() =>
    readCollapsed(),
  );

  const isCollapsed = useCallback(
    (slug: GroupSlug) => collapsed.includes(slug),
    [collapsed],
  );

  const toggle = useCallback((slug: GroupSlug) => {
    setCollapsed((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug];
      writeCollapsed(next);
      return next;
    });
  }, []);

  // Cross-tab 同步 — 用户在 tab A 折了 group, tab B 应该感知.
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== COLLAPSE_STORAGE_KEY) return;
      setCollapsed(readCollapsed());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { isCollapsed, toggle };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sidebar
 * ────────────────────────────────────────────────────────────────────────── */

interface SidebarProps {
  readonly onOpenTweaks: () => void;
}

function Sidebar({ onOpenTweaks }: SidebarProps) {
  const { pathname, hash } = useLocation();
  const { isCollapsed, toggle } = useCollapsedGroups();

  // Sidebar 父级**纯静态** <aside>, 不挂 framer-motion (v2 决策保留, 详见
  // 旧版本 inline 注释). 入场感由 brand mount + NavLink active layoutId 承担.
  const mainEntries = NAV_ENTRIES.slice(
    0,
    NAV_ENTRIES.findIndex((e) => e.kind === 'link' && e.slug === REVIEW_FIRST_SLUG),
  );
  const reviewEntries = NAV_ENTRIES.slice(mainEntries.length);

  return (
    <aside
      // Brand v2 PR0: bg-sidebar deep ink → paper-tint warm 22% inline (见 PAPER_TINT_BG).
      // text 默认色 ink-muted; border 走通用 line; sidebar fix-* token 仅个别处保留.
      className="hidden md:flex md:flex-col w-60 shrink-0 sticky top-0 h-screen text-ink-3 border-r border-line"
      style={PAPER_TINT_BG}
      aria-label="主导航"
      data-testid="app-sidebar"
    >
      <SidebarBrand onOpenTweaks={onOpenTweaks} />
      <nav
        className="p-2 flex-1 flex flex-col gap-3 overflow-y-auto"
        aria-label="侧边导航"
      >
        <NavSection label="主练习">
          {mainEntries.map((entry) => (
            <NavEntryRow
              key={entry.kind === 'link' ? entry.slug : `group-${entry.slug}`}
              entry={entry}
              pathname={pathname}
              hash={hash}
              isCollapsed={isCollapsed}
              onToggleGroup={toggle}
            />
          ))}
        </NavSection>
        <NavSection label="复盘">
          {reviewEntries.map((entry) => (
            <NavEntryRow
              key={entry.kind === 'link' ? entry.slug : `group-${entry.slug}`}
              entry={entry}
              pathname={pathname}
              hash={hash}
              isCollapsed={isCollapsed}
              onToggleGroup={toggle}
            />
          ))}
        </NavSection>
      </nav>
      <SidebarIdentity />
    </aside>
  );
}

interface NavSectionProps {
  readonly label: string;
  readonly children: ReactNode;
}

function NavSection({ label, children }: NavSectionProps) {
  return (
    <div>
      <SideLabel>{label}</SideLabel>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SideLabel({ children }: { readonly children: ReactNode }) {
  // text-tiny = 11px + letter-spacing 0.08em (tokens.css). 中文不能大写
  // 但 letter-spacing 给分组带"刻度感"。抄 design/home-redesign.html .side-label.
  // Brand v2 PR0: text-sidebar-fg-dim (slate-500) → text-ink-4 (slate-400),
  // 浅底 sidebar 配淡 ink-tint label 不抢焦.
  return (
    <div className="px-3 mb-2 uppercase font-semibold text-tiny text-ink-4">
      {children}
    </div>
  );
}

interface SidebarBrandProps {
  readonly onOpenTweaks: () => void;
}

function SidebarBrand({ onOpenTweaks }: SidebarBrandProps) {
  return (
    <div className="px-5 py-4 border-b border-line flex items-center gap-3">
      {/* Brand v2 PR0: sidebar 改 paper-tint 浅底, LogoMark 走 on-light variant
          (黑底白字, 强对比). LogoMark 内部已渲染 "思" 单字 (font-serif font-bold,
          不带 italic — CJK 禁 italic 铁律).
          设计规范 §1.4 品牌 Logo. mount 时一次性 scale 0.9 → 1.0 + fade 给开场感. */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: MOTION_DURATION.base, ease: 'easeOut', delay: 0.05 }}
      >
        <LogoMark size={32} variant="on-light" />
      </motion.div>
      <motion.div
        className="min-w-0 flex-1"
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: MOTION_DURATION.base, ease: 'easeOut', delay: 0.1 }}
      >
        <div className="text-ink font-semibold leading-tight text-sm">思考</div>
        <div className="text-tiny text-ink-3 tracking-loose">SIKAO · 公考备考</div>
      </motion.div>
      {/* SIKAO Phase 2 (2026-05-09): unicode "⚙" placeholder 已替换为 ToolSettingsIcon
          (gear / sun-rays). 走 currentColor + 1.4 stroke, ink-first SSOT.
          shrink-0 防 LogoMark + 文案膨胀挤掉触点. */}
      <IconBtn
        aria-label="阅读偏好"
        onClick={onOpenTweaks}
        data-testid="sidebar-tweaks-trigger"
        className="shrink-0"
      >
        <ToolSettingsIcon size={18} />
      </IconBtn>
    </div>
  );
}

function SidebarIdentity() {
  const user = useAuthStore((s) => s.user);
  // Phase 5.6b — user 取自 auth store（LoginResponseV2.user）。登录前
  // RedirectGuard 会挡在外面，这里 user 理论上非空；做 ?? 兜底避免 null crash。
  const displayName = user?.displayName ?? user?.username ?? '未登录';
  const avatarChar = displayName.charAt(0).toUpperCase();
  // 副标显示备考目标（设计稿："2026 国考 · 行测主攻"）。后端补 user.targetExam
  // 字段前用 username 兜底, 不写死. 调性: 备考同伴感, 不是 dev artifact.
  const subtitle = user?.username ?? '匿名';

  return (
    <div className="p-3 border-t border-line">
      <NavLink
        to="/profile"
        className={({ isActive }) =>
          cn(
            'rounded-tiny px-3 py-3 flex items-center gap-3 transition-colors duration-fast',
            // Brand v2 PR0: paper-tint 浅底, hover/active bg 改 surface-alt (略深底)
            // 替代旧 sidebar-hover (slate-800).
            isActive ? 'bg-surface-alt' : 'hover:bg-surface-alt',
          )
        }
        aria-label="进入个人中心"
        data-testid="sidebar-identity"
      >
        {/* Brand v2 PR0: avatar 改 brand 反衬白字 (浅底强对比锚点, brand 自动主题
            切换 — light=ink black, dark=blue-500 仍可读), 替代旧的 surface 白底黑
            字 (旧 sidebar 深底语义). */}
        <div
          className="w-7 h-7 rounded-pill bg-ink-1 text-white font-bold flex items-center justify-center text-xs"
          aria-hidden="true"
        >
          {avatarChar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ink text-sm font-semibold truncate">{displayName}</div>
          <div className="text-tiny text-ink-3 truncate">{subtitle}</div>
        </div>
      </NavLink>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Nav primitives
 * ────────────────────────────────────────────────────────────────────────── */

// text-sm (13px, --fs-sm) 比原 text-sm (旧默认 14px) 经 tokens.css 已收敛到
// 设计稿 .shell-side nav a 一致值. py-2 (8px) 比原 py-3 (12px) 紧凑. gap-3
// (12px) 是 nav item icon-text 标准. active 用 layoutId motion.div 平滑滑动
// (替代旧 3px 蓝竖条 indicator), 不再硬切 bg.
const NAV_BASE =
  'relative flex items-center gap-3 w-full px-3 py-2 rounded-tiny text-sm transition-colors duration-fast';

interface NavEntryRowProps {
  readonly entry: NavEntry;
  readonly pathname: string;
  readonly hash: string;
  readonly isCollapsed: (slug: GroupSlug) => boolean;
  readonly onToggleGroup: (slug: GroupSlug) => void;
}

function NavEntryRow({
  entry,
  pathname,
  hash,
  isCollapsed,
  onToggleGroup,
}: NavEntryRowProps) {
  if (entry.kind === 'link') {
    return <SidebarNavItem entry={entry} active={entry.match(pathname, hash)} />;
  }
  return (
    <SidebarNavGroup
      entry={entry}
      pathname={pathname}
      hash={hash}
      collapsed={isCollapsed(entry.slug)}
      onToggle={() => onToggleGroup(entry.slug)}
    />
  );
}

interface SidebarNavItemProps {
  readonly entry: NavLinkEntry;
  readonly active: boolean;
}

function SidebarNavItem({ entry, active }: SidebarNavItemProps) {
  const EntryIcon = entry.icon;

  // Brand v2 PR0: active 反衬 ink 黑底白字 (浅底强对比锚点), 替代旧 deep-sidebar
  // 内的 sidebar-hover (slate-800) bg + text-white. inactive 走 ink-muted (浅
  // 底淡 ink), hover 提到 ink (深一档).
  const stateCls = active
    ? 'text-white font-semibold'
    : 'text-ink-3 hover:text-ink font-medium';

  return (
    <motion.div
      whileHover={{ x: 2 }}
      transition={{ duration: MOTION_DURATION.fast, ease: 'easeOut' }}
    >
      <NavLink
        to={entry.to}
        end
        data-testid={entry.testId}
        className={cn(NAV_BASE, stateCls)}
      >
        {/* layoutId 让 active bg 块在 nav 间平滑滑动, 不硬切. Brand v2 PR0:
            active bg 改 brand (深底反衬白字, light=ink/dark=blue 自动主题), 浅底强
            对比锚点. */}
        {active ? (
          <motion.span
            layoutId="sidebar-active-bg"
            className="absolute inset-0 bg-ink-1 rounded-tiny"
            transition={MOTION_SPRING_SOFT}
            aria-hidden="true"
          />
        ) : null}
        <span
          aria-hidden="true"
          className="relative inline-flex w-[18px] h-[18px] items-center justify-center text-base leading-none shrink-0"
        >
          <EntryIcon size={18} />
        </span>
        <span className="relative truncate">{entry.label}</span>
      </NavLink>
    </motion.div>
  );
}

interface SidebarNavGroupProps {
  readonly entry: NavGroupEntry;
  readonly pathname: string;
  readonly hash: string;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

function SidebarNavGroup({
  entry,
  pathname,
  hash,
  collapsed,
  onToggle,
}: SidebarNavGroupProps) {
  const childActive = entry.children.some((c) => c.match(pathname, hash));
  // 任一子项 active 时强制展开 — 用户回到该路由时不应见到折叠态丢失上下文.
  // 这是"显示真相"原则; 用户的 collapse 偏好以 active=false 时为准.
  const effectivelyCollapsed = collapsed && !childActive;
  const groupId = `sidebar-group-${entry.slug}`;

  return (
    <div data-testid={`nav-group-${entry.slug}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!effectivelyCollapsed}
        aria-controls={groupId}
        data-testid={`nav-group-${entry.slug}-toggle`}
        className={cn(
          NAV_BASE,
          // Brand v2 PR0: text 浅底配 ink-muted (淡 ink), hover 升 ink (深 100%).
          'text-ink-3 hover:text-ink font-medium',
          'cursor-pointer text-left',
        )}
      >
        <span
          aria-hidden="true"
          className="relative inline-flex w-[18px] h-[18px] items-center justify-center shrink-0"
        >
          <GroupIcon name={entry.icon} />
        </span>
        <span className="relative truncate flex-1">{entry.label}</span>
        <ChevronDown
          className={cn(
            'relative w-3.5 h-3.5 opacity-60 transition-transform duration-fast',
            effectivelyCollapsed ? '-rotate-90' : 'rotate-0',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {!effectivelyCollapsed ? (
          <motion.div
            key="children"
            id={groupId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION_DURATION.fast, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pl-3 pt-1 space-y-1">
              {entry.children.map((child) => (
                <SidebarNavChild
                  key={child.slug}
                  child={child}
                  active={child.match(pathname, hash)}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

interface SidebarNavChildProps {
  readonly child: NavChildEntry;
  readonly active: boolean;
}

function SidebarNavChild({ child, active }: SidebarNavChildProps) {
  // 子项字号 text-xs (12px), 比主项 text-sm (13px) 小一档形成层级.
  // 间距走 8px 阶梯整数 step (px-3 / py-2). 圆角 chip (8px) 跟主项 NAV_BASE 对齐.
  const childCls = cn(
    'relative flex items-center gap-2 w-full px-3 py-2 rounded-tiny text-xs transition-colors duration-fast',
  );
  // Brand v2 PR0: dot 跟 active 反衬 (active 子项 bg-ink-1, dot 用白; inactive
  // 子项 浅底, dot 用 placeholder 淡 ink).
  const dotCls = cn(
    'w-1 h-1 rounded-pill shrink-0',
    active ? 'bg-white' : 'bg-ink-4',
  );

  if (child.to === null) {
    // Disabled placeholder ("敬请期待"). span 不是 a — 防 keyboard tab 误入.
    const hint = child.disabledHint ?? '敬请期待';
    return (
      <span
        aria-disabled="true"
        aria-label={`${child.label}: ${hint}`}
        data-testid={child.testId}
        className={cn(childCls, 'text-ink-4 cursor-not-allowed')}
      >
        <span aria-hidden="true" className={dotCls} />
        <span className="truncate">{child.label}</span>
        <span className="ml-auto text-tiny tracking-wider px-2 py-1 rounded-pill bg-surface-alt text-ink-3">
          {hint}
        </span>
      </span>
    );
  }

  // Brand v2 PR0: active 子项反衬 brand 黑/蓝底白字 (跟主项 active 同款 — light
  // 模式 brand=ink black, dark 模式 brand=blue-500 自动主题切换). inactive 走
  // ink-muted/hover-ink (浅底层级).
  const stateCls = active
    ? 'text-white font-semibold bg-ink-1'
    : 'text-ink-3 hover:text-ink hover:bg-surface-alt font-medium';

  return (
    <NavLink
      to={child.to}
      end
      data-testid={child.testId}
      className={cn(childCls, stateCls)}
    >
      <span aria-hidden="true" className={dotCls} />
      <span className="truncate">{child.label}</span>
    </NavLink>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Inline SVG icons (group / chevron)
 * ────────────────────────────────────────────────────────────────────────── */

function GroupIcon({ name }: { readonly name: NavGroupEntry['icon'] }) {
  if (name === 'subject-xingce') {
    // 行测=三横线表格 (题表格语义)
    return (
      <svg
        viewBox="0 0 18 18"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 4h12M3 9h12M3 14h8" />
      </svg>
    );
  }
  // subject-essay: 文档 + 横线 (申论=作文卷面语义)
  return (
    <svg
      viewBox="0 0 18 18"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3h6l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M11 3v3h3" />
      <path d="M7 9h4M7 12h4" />
    </svg>
  );
}

function ChevronDown({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
