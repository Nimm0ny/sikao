---
type: product
status: active
owner: lhr
last-reviewed: 2026-05-25
---

# Web Layout

> Web 布局规范的硬约束。优先级高于 `frontend-style-guide-v1` 的旧约束。
> 任何视觉/前端实现必须先读本文件，违规一律 fail-fast。

## 1. 一屏锁死（核心硬约束）

V5 入口 view 的标准行为是**严格一屏 + 内部局部滚**，不是整页自然撑高。

### 1.1 强制 ScreenLock 的 view（白名单）

下列入口 view 必须由 `<ScreenLockShell>` 包裹（详见 §3）：

- `/`（Home）
- `/profile/learning`（学习详情钻取）
- `/profile/records`（学习记录列表）
- `/practice`（练习中心）
- `/review`（复盘中心）
- `/note`（笔记中心）
- `/me`（账号中心）
- 任何 V5 D.4.* 设计系统中标记为 "入口 view" 的页面

### 1.2 允许整页滚的 view（钻取/长内容白名单）

仅以下场景允许整页滚动：

- 答题运行时：`/practice/sessions/:id`（ExamLayout 内部已有自己的滚动容器）
- 模考结果 / 报告：`/practice/sessions/:id/result`、`/practice/sessions/:id/grading`
- 富文本笔记编辑器
- Marketing / Auth / Onboarding（属于 RootLayout 之外）

### 1.3 ScreenLock 的 CSS 行为

```css
/* AppShell 父链统一锁死 */
html, body { height: 100%; overflow: hidden; }
.appShell  { height: 100dvh; overflow: hidden; }
.workspace { height: 100dvh; overflow: hidden; min-width: 0; }

/* 入口 view root（由 ScreenLockShell 注入） */
.screenLock {
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-rows: <按 view 自定义>;
  gap: var(--space-4);
  min-width: 0;
  min-height: 0;
}

/* 内部某一行才允许滚 */
.scrollRegion { min-height: 0; overflow: auto; }
```

`100dvh` 优先（移动端 URL bar 收缩友好），`100vh` 仅作为不支持 dvh 浏览器的回退。

### 1.4 view 行高比例（推荐 grid-template-rows）

按 V5 D.4.1 Home prototype 校准的标准比例（其它入口 view 同模式）：

- topbar / page-header：`auto`
- metric-row（KPI 卡组）：`auto`
- 主区（calendar / 主列表）：`minmax(0, 1.6fr)`
- 底栏 / 辅助卡组：`minmax(0, 1fr)`

## 2. 内容预算（次约束）

入口 view 在一屏内可容纳的内容上限：

- 卡片块数 `<= 6`（含 page-header / metric-row / 主区 / 底栏）
- 长列表（`> 20` 项）必须走独立钻取页，不在入口 view grid 铺
- 入口 view 只放 3 类内容：**下一步做什么 / 关键 metric / 跳转独立 list 入口**
- 答题 toolbar SVG-only（禁文字 label / emoji），主 CTA 例外

> 旧版"View 纵向预算 ≤2 屏"约束已废弃，被 §1 一屏锁死取代。

## 3. ScreenLockShell primitive

由 `apps/web/src/components/layout/ScreenLockShell` 提供。

```tsx
<ScreenLockShell rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)">
  <PageHeader ... />
  <section>...metric row...</section>
  <ScrollRegion>...calendar / main...</ScrollRegion>
  <section>...bottom row...</section>
</ScreenLockShell>
```

- `rows`：grid-template-rows，必填
- `gap`：默认 `var(--space-4)`，可覆写
- 内部 `<ScrollRegion>` 是约定 className，让 `lint-screen-lock.mjs` 识别"局部滚动是不是放对位置"

## 4. Lint 规则（强制门禁）

`apps/web/scripts/lint-screen-lock.mjs` 在 PR / pre-commit 时检查：

1. §1.1 白名单中的 view root `module.css` **不得**出现以下：
   - `min-height: 100vh`（应该用 ScreenLockShell + `height: 100dvh`）
   - 不带 `overflow: hidden` 的 `height: 100vh / 100dvh`
   - 没有 `min-height: 0` 的 grid 子项（会破 fr 单位）
2. §1.2 白名单中的 view 跳过检查
3. 未在两个白名单中的新 view，必须显式声明（在 view 顶部 css 注释加 `/* screen-lock: opt-out, reason: ... */`）

不通过的 PR 不得合并。

## 5. 跨 view 共享区域 owner 表

| 区域 | Owner Issue / Plan | 联动 issue 不得改 |
|---|---|---|
| `AppShell` 高度模型（一屏锁死父链） | `docs/plan/sik-fu-a-home-visual-contract.md` | 任何 view |
| 桌面 Rail 结构（4-tab + RailMe trigger/popover） | `docs/plan/sik-rail-v5-visual-contract.md` | 其它 view 不得回滚到 5-tab，也不得改 sidebar 结构；后续只允许补 Me 内容 |
| Home `bottomRow` 3 列分配（列宽 + overflow + 卡头收口） | SIK-143（`docs/plan/sik-143-home-bottomrow-density-visual-contract.md`，supersede SIK-127 的 `1.4/1.2/1fr`，lhr 2026-05-30 拍板 `minmax(0,1.4fr) minmax(0,1.4fr) minmax(0,1fr)`） | 其它 issue 不得改列定义；跨格改列需先更新本表 + 契约 |
| Home `bottomRow #1`（占第 1 格） | SIK-FU-A | SIK-91/92 不得改 |
| Home `bottomRow #2` Progress | SIK-91 | - |
| Home `bottomRow #3` Recommendation | SIK-92 | - |
| Home 底栏 4 卡列表滚动密度（今日推荐 ~3.2 行 / 最近练习 ~1.5 行 + 底部渐隐 + 隐藏滚动条） | SIK-143 | 其它 issue 不得改列表 `max-height` / `data-scrollable` fade 约定 |
| ProfileRecords timeline 视觉 | SIK-FU-C | - |
| ProfileLearning KPI / 知识树 / 热力图 | SIK-FU-B | - |

## 6. 状态

`active` — 本规范作为 H11 视觉契约 Define-First 的判定基准，对 Runner 强制生效。

## 7. 参考

- `docs/vault/04-design/Design-System.md`
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/engineering/visual-contract-workflow.md`
- `apps/web/src/components/layout/ScreenLockShell/`
- `apps/web/scripts/lint-screen-lock.mjs`
- 原型契约：`.tmp_review/out/Tab1-Home/Home v2.1.html`、
  `.tmp_review/out/Tab5-Profile/Profile Learning v1.html`、
  `.tmp_review/out/Tab5-Profile/Profile Records v1.html`
