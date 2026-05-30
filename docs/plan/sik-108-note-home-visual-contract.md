---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-31
issue: SIK-108
parent-issue: SIK-120
supersedes-design: SIK-108 旧 3-segment 设计 / SIK-44-M8 (Cancelled)
merges: "Practice/Note 双线并发前置 P1-P7 的 P1 (Note visual contract)"
prototype:
  - .tmp_review/out/Tab4-Notes/Note v2.1.html
baseline-screenshots: .tmp_review/visual-diff/sik-108/
---

# SIK-108 · Note 主视图 视觉契约（H11）

> 按 `Note v2.1.html` 原型 100% 还原 Note 入口主视图（笔记墙）：4 纸色便签 +
> 连续 tilt + 回形针 + 泛黄 + 三视图（墙 / 摞 / 列表）+ 来源/状态筛选 +
> quick detail / quick create 的全 Modal 交互。
>
> 本契约同时承载「Practice/Note 双线并发前置 P1-P7」中的 **P1（落 Note
> visual contract）**，并 supersede SIK-108 issue body 旧的 3-segment 设计。

## 0. Scope 总览

### 0.1 修复 / 还原对象

- `apps/web/src/views/Note/Note.tsx` + `Note.module.css`（当前是 V5-M3.5
  占位骨架，全白卡 + 离散 tilt + 单视图，需重写为原型墙视图）
- `apps/web/src/views/Note/sections/**`（新建：卡片 / 三视图 / 筛选 / modal）
- `apps/web/src/views/Note/<visuals>.ts`（新建：tilt / pin 纯函数）
- `packages/design-system/src/tokens.css`（新增 Note 专属 component token 组）
- 字体资产：`--font-family-handwriting` + LXGW WenKai 自托管分包

### 0.2 不在本契约 scope（归属其它 issue）

- 富文本深度编辑器（TipTap）→ **SIK-109**（脱壳 NoteEditor 全屏路由）
- Meilisearch 即时搜索页 → **SIK-110**
- AI summary / weekly / community → **SIK-111**
- 路由注册 + 4-tab nav 接线 + queries → **SIK-107**
- 后端 `NoteV2.type` 4 值枚举扩展 → **H6 Define-First plan**
  `docs/plan/sik-108-note-type-enum-define-first.md`（本轮同时产出）

### 0.3 owner 声明

- 本契约 + Note 入口 view 纵向 grid + 卡片密度 + 三视图 + 筛选 + quick
  modal + Note 专属 token 组，由 SIK-108 收口。
- AppShell 一屏锁死父链复用 SIK-FU-A 既有成果，本契约不改。
- Rail 结构复用 SIK-121 冻结的 4-tab，本契约不改（原型 Rail 不参考，见 §6）。

## 1. Layout Topology

### 1.1 一屏行为

入口 view，必须 `ScreenLockShell` 包裹（Web-Layout §1.1 白名单 `/note`）。
原型 `html,body{height:100vh;overflow:hidden;display:flex}`（原型行 92-100）→
`<ScreenLockShell>`；只有 notes-grid 所在的 body 行局部滚（`<ScrollRegion>`）。

### 1.2 view root 网格

原型 `.workspace`（Note v2.1 行 206-216）：
`display:flex; flex-direction:column; gap:14px; padding:20px 28px; overflow:hidden`，
其中 topbar / filter-bar / sub-bar 为 `auto`，workspace-body `flex:1; min-height:0; overflow:auto`。

V5 实现用 4 行 grid（与 flex column 等价、且 lint-screen-lock 友好）：

```tsx
<ScreenLockShell rows="auto auto auto minmax(0, 1fr)" testId="note-view">
  <PageHeader title="笔记" ... />        {/* topbar 行 */}
  <FilterBar />                          {/* 来源 chip + 状态 toggle */}
  <SubBar />                             {/* count + 三视图 toggle */}
  <ScrollRegion><NotesCanvas /></ScrollRegion> {/* 墙 / 摞 / 列表 */}
</ScreenLockShell>
```

- gap：原型 14px → `var(--space-4)`（16px，ScreenLockShell 默认）。差 2px
  视觉等价，登记于 §5 drift。
- workspace padding：原型 `20px 28px` → 由 ScreenLockShell + Workspace 既有
  padding 接管，不在 view 内硬写。

### 1.3 子区域 owner（本 issue 内 wave 切分）

| 区块 | 行 | owner wave |
|---|---|---|
| PageHeader（标题 + count + 搜索 icon + 新建 CTA） | topbar | W2 |
| FilterBar（5 来源 chip + 2 状态 toggle） | 行2 | W3 |
| SubBar（count + 墙/摞/列表 toggle） | 行3 | W4 |
| NotesCanvas wall（便签墙） | body | W2 |
| NotesCanvas stack（摞分组） | body | W4 |
| NotesCanvas list（列表） | body | W4 |
| quick detail / create Modal | overlay | W5 |
| Note token 组 + 字体 | tokens.css | W1 |

## 2. Required Interactive Elements

逐块按原型列必须存在的控件。`defer to SIK-XXX` = 本 issue 不实现但占位。

### 2.1 PageHeader（topbar，原型行 841-851）

| 元素 | 位置 | 行为 | 必须？ |
|---|---|---|---|
| h2「笔记」+ count「N 篇」 | 左 | count = notes.length，tabular-nums | 必须 |
| 搜索 icon-btn | 右 | 跳 `/note/search`（占位，实现 defer SIK-110） | 必须（占位） |
| 「新建」primary btn（+icon） | 右 | 打开 quick create Modal（§2.5） | 必须 |

### 2.2 FilterBar（原型行 855-875）

来源 chip（**互斥单选**，role=tablist）：

| chip | data-source | 行为 |
|---|---|---|
| 全部 | all | 清来源过滤 |
| 自由 | free | 过滤 type=free |
| 题级 | question | 过滤 type=question |
| 知识点 | knowledge | 过滤 type=knowledge |
| 错题反思 | review | 过滤 type=review |

状态 toggle（**可叠加多选**，aria-pressed，靠右 margin-left:auto）：

| toggle | data-state | 行为 |
|---|---|---|
| 仅看收藏（star icon） | starred | 只显 starred=true，激活态金色 |
| 仅看泛黄（clock icon） | aged | 只显 isAged（>30 天未动） |

> 注意：现有骨架的「近 7 天」toggle 是错的，必须改回原型的「仅看泛黄」。

### 2.3 SubBar（原型行 877-902）

| 元素 | 位置 | 行为 |
|---|---|---|
| count「N 篇」 | 左 | 过滤后可见数 |
| view-toggle 墙/摞/列表 | 右 | 切 view-mode，写 useNotePreferenceStore；pill 容器内 3 段 |

### 2.4 便签卡 sticky（墙视图，原型 renderCard 行 1094+）

| 元素 | 位置 | 行为 | 必须？ |
|---|---|---|---|
| 回形针 pin（SVG） | 卡顶随机位/角 | 纯装饰 aria-hidden | 必须 |
| hover actions：收藏 star | 右上，hover 显 | toggleStar | 必须 |
| hover actions：撕下 del | 右上，hover 显 | deleteNote + toast undo | 必须 |
| 标题 h3（≤2 行 clamp） | 上 | — | 必须 |
| 正文 body（手写体，≤3 行 clamp） | 中 | — | 必须 |
| 来源 ftag + 相对时间 meta | footer | — | 必须 |
| starred 常显指示 | 收藏时 star 常亮 | 非 hover 也显 star | 必须 |

### 2.5 quick detail / create Modal（全 Modal，§4 SSOT 冲突）

| 触发 | Modal | 内容 |
|---|---|---|
| 点卡片 body | detail Modal（只读，原型 `#detailModal` 行 951+） | tag + 时间 + 标题 + 正文 + 编辑/完成 |
| 点「新建」/ detail 内「编辑」 | create/edit Modal（原型 `#modal` 行 905+） | 标题 input + 正文 textarea + 分类 select + 纸色 swatch ×4 + 保存/取消 |

> 深度富文本编辑（TipTap）= **SIK-109 脱壳 NoteEditor**，不在本 Modal；
> 本 Modal 仅承载原型的 quick read + quick create/edit 短表单。

### 2.6 删除交互（原型 deleteNote）

- 通用删除：卡片飞落动画 + toast「已撕下 · {标题}」+ 撤销。
- 错题反思（type=review）删除：飞入 Rail「复盘」tab 动画 + toast「已飞入复盘」。
  - 视觉还原本 issue 做；**飞入复盘的真实归档数据语义 defer**（待复盘 lane 对接）。
  - Rail「复盘」锚点用稳定 `data-fly-target`，不耦合 Rail 内部 DOM（H12 友好）。

## 3. Information Density

### 3.1 便签卡（墙视图）信息块

每张卡 6 视觉块：回形针 pin + (hover) star/del actions + 标题 + 正文 +
来源 ftag + 时间 meta。视觉编码：

- **纸色 = type**（4 色，§4.4 token）：free→amber / question→blue /
  knowledge→jade / review→rose（对齐原型 SOURCE_TO_COLOR）。
- **左 4px accent rail**：颜色 = 纸色 border 通道。
- **正文手写体**：`--font-family-handwriting`（LXGW WenKai）。
- **泛黄**：`isAged`（>30 天未更新）→ sepia filter + 角落渐变 overlay。
- **tilt**：连续随机 ±2°（§3.3）。

### 3.2 三视图差异

- **墙 wall**：flex-wrap，固定卡宽 240px，gap = `--note-wall-gap`，各卡 tilt。
- **摞 stack**：按 type 分组，每组叠 3 张（tilt 错位），hover 扇形展开 +
  右下角标「{label} · N」。
- **列表 list**：单列行，左 4px accent，无 tilt，紧凑。

### 3.3 tilt / pin 纯函数（确定性，可单测）

原型 `noteVisuals(id)`（行 1013+）用 `Math.sin(seed)` 伪随机。还原为纯函数
`noteVisuals.ts`（输入 note id → 稳定输出），契约：

```ts
function noteVisuals(id: number): {
  tilt: number;   // ±2.00 deg，连续
  pinX: number;   // 12..92 px
  pinY: number;   // -10..-4 px
  pinRot: number; // ±25 deg
}
```

- 同一 id 多次调用结果必须一致（回归可验）。
- 写入 DOM 用 inline CSS custom property（`style={{'--note-tilt': ...}}`），
  **不是硬编码 color/shadow/spacing**，不触 lint-hardcode 家族。
- hover 复位到 0°（`--note-tilt-hover`）。

### 3.4 四状态

| 状态 | 表现 |
|---|---|
| loading | Skeleton 便签 ×6（保留 tilt 骨架） |
| empty | EmptyState「没有符合条件的笔记」+ 新建 CTA（原型 render empty 分支 1226+） |
| error | inline ErrorCard + retry |
| ready | 真实笔记渲染 |

## 4. Token Map

引用 `docs/vault/04-design/Prototype-Token-Map.md`。本 issue 复用 + 新增。

### 4.1 复用既有映射（原型 var → V5 token）

| 原型 | V5 token |
|---|---|
| `--paper-1` | `--color-bg-surface` |
| `--paper-2` | `--color-bg-elevated` |
| `--paper-3` | `--color-bg-sunken` |
| `--ink-1` | `--color-text-primary` |
| `--ink-2` | `--color-text-secondary` |
| `--ink-3` | `--color-text-meta` |
| `--ink-3-soft` | `--color-text-meta-soft` |
| `--line-1/2/3` | `--color-border-subtle/default/strong` |
| `--brand-yellow` | `--color-brand-primary` |
| `--brand-yellow-soft` | `--color-brand-soft` |
| `--err / --err-50` | `--color-state-err / -soft` |
| `--shadow-1/2/pop` | `--shadow-l1/l2/l3` |
| `--r-card`(18) | `--card-radius`(16) — V5 已下调 |
| `--r-card-sm`(14) | `--card-radius-sm`(12) |
| `--r-pill` | `--radius-999` |
| `--sp-3/4/5` | `--space-3/4/5` |
| `--t-*` | `--font-*` |
| `--z-modal/toast` | `--z-modal/toast` |
| `height:100vh+overflow:hidden` | `<ScreenLockShell>` |
| `DM Sans`（外链） | `--font-family-ui`（自托管） |

### 4.2 新增 Note 专属 component token（tokens.css 新增 §10）

原型用了一批 V5 没有的 note 专属视觉资产，必须先收编为 component token，
**禁止把原型 var / hex / color-mix 直接写进 view 代码**（H11 红线）。

```
原型                              →  新增 V5 token
--note-jade / -jade-bd            →  --note-paper-knowledge / -border
--note-blue / -blue-bd            →  --note-paper-question / -border
--note-amber / -amber-bd          →  --note-paper-free / -border
--note-rose / -rose-bd            →  --note-paper-review / -border
.sticky.tag-* .body 文字色(4 hex) →  --note-paper-{type}-text
--aged-tint                       →  --note-aged-tint
--aged-edge                       →  --note-aged-edge
sticky box-shadow(字面量)          →  --note-sticky-shadow-rest / -hover
.sticky width:240px               →  --note-card-w
.notes-grid gap:22px              →  --note-wall-gap
LXGW WenKai TC（外链）             →  --font-family-handwriting（自托管分包）
```

### 4.3 Note token 组定义草案（W1 落 tokens.css §10）

```css
/* ── §10 Note view tokens — SIK-108 ──────────────────────────────── */
:root {
  /* §10.1 paper colors — type-encoded. 4 type × 3 channel.
   * light values mirror prototype --note-* (rebased into V5 token system). */
  --note-paper-free:          #F8EDC2;  /* amber  — 自由 */
  --note-paper-free-border:   #D9BB6A;
  --note-paper-free-text:     #4A3C12;
  --note-paper-question:      #DCE6F4;  /* blue   — 题级 */
  --note-paper-question-border:#94B4D9;
  --note-paper-question-text: #1A325C;
  --note-paper-knowledge:     #DCEBE0;  /* jade   — 知识点 */
  --note-paper-knowledge-border:#9BC4A8;
  --note-paper-knowledge-text:#1A4332;
  --note-paper-review:        #F4D8D8;  /* rose   — 错题反思 */
  --note-paper-review-border: #D89797;
  --note-paper-review-text:   #5C2424;

  /* §10.2 aged paper overlay (>30d untouched) */
  --note-aged-tint: rgba(196, 145, 64, .14);
  --note-aged-edge: rgba(110, 80, 30, .20);

  /* §10.3 sticky bespoke shadow (Design-System §B Phase5+ pin 兑现) */
  --note-sticky-shadow-rest:
    0 1px 0 rgba(255,255,255,.6) inset, 0 12px 28px -10px rgba(26,29,32,.10);
  --note-sticky-shadow-hover:
    0 1px 0 rgba(255,255,255,.6) inset, 0 22px 42px -14px rgba(26,29,32,.16);

  /* §10.4 layout constants */
  --note-card-w:   240px;
  --note-wall-gap: var(--space-5);  /* 24px ≈ 原型 22px，登记 drift */
}
```

> dark 主题必须同步覆盖 §10.1 / §10.2 / §10.3。W1 一并落
> `[data-v5-theme='dark']` 区块。dark 取值裁决（lhr 2026-05-31）：
>
> - **paper bg / border**：用原型 dark 段值（jade `#1F2D27`/bd`#356957` /
>   blue `#1F262F`/bd`#3A506E` / amber `#2F2A1A`/bd`#73611F` /
>   rose `#2E1F22`/bd`#724444`）。
> - **paper text（dark）**：全部 = `var(--color-text-secondary)`，**不新立 hex**。
>   依据：原型 dark 下 `.body` 本就吃 `--ink-2`=text-secondary；深色低饱和纸块上
>   统一浅灰文字对比度足够且更干净。
> - **aged（dark）**：tint `rgba(255,200,110,.10)` / edge `rgba(255,200,110,.22)`
>   （原型 dark 段值）。
> - **sticky shadow（dark）**：`-rest: var(--shadow-l1)` / `-hover: var(--shadow-l2)`，
>   **不自造加深 alpha**。依据：`--shadow-l1/l2` dark 段已有 vetted 深色曲线，
>   rest=静置(l1)/hover=抬起(l2) 语义对位。
> - **layout（§10.4）**：theme-stable，dark 不重声明。

### 4.4 type → 纸色映射（前端 SSOT，与后端枚举对齐）

```
type=free      → --note-paper-free      (amber)
type=question  → --note-paper-question  (blue)
type=knowledge → --note-paper-knowledge (jade)
type=review    → --note-paper-review    (rose)
```

依赖后端 `NoteV2.type` 4 值枚举落地（见
`docs/plan/sik-108-note-type-enum-define-first.md`）。前端先建 label/color
映射层；若后端枚举未就绪，knowledge/review 数据为空但视觉/筛选已就位。

### 4.5 字体方案（LXGW WenKai 自托管分包）

- 复用 tokens.css 既有 DM Sans 的 `@font-face` + `unicode-range` 分包模式。
- 新增 `--font-family-handwriting: 'LXGW WenKai', <CJK fallback>, serif`。
- 字体资产放 `/__design-system-fonts/`，按 unicode-range 切片，浏览器按需拉。
- `font-display: swap`；满足 lint-external-font-hosts（无外链）+
  lint-font-family-token（走 token）。
- 仅笔记正文（body）+ detail Modal 正文用手写体；标题 / UI 仍 `--font-family-ui`。
- **新依赖**：LXGW WenKai webfont 资产，lhr 2026-05-31 已确认接受（§4.4 规则）。
- **来源包**：`@fontsource/lxgw-wenkai`（OFL-1.1，lhr 2026-05-31 确认）。
- **license（OFL-1.1 合规义务，非成本）**：随字体附 `OFL.txt` 进
  `packages/design-system/src/fonts/` + README 注明 license。OFL 允许免费商用 /
  自托管 / 嵌入；唯禁拿原字体名单独售卖字体本体（不涉及）。
- **字形版本**：用**简体 GB 版 `LXGW WenKai`**，非原型首选的 `LXGW WenKai TC`
  （繁体）。面向简体备考产品更合理。与原型一处偏离，登记于 §6 drift。

## 5. SSOT Conflicts

| # | 冲突 | 原型 authority | 系统 authority | 当前裁决 + lhr 拍板 |
|---|---|---|---|---|
| C1 | 详情/编辑容器 | Note v2.1：detail + new 都是居中 **Modal** | Design-System §35-component 硬规则 4：「Note detail MUST use Drawer, NOT Modal」+ 现有测试 `Note view does NOT render any Modal` | **采用原型：全 Modal**。lhr 2026-05-31 明确批准推翻硬规则 4（H1 override）。详见 §5.1。 |
| C2 | type 枚举 | 原型 4 来源（free/question/knowledge/review） | 后端 `NoteV2.type` 现仅 free/question_level（sik-47） | **扩后端为 4 值**（H6 Define-First，`sik-108-note-type-enum-define-first.md`）。lhr 2026-05-31 同意。 |
| C3 | wall gap | 原型 22px | V5 间距阶无 22 | **立 `--note-wall-gap` = `--space-5`(24)**。lhr 2026-05-31：含 token，不用裸值。 |
| C4 | 卡圆角 | 原型 `--r-card` 18px | V5 `--card-radius` 16px | 用 16px（V5 已校准下调），登记 drift（视觉等价）。 |
| C5 | Rail 结构 | 原型 5-tab（含题库） | H12 冻结 4-tab + RailMe | **原型 Rail 不参考**，用生产 4-tab。lhr 2026-05-31 明确。 |
| C6 | 删除语义 | 原型直接撕下 + toast undo（软删观感） | Design-System 硬规则 7：删除笔记走 ConfirmDialog destructive | **采用原型软删 + undo**（视为可逆软删，非 destructive 硬删）。归 §5.1 override 一并裁。 |

### 5.1 H1 Override 记录（lhr 2026-05-31）

推翻两条 Design-System 硬规则，理由与边界：

1. **硬规则 4（Note detail 必须 Drawer）→ 改为全 Modal**
   - 理由：SIK-108 的 detail/create 是 **quick read + 短表单**（标题/正文/分类/
     纸色），非富文本编辑；Modal 640px 足够，且原型 1:1 还原需要居中 Modal 的
     "便签从墙上拿起" 观感。
   - 边界：富文本深度编辑仍归 **SIK-109 脱壳全屏 NoteEditor**（既不是 Modal 也
     不是 Drawer），硬规则 4 关于"富文本不挤进窄容器"的初衷由 SIK-109 满足。
   - 后续动作：W1 同步更新 Design-System §35-component 硬规则 4 文案为
     「Note **quick** detail = Modal；Note **富文本编辑** = 脱壳全屏 NoteEditor」，
     并改/删现有 `Note view does NOT render any Modal` 测试。
2. **硬规则 7（删除笔记必须 ConfirmDialog destructive）→ 软删 + toast undo**
   - 理由：原型删除是可逆软删（5s 内 undo 恢复），不是不可逆 destructive；
     ConfirmDialog 会打断"撕便签"的轻量手感。
   - 边界：仅"撕下笔记"这一可逆软删例外；真正不可逆的批量清除/注销等仍走
     ConfirmDialog destructive。
   - 后续动作：W1 在 Design-System 硬规则 7 补一条「可逆软删 + undo 可豁免
     ConfirmDialog」例外说明 + `docs/engineering/fail-fast-exceptions.md` 不涉及
     （非 fail-fast，是交互例外，记在 Design-System）。

## 6. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| Rail 导航 | 5-tab（首页/练习/复盘/笔记/题库） | 生产 4-tab + RailMe | H12 冻结 nav baseline；原型 Rail 是早期草案，明确不参考 | 2026-05-31 |
| wall gap | 22px | `--note-wall-gap`=24px | V5 无 22 阶，立 token 取 24，视觉等价 | 2026-05-31 |
| 卡圆角 | 18px | 16px | V5 `--card-radius` 已校准 | 2026-05-31 |
| view root | flex column gap14 | grid 4 行 gap16 | 等价布局，lint-screen-lock 友好 | no drift（等价） |
| 详情容器 | Modal | Modal | 与原型一致（已 override 硬规则4） | no drift |
| 字体外链 | Google Fonts CDN | 自托管分包 | 运行时禁外链 | no drift（同款字体） |
| 手写体字形版本 | `LXGW WenKai TC`（繁体） | `LXGW WenKai`（简体 GB 版） | 面向简体备考产品，简体字形更合理 | 2026-05-31 |

## 7. Acceptance Hooks

Reviewer 逐行打勾。原型行号基于 `.tmp_review/out/Tab4-Notes/Note v2.1.html`。

| # | 项 | 原型行号 | 实现位置 | 状态 |
|---|---|---|---|---|
| A1 | ScreenLockShell 4 行 grid，一屏锁死无整页滚 | `.workspace` 206+ / `html,body` 92 | `Note.tsx` | ☐ |
| A2 | 4 纸色绑 type + 左 4px accent | `.sticky.tag-*` + `::before`（css 段） | token §10.1 + `sticky` css | ☐ |
| A3 | 连续 tilt ±2° + hover 复位（纯函数） | `noteVisuals` 1013+ | `noteVisuals.ts` + inline custom prop | ☐ |
| A4 | 回形针 pin（随机位/角 + drop-shadow） | `renderCard` 1094+（pin slot） | `StickyNote` pin slot | ☐ |
| A5 | 手写体正文（LXGW WenKai 自托管） | `.sticky .body`（css 段） | token §4.5 + css | ☐ |
| A6 | 泛黄 aged（>30d, sepia + overlay） | `isAged` + `.is-aged`（css 段） | `isAged()` + css | ☐ |
| A7 | hover actions 收藏/撕下 + starred 常显 | `renderCard` actions 1094+ | `StickyNote` actions | ☐ |
| A8 | 来源 chip 互斥 5 项 + 状态 toggle 收藏/泛黄 | `.filter-bar` 855+ | `FilterBar` | ☐ |
| A9 | 三视图 墙/摞/列表 切换 + 偏好持久 | `#viewToggle` 877+ | `SubBar` + `useNotePreferenceStore` | ☐ |
| A10 | 摞 stack 分组叠放 + hover 扇形 + 角标 | `renderStackView`（js 段） | `StackView` | ☐ |
| A11 | 列表 list 单列 + 左 accent | `renderListView`（js 段） | `ListView` | ☐ |
| A12 | quick detail Modal（只读） | `#detailModal` 951+ | `NoteDetailModal` | ☐ |
| A13 | quick create/edit Modal + 纸色 swatch | `#modal` 905+ | `NoteFormModal` | ☐ |
| A14 | 删除 toast + undo（软删） | `deleteNote` / `toast`（js 段） | `Note.tsx` + ToastProvider | ☐ |
| A15 | 错题反思飞入复盘动画（视觉，数据 defer） | `flyOut` keyframes（css 段） | `flyToReview` + Rail 锚点 | ☐ |
| A16 | 4 状态（loading/empty/error/ready） | `.empty-state` + render empty 分支 | `Note.tsx` | ☐ |
| A17 | dark 主题 token 覆盖正确 | `:root[data-theme="dark"]` 43-70 | token §10 dark | ☐ |
| A18 | lint-screen-lock + 9 lint-* PASS | n/a | 命令行 | ☐ |

### 7.1 Chrome MCP 双开 diff 归档

`.tmp_review/visual-diff/sik-108/`，原型基线已截（本契约定稿时归档）：

- `prototype-wall-1440x900.png` / `prototype-wall-1920x1080.png`
- `prototype-stack-1440x900.png` / `prototype-list-1440x900.png`
- `prototype-detail-modal-1440x900.png` / `prototype-new-modal-1440x900.png`
- `prototype-aged-1920x1080.png` / `prototype-dark-1920x1080.png`

实现完成后每张对应补 `implementation-*` 双开 diff（desktop 1440 + 1920 双档必须）。

### 7.2 a11y

`vitest-axe` 0 violation：FilterBar tablist 语义、Modal focus-trap、便签卡
`role=article` + aria-label、pin `aria-hidden`、icon-btn aria-label。

## 8. Wave Plan

每 wave ≤15 文件 / ≤400 净增（H9）。大文件写入切块每块 <100 行（含 subagent）。

- **W1 Token + 字体**：tokens.css §10（light+dark）+ `--font-family-handwriting`
  + LXGW WenKai 自托管分包资产 + Design-System 硬规则 4/7 文案更新。
- **W2 Wall 视图**：`Note.tsx` 重写 + `StickyNote` + `noteVisuals.ts`（tilt/pin
  纯函数 + 单测）+ 纸色/accent/手写体/aged + PageHeader。
- **W3 FilterBar**：5 来源 chip 互斥 + 收藏/泛黄 toggle + 过滤逻辑（修正现有
  「近 7 天」错误）。
- **W4 三视图 + SubBar**：墙/摞/列表 + `useNotePreferenceStore` + StackView 扇形
  + ListView。
- **W5 Modal 交互**：detail Modal + create/edit Modal + swatch + 删除 toast undo
  + 飞入复盘动画（视觉）。
- **W6 验收**：4 状态 + a11y + Chrome MCP 1440/1920 双开 diff + 全 lint + review。

## 9. 参考

- `docs/vault/04-design/Design-System.md`（§35-component 硬规则 4/7 待 W1 更新）
- `docs/vault/04-design/Web-Layout.md` §1-3
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/engineering/visual-contract-workflow.md`
- `docs/plan/sik-108-note-type-enum-define-first.md`（后端 type 枚举 H6）
- `docs/plan/sik-fu-a-home-visual-contract.md`（AppShell 一屏锁死父链复用）
- 原型：`.tmp_review/out/Tab4-Notes/Note v2.1.html`
- 基线截图：`.tmp_review/visual-diff/sik-108/`
