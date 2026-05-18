---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-19
---

# 新前端规范落地计划

## 决策记录

2026-05-19 lhr 批准：新前端规范采用 **白 + 蓝为主，黑灰做点缀**。此前计划里“白 + 黑为主，蓝只做 accent”的理解不再作为本轮落地目标。

本次只调整颜色角色，其他设计约束保持不变：字号、圆角、间距、阴影、motion、SVG-only、文案 SSOT、View 纵向预算、Fail-Fast 和 TypeScript Strict 不借机改动。

## 颜色角色

新规则不是把所有文字改蓝，而是把原先黑色承担的“品牌 / 主行动 / 当前状态”角色交给蓝色；黑灰保留为阅读和结构层。

| 场景 | 新用色 |
| --- | --- |
| 页面底色 / 卡片底色 | 白色与浅冷灰：`paper-*` |
| 正文 / 题干 / 长阅读文本 | 黑灰：`ink-1` / `ink-2` |
| 辅助说明 / placeholder / disabled | 中灰：`ink-3` / `ink-4` |
| 主 CTA / primary button | 蓝色：`accent-1`，hover 用 `accent-2` |
| 当前选中 / active / on state | 蓝色或浅蓝底：`accent-1` / `accent-50` |
| 链接 / focus ring / 表单焦点 | 蓝色：`accent-1` / `accent-2` |
| 分割线 / 边框 | 冷灰：`line-*` |
| 语义状态 | `ok` / `warn` / `err` 只表达功能状态，不参与品牌主色 |

执行口径：原规范里使用 `ink-1` 做主按钮、强选中态、品牌实底的位置，改为蓝色；原规范里少量使用蓝色作为“唯一强调”的位置，若它不是主行动或当前状态，改成黑灰弱化。

## Token 目标

运行时 token 仍以 `packages/design-system/src/tokens.css` 为 SSOT。本计划先固化方向，后续实施 PR 再改 token 与组件。

```css
:root {
  --paper-1: #FFFFFF;
  --paper-2: #F7F9FC;
  --paper-3: #EEF2F7;

  --ink-1: #111827;
  --ink-2: #374151;
  --ink-3: #6B7280;
  --ink-4: #9CA3AF;

  --line-1: #E5E7EB;
  --line-2: #D1D5DB;
  --line-3: #CBD5E1;

  --accent-1: #2563EB;
  --accent-2: #1D4ED8;
  --accent-50: #EFF6FF;

  --ok: #15803D;
  --ok-50: #F0FDF4;
  --warn: #D97706;
  --warn-50: #FFFBEB;
  --err: #DC2626;
  --err-50: #FEF2F2;
}
```

兼容要求：项目历史还在消费 `--ok-bg` / `--warn-bg` / `--bad-bg`，实施时必须保留 alias，不得硬删。

```css
:root {
  --ok-bg: var(--ok-50);
  --warn-bg: var(--warn-50);
  --bad-bg: var(--err-50);
}
```

Dark mode 保持深蓝黑夜间模式，不做简单反相。蓝色仍是行动色，黑灰体系对应到蓝灰阅读层级。

## 组件映射

附件 HTML 是规范书，不是工程实现。落地路径必须是：

`HTML → docs 权威 → tokens.css → Tailwind 映射 → @sikao/ui primitives → lint scripts → view sweep`

组件层优先改 `@sikao/ui`，禁止把 HTML 样例复制进业务 view。

| 组件 | 落地规则 |
| --- | --- |
| `Button.primary` | 蓝色实底，作为全 view 唯一主 CTA |
| `Button.accent` | 不再代表旧版的唯一强调色；按需改为黑灰次级强调或并入 primary 语义 |
| `IconBtn.is-on` | 当前态用蓝色或浅蓝底，不再用 `ink-1` 实底 |
| `Chip.is-on` / tabs active | 当前态用蓝色，不再用黑色 underline / 黑色实底 |
| `Input:focus` / `Select:focus` | 保持蓝色 focus ring |
| `Toast` / `EmptyState` 装饰点 | 默认黑灰弱化，只有行动入口才用蓝 |

优先检查：

```text
packages/ui/src/ui/Button.tsx
packages/ui/src/ui/IconBtn.tsx
packages/ui/src/ui/Card.tsx
packages/ui/src/ui/EmptyState.tsx
packages/ui/src/ui/Toast.tsx
packages/ui/src/ui/Tab.tsx
packages/ui/src/ui/StatCard.tsx
packages/ui/src/ui/Chip.tsx
packages/ui/src/ui/Pill.tsx
packages/ui/src/ui/Modal.tsx
packages/ui/src/ui/Select.tsx
packages/ui/src/ui/Checkbox.tsx
packages/ui/src/ui/Radio.tsx
```

## 分阶段落地

## 当前状态

2026-05-19 已完成第一批落地：

- Phase 1 已完成：HTML 规范、运行时 token、Design-System、AGENTS/CLAUDE、Tailwind 映射已同步到蓝白主色。
- Phase 2 已先落通用 primitives 与首页营销入口：Button / IconBtn / Chip / Tabs 的 primary / active / selected 态已切到蓝色；营销页首屏 CTA、导航注册按钮、preview active tab、beta/pricing 主行动已切到蓝色。
- 2026-05-19 review 修正：答题提交按钮必须使用 `Button.primary`，`Button.accent` 只保留黑灰次级强调；marketing 根容器固定 `data-theme="pure"`，不继承全局 dark theme，首屏以浅色图二为准。
- Phase 2 剩余：全量业务 view sweep 尚未做，尤其 practice / essay / wrong-book / result 中仍可能有局部 `bg-ink` active pattern，需要按 Phase 4 顺序继续。

已验证：

- `npm run typecheck -w @sikao/web`
- `npm run build -w @sikao/web`
- `npm run test -w @sikao/web -- src/views/__tests__/Marketing.test.tsx`
- Browser MCP 默认态：DOM 断言 + 截图 `D:\mnt\d\py_pj\sikao\.codex\screenshots\blue-white-light-fixed.png`
- Browser MCP 全局 dark 防回归态：`html[data-theme=dark]` 时 marketing 仍由 `data-theme="pure"` 固定为浅色，DOM 断言 + 截图 `D:\mnt\d\py_pj\sikao\.codex\screenshots\blue-white-marketing-pure-under-dark.png`

已知验证例外：`npm run typecheck -w @sikao/ui` 仍失败，失败来自该 package 既有 tsconfig / test matcher 类型配置（rootDir 拉入 shared-utils/api-client、jest-dom matcher 未接入、CSS module 类型缺失），不是本次颜色变更引入。

### Phase 1：规范入库与 token 生效

1. 用附件 `new_design.html` 替换 `docs/vault/04-design/Frontend Style Guide.html`。
2. 修改 `packages/design-system/src/tokens.css` 为白蓝主色 token。
3. 同步 `docs/vault/04-design/Design-System.md`。
4. 同步 `AGENTS.md` / `CLAUDE.md` 中关于 brand / accent 的文字，保持镜像一致。
5. 修改 `apps/web/tailwind.config.js`：补 `packages/ui` content 与 semantic `50` 映射。
6. 验证：`npm run typecheck -w @sikao/web`、`npm run build -w @sikao/web`。

### Phase 2：组件对齐

1. 对齐 Button / IconBtn / Card / EmptyState / Toast / Tabs / StatCard。
2. 补齐附件新增 icons，统一落到 `packages/ui/src/icons/`。
3. 用 `@sikao/ui` primitives 替换业务 view 里散落的按钮、空态、toast、chip。
4. 检查 dark mode 下蓝色行动态与文本对比度。

### Phase 3：规则上锁

1. 新增或补齐 `lint:radius-token`。
2. 新增或补齐 `lint:hardcode`。
3. 新增或补齐 `lint:ui-copy-ssot`。
4. 新增或补齐 `lint:no-emoji-as-icon`。
5. 新增或补齐 `lint:practice-svg-only`。
6. 接入 `apps/web/package.json` 的 `lint`。

### Phase 4：View sweep

按风险从低到高推进：

1. 首页 / dashboard
2. 行测 practice
3. 申论 essay
4. 错题本 wrong-book
5. notes / AI / result
6. auth / profile / settings

每个 view sweep 只做颜色角色替换和必要 primitive 收敛，不做布局重设计。

## 验收

每个涉及视觉改造的 phase 必须走 Browser MCP 两轮验收：

1. 默认态：DOM 断言 + 截图。
2. 边缘态：empty / error / dark mode / selected state 至少一个，DOM 断言 + 截图。

当前 agent 是 Codex 时，默认使用 Chrome DevTools MCP；无 browser MCP 必须 fail-fast 报告，只有 lhr 明确授权时才降级为 Playwright / browser smoke。

文本验证：

```bash
cmp -s AGENTS.md CLAUDE.md
rg "ink[-]first|唯[一]蓝|primary[[:space:]]*=[[:space:]]*ink|accent[[:space:]]*=[[:space:]]*蓝|#2A56[C]8|#FAF7[E]F|#1A17[1]4|#C68A3[E]|琥[珀]" \
  AGENTS.md CLAUDE.md docs/vault/04-design packages/design-system/src/tokens.css apps/web/tailwind.config.js
rg "#2563EB|Chrome DevTools|browser MCP" \
  docs/plan/frontend-style-guide-v1-migration.md AGENTS.md CLAUDE.md docs/vault/04-design packages/design-system/src/tokens.css apps/web/tailwind.config.js
```

本计划建档时不修改运行时 token；运行时变更必须在后续 phase 单独提交。
