/** @type {import('tailwindcss').Config} */
// Tokens are declared as CSS variables in `src/styles/tokens.css`.
// Tailwind utility classes below consume those vars via `var(--*)`, so
// re-theming means editing tokens.css (or overriding the vars at runtime).
//
// Frontend Style Guide v1 (2026-05-12, lhr 拍板, 完全按规范走不许创新):
//   - paper.1/2/3, ink.1/2/3/4, line.1/2/3, accent.1/2/50, ok/warn/err 新命名
//   - borderRadius: 1 (2px), tiny (4px), 2 (6px), card (10px), card-lg (14px), pill (999px)
//   - fontSize: display/h1/h2/h3/body/small/meta/tiny 走 var(--t-*) (规范 8 档)
//                + xs/sm/base/md/lg/xl/2xl..5xl 走 var(--fs-*) (legacy px 阶梯)
//   - boxShadow: card / pop
//
// PR2 (2026-05-12) — 删除 PR1 alias 层:
//   - 删除 borderRadius.{xs/sm/md/lg/xl/btn/chip} (alias→已 grep-replace 到新名)
//   - 删除 boxShadow.{1/2/3/hero} (alias→已 grep-replace 到 card/pop)
//   - 删除 fontSize.eyebrow (alias→已 grep-replace 到 tiny)
//   - 删除 colors.{brand, success, danger, muted, placeholder, paper.deep,
//          ink.muted, line.strong, surface} (legacy 已 grep-replace 到新命名)
//
// 规范本体: docs/design/Frontend Style Guide.html
// Plan:    docs/plan/frontend-style-guide-v1-migration.md PR2.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // SIKAO Phase 2a (2026-05-09): 1366 collapse 阈值. 13" macbook 是大量
      // 在职用户主屏 (round 2 master 决策, sikao-xingce-decision §1366 适配).
      // ≤1366 时 .scratch-col 塌成 sticky 32px 窄条, ≥1367 才双栏 1.5fr/1fr.
      // 不污染默认 lg/xl/2xl breakpoint, 用独立 `xl-laptop` key.
      screens: {
        'xl-laptop': '1367px',
      },
      colors: {
        // ── Frontend Style Guide v1 (primary palette) ─────────────────
        paper: {
          DEFAULT: 'var(--paper-1)',
          1: 'var(--paper-1)',
          2: 'var(--paper-2)',
          3: 'var(--paper-3)',
        },
        ink: {
          DEFAULT: 'var(--ink-1)',
          1: 'var(--ink-1)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
        line: {
          DEFAULT: 'var(--line-2)',
          1: 'var(--line-1)',
          2: 'var(--line-2)',
          3: 'var(--line-3)',
        },
        accent: {
          DEFAULT: 'var(--accent-1)',
          1: 'var(--accent-1)',
          2: 'var(--accent-2)',
          50: 'var(--accent-50)',
        },
        ok: {
          DEFAULT: 'var(--ok)',
          bg: 'var(--ok-bg)',
        },
        warn: {
          DEFAULT: 'var(--warn)',
          bg: 'var(--warn-bg)',
        },
        err: {
          DEFAULT: 'var(--err)',
        },
        // ── semantic surface tints (跟 err 配对的 background) ─────────
        bad: {
          bg: 'var(--bad-bg)',
        },
        // exam-accent (朱红 #B42318): 答题"当前题/做题状态"信号色, 跟 err
        // (错误语义) 解耦. lhr 2026-05-11 批准.
        'exam-accent': {
          DEFAULT: 'var(--exam-accent)',
          50: 'var(--exam-accent-50)',
        },
        // data-* (6 档色阶, 浅纸 → 深海军 accent): heatmap / density viz 专用.
        // lhr 2026-05-12 批准.
        'data-0': 'var(--data-0)',
        'data-1': 'var(--data-1)',
        'data-2': 'var(--data-2)',
        'data-3': 'var(--data-3)',
        'data-4': 'var(--data-4)',
        'data-5': 'var(--data-5)',
        // Sidebar 内部专属调色 (frontend AppShell 仍是 dark sidebar).
        // 暴露成 `text-sidebar-fg` / `border-sidebar-line` / `bg-sidebar-hover` 等。
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          fg: 'var(--sidebar-fg)',
          'fg-muted': 'var(--sidebar-fg-muted)',
          'fg-dim': 'var(--sidebar-fg-dim)',
          line: 'var(--sidebar-line)',
          hover: 'var(--sidebar-hover)',
        },
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
        mono: 'var(--font-mono)',
      },
      // Frontend Style Guide v1 — 规范字号 (display / h1 / h2 / h3 / body / small / meta / tiny)
      // 走 var(--t-*), 跟 tokens.css 字符级对齐.
      // legacy utility (xs/sm/base/md/lg/xl/2xl..5xl + h-card/h-section/h-mkt) 走 var(--fs-*)
      // 历史 px 阶梯, 跟新 t-* 8 档轴并存. PR4 起转移消费侧到 t-*.
      fontSize: {
        // 规范命名
        display: ['var(--t-display)', { lineHeight: '1.1',            letterSpacing: 'var(--tracking-tight)' }],
        h1:      ['var(--t-h1)',      { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-tight)' }],
        h2:      ['var(--t-h2)',      { lineHeight: 'var(--lh-snug)',  letterSpacing: 'var(--tracking-tight)' }],
        h3:      ['var(--t-h3)',      { lineHeight: 'var(--lh-snug)'   }],
        body:    ['var(--t-body)',    { lineHeight: 'var(--lh-normal)' }],
        small:   ['var(--t-small)',   { lineHeight: 'var(--lh-normal)' }],
        meta:    ['var(--t-meta)',    { lineHeight: 'var(--lh-normal)' }],
        tiny:    ['var(--t-tiny)',    { lineHeight: 'var(--lh-snug)'   }],
        // legacy utility (text-xs..text-5xl) — 走 fs-* px 阶梯, 200+ view 仍在用.
        xs:   ['var(--fs-xs)',   { lineHeight: 'var(--lh-normal)' }],
        sm:   ['var(--fs-sm)',   { lineHeight: 'var(--lh-normal)' }],
        base: ['var(--fs-base)', { lineHeight: 'var(--lh-normal)' }],
        md:   ['var(--fs-md)',   { lineHeight: 'var(--lh-snug)'   }],
        lg:   ['var(--fs-lg)',   { lineHeight: 'var(--lh-snug)'   }],
        xl:   ['var(--fs-xl)',   { lineHeight: 'var(--lh-snug)'   }],
        '2xl':['var(--fs-2xl)',  { lineHeight: 'var(--lh-snug)',  letterSpacing: 'var(--tracking-tight)' }],
        '3xl':['var(--fs-3xl)',  { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-tight)' }],
        '4xl':['var(--fs-4xl)',  { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-tight)' }],
        '5xl':['var(--fs-5xl)',  { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-tight)' }],
        // marketing landing 语义命名 (跟 fs-h-* 配对)
        'h-card':   ['var(--fs-h-card)',    { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-tight)' }],
        'h-section':['var(--fs-h-section)', { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-tight)' }],
        'h-mkt':    ['var(--fs-h-mkt)',     { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-tight)' }],
      },
      // Frontend Style Guide v1 — 规范 radius (1 / tiny / 2 / card / card-lg / pill).
      // 走 var(--r-*), 跟 tokens.css 字符级对齐.
      borderRadius: {
        1: 'var(--r-1)',
        tiny: 'var(--r-tiny)',
        2: 'var(--r-2)',
        card: 'var(--r-card)',
        'card-lg': 'var(--r-card-lg)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop:  'var(--shadow-pop)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        slow: 'var(--motion-slow)',
      },
      transitionTimingFunction: {
        motion: 'var(--motion-ease)',
      },
      // Phase 5.7 — iOS / 安卓底部 home indicator 的 safe-area。MobileTabBar
      // 用 `pb-safe`，AppShell `<main>` 用 `pb-tabbar` 给 fixed tab-bar 让位。
      spacing: {
        safe: 'env(safe-area-inset-bottom, 0px)',
        tabbar: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      },
      // eyebrow / mono caption tracking 阶梯。 30+ 文件历史用 tracking-[0.NNem]
      // 任意值，本 token 让后续 fixer 批量替换 → tracking-eyebrow / wide / wider / widest。
      letterSpacing: {
        loose: 'var(--tracking-loose)',
        eyebrow: 'var(--tracking-eyebrow)',
        wide: 'var(--tracking-wide)',
        wider: 'var(--tracking-wider)',
        widest: 'var(--tracking-widest)',
      },
    },
  },
  plugins: [],
}
