---
type: implementation-draft
status: draft
owner: lhr
drafted-by: runner (前置起草)
issue: SIK-108
wave: W1
last-reviewed: 2026-05-31
inputs:
  - docs/plan/sik-108-note-home-visual-contract.md   # §4 Token Map / §4.3 / §4.5 真相源
  - packages/design-system/src/tokens.css            # @font-face + token 分区写法
  - apps/web/src/dev/designSystemFontHost.ts          # 字体 host 机制
  - .tmp_review/out/Tab4-Notes/Note v2.1.html         # 原型 light/dark var 值
prototype: .tmp_review/out/Tab4-Notes/Note v2.1.html
---

# SIK-108 · W1 落地实现方案草案（Note token 组 + 手写体字体）

> 本文是 **方案草案（draft）**，不是最终实现。不改 tokens.css、不下载字体、不写
> 生产代码。所有结论基于实际读到的文件；读不到的项明确标 `待确认`。最终落地以
> 本草案经 lhr 拍板后的版本为准。
>
> 真相源：视觉契约 `sik-108-note-home-visual-contract.md` §4.2 / §4.3 / §4.5。

## 0. 定位与已核实事实

### 0.1 本草案覆盖

- **A. Note token 组**：tokens.css 新增 §10（light + dark）。
- **B. 字体**：`--font-family-handwriting` token + LXGW WenKai 自托管分包方案。
- **C. 落地与验证**：W1 文件改动清单、commit 拆分、验证命令、Design-System 文档关系。

### 0.2 已读文件 + 核实到的事实（SSOT）

1. `packages/design-system/src/tokens.css`（852 行）
   - 顶部有 3 组自托管 `@font-face`：DM Sans / Inter（各 latin + latin-ext 两片）
     + JetBrains Mono（latin 一片），全部 `font-display: swap` +
     `src: url('/__design-system-fonts/<file>.woff2') format('woff2')` +
     显式 `unicode-range`。**这是 LXGW 要照抄的模式。**
   - 三层架构（CP.2 不变量）：§1 primitive（raw 值，app 不直接用）/ §2-§3 semantic
     （light 默认 + dark override）/ §4 component（app 默认消费层，引用 primitive/semantic）。
   - 既有 component 分区先例：§8 calendar chip、§9 calendar peek，均 `:root {...}`
     light + `[data-v5-theme='dark'],[data-theme='dark'],[data-theme='night'] {...}` dark。
   - **关键先例**：§1.6 shadow 是 primitive，却在 dark 段被 override，注释明确写
     "token NAME 不变，只变 rgba alpha，CP.2 允许"。这是 §10 paper 色 dark 覆盖的
     架构依据（见 A.4）。
   - §10 应追加在文件末尾（当前 852 行止于 §9 dark 块）。
2. `apps/web/src/dev/designSystemFontHost.ts`
   - 物理目录：`packages/design-system/src/fonts/`（`getDesignSystemFontRoot`）。
   - URL 前缀：`/__design-system-fonts/`；**只服务 `.woff2`**（`CONTENT_TYPES` 仅此一项，
     `resolveDesignSystemFontFile` 显式校验扩展名 + 防目录穿越）。
   - `listDesignSystemFonts` 把目录下所有 `.woff2` 收集供 build 产出。新增 woff2 落入
     该目录即被自动纳管，host 代码无需改。
3. `packages/design-system/src/fonts/` 现有命名规范：
   `dm-sans-latin-variable.woff2` / `dm-sans-latin-ext-variable.woff2` /
   `inter-latin-variable.woff2` / `inter-latin-ext-variable.woff2` /
   `jetbrains-mono-latin.woff2`。规则：`<family-kebab>-<subset>[-variable].woff2`。
4. `apps/web/src/index.css`：`@import "@sikao/design-system/tokens.css";` —— tokens.css
   是唯一全局 token 面，§10 落进去即随之生效，**index.css 无需改**。
5. `apps/web/src/dev/designSystemFontHost.test.ts`：node 环境，断言 root 计算、合法
   woff2 解析、目录穿越拒绝、`listDesignSystemFonts` 含 dm-sans。详见 C.4。

### 0.3 已读 lint 脚本 + 命中风险预判

| 脚本 | 扫描范围 | 检查内容 | 对 W1 的影响 |
|---|---|---|---|
| `lint-external-font-hosts.mjs` | apps/*/src+public+index.html + **packages/design-system/src** | 禁 `fonts.googleapis/gstatic` + 禁 `src: url(https://...)` | §10 字体必须自托管 `/__design-system-fonts/`，**不可外链**。照抄 DM Sans 模式天然 PASS。 |
| `lint-font-family-token.mjs` | **仅 apps/*/src**（不含 packages） | app 代码 `font-family`/`fontFamily`/`font:` 只允许 `var(--font-family-ui\|ui-secondary\|mono)` 或 `inherit` | **⚠ 红线**：白名单**不含 `--font-family-handwriting`**。见 B.4 + C.5——必须扩白名单正则，否则 W2 写卡片正文必撞 lint。 |
| `lint-hardcode.mjs` | 仅 apps/web/src（`.tsx/.ts`） | hex / rgb / tailwind 默认色 / 任意值 | **不扫 tokens.css 也不扫 packages**。§10 在 tokens.css 写 hex 合法（SSOT）。app 代码禁裸 hex/原型 var（H11）。 |
| `lint-shadow-token.mjs` | 仅 apps/web/src | 禁字面量 box-shadow（hex/rgba） | §10 sticky shadow 写进 tokens.css 不被扫；W2 卡片 css 必须 `var(--note-sticky-shadow-*)`。 |
| `lint-radius-token.mjs` | 仅 apps/web/src（`.tsx/.ts`） | 禁 Tailwind 默认 radius class | 与 W1 token 定义无关，W2+ 注意。 |
| `lint-spacing-token.mjs` | apps/web/src（含 `.css`） | 禁 padding/margin/gap 裸长度 | §10 `--note-wall-gap` 用 `var(--space-5)` 合法；W2 css 用 token 即可。 |

**三条关键结论：**

1. tokens.css **不在** `lint-hardcode` / `lint-shadow-token` 扫描路径（它们只扫
   `apps/web/src`），所以 §10 在 tokens.css 写裸 hex / 裸 box-shadow 字面量是**允许且
   正确**的（tokens.css = SSOT）。
2. tokens.css **在** `lint-external-font-hosts` 扫描路径，所以 `@font-face` 的 `src`
   **必须**走 `/__design-system-fonts/` 本地路由，禁任何 `https://`。
3. `lint-font-family-token` 当前白名单写死 `ui|ui-secondary|mono`，**新增
   handwriting 必须同步改这个正则**，否则不是 W1 撞，而是 W2 一写卡片正文就红。
   这条是 W1 必须连带处理的 lint 改动（属 apps 脚本，非生产运行时代码）。

---

## A. Note token 组（tokens.css 新增 §10）

### A.1 分层归属裁决（先定，再给 CSS）

视觉契约 §4.2 把这批 token 命名为 "component token"。但 paper 4 色是 Note **专属
新色**，primitive 层（§1）现有 color scale（neutral/yellow/blue/green/amber/red）
里没有对应的 jade/低饱和 paper 色阶。两种放法：

- **方案 J1（推荐）：直接落 component 层（§10），裸 hex 就地定义。**
  理由：(a) 这 4 组 paper 色只有 Note 视图消费，不构成跨组件复用的 primitive 资产；
  (b) 既有 §8 calendar chip 也是 component 分区且大量直接定义；(c) primitive 层注释
  写明"NOT consumed by app code directly"，而 paper 色就是要被 component 语义直接用。
  → paper 色作为"component 私有 raw 值"就地写 hex，符合现有 §8 风格。
- 方案 J2：先在 §1 加 `--color-paper-*` primitive 色阶，§10 再引用。
  代价：primitive 层为单一视图引入 12+ 新 raw 色，污染全局 scale，不推荐。

**lhr 待拍板点 ①**：paper 4 色放 component 层就地 hex（J1）还是先建 primitive（J2）。
草案默认 J1。

> 复用 vs 新增：§10.3 sticky shadow 的 inset 高光、§10.4 layout 能复用既有 token 的
> 尽量复用（如 `--note-wall-gap: var(--space-5)`）。但 paper 4 色、aged tint/edge、
> sticky 双层投影的 offset 组合是原型独有、V5 无对应语义 token，确需新值——这部分
> 在 tokens.css（SSOT）写字面量是合规的（见 0.3 结论 1）。

### A.2 §10 light 块（值 = 视觉契约 §4.3 + 原型行 34-41 / 466-469 核对一致）

> 已与原型 `Note v2.1.html` light 段逐值核对：
> jade `#DCEBE0`/bd`#9BC4A8`、blue `#DCE6F4`/bd`#94B4D9`、amber `#F8EDC2`/bd`#D9BB6A`、
> rose `#F4D8D8`/bd`#D89797`；body 文字色 jade`#1A4332`/blue`#1A325C`/amber`#4A3C12`/
> rose`#5C2424`；aged-tint`rgba(196,145,64,.14)`/edge`rgba(110,80,30,.20)`；
> sticky shadow rest/hover 见原型行 347-364。**契约 §4.3 与原型完全一致，无 drift。**

```css
/* ── §10 Note view tokens — SIK-108 W1 ───────────────────────────────────
 * Component-layer tokens for the Note 笔记墙 view. Paper colors are Note-only
 * raw values (no matching V5 primitive scale) — defined inline here per the
 * §8 calendar-chip precedent. App code MUST consume these tokens, never the
 * prototype --note-*/--paper-*/--aged-* vars or raw hex (H11 红线).
 * Visual contract: docs/plan/sik-108-note-home-visual-contract.md §4.2-§4.5.
 * ─────────────────────────────────────────────────────────────────────── */
:root {
  /* §10.1 paper colors — type-encoded, 4 type × 3 channel (bg/border/text), light.
   * type→纸色映射 (§4.4): free→amber question→blue knowledge→jade review→rose. */
  --note-paper-free:            #F8EDC2;  /* amber — 自由 */
  --note-paper-free-border:     #D9BB6A;
  --note-paper-free-text:       #4A3C12;
  --note-paper-question:        #DCE6F4;  /* blue  — 题级 */
  --note-paper-question-border: #94B4D9;
  --note-paper-question-text:   #1A325C;
  --note-paper-knowledge:       #DCEBE0;  /* jade  — 知识点 */
  --note-paper-knowledge-border:#9BC4A8;
  --note-paper-knowledge-text:  #1A4332;
  --note-paper-review:          #F4D8D8;  /* rose  — 错题反思 */
  --note-paper-review-border:   #D89797;
  --note-paper-review-text:     #5C2424;

  /* §10.2 aged paper overlay (>30d untouched, sepia) — light */
  --note-aged-tint: rgba(196, 145, 64, .14);
  --note-aged-edge: rgba(110, 80, 30, .20);

  /* §10.3 sticky bespoke shadow (rest/hover) — mirrors prototype .sticky
   * box-shadow literals (行 347-364). Two-layer: inset top highlight + lift. */
  --note-sticky-shadow-rest:
    0 1px 0 rgba(255, 255, 255, .6) inset,
    0 12px 28px -10px rgba(26, 29, 32, .10);
  --note-sticky-shadow-hover:
    0 1px 0 rgba(255, 255, 255, .6) inset,
    0 22px 42px -14px rgba(26, 29, 32, .16);

  /* §10.4 layout constants */
  --note-card-w:   240px;             /* prototype .sticky width:240px */
  --note-wall-gap: var(--space-5);    /* 24px ≈ 原型 22px，登记 drift (契约 C3) */
}
```

### A.3 §10 dark 覆盖块（值 = 原型行 62-68 dark 段，逐值核对）

> 原型 `:root[data-theme="dark"]` 段（行 43-70）核实到的 note 值：
> jade `#1F2D27`/bd`#356957`、blue `#1F262F`/bd`#3A506E`、amber `#2F2A1A`/bd`#73611F`、
> rose `#2E1F22`/bd`#724444`；aged-tint`rgba(255,200,110,.10)`/edge`rgba(255,200,110,.22)`。
>
> **契约 §4.3 注释只列了 4 个 bg hex（#1F2D27 等），未给 dark border / text / aged /
> shadow 值。本草案据原型补全，存在 2 处契约未明确、需 lhr 确认的点（见下）。**

```css
/* §10 dark override — Note view. Per CP.2, component layer is normally
 * theme-stable; but paper colors are an intentional theme-specific exception
 * (same token NAME, dark-curve values inside) — the SAME precedent §1.6 shadow
 * uses. Values mirror prototype :root[data-theme="dark"] (行 62-68). */
[data-v5-theme='dark'],
[data-theme='dark'],
[data-theme='night'] {
  /* §10.1 paper colors — dark (lhr 2026-05-31 裁决) */
  --note-paper-free:            #2F2A1A;  /* amber dark (原型 dark 段) */
  --note-paper-free-border:     #73611F;
  --note-paper-question:        #1F262F;  /* blue dark */
  --note-paper-question-border: #3A506E;
  --note-paper-knowledge:       #1F2D27;  /* jade dark */
  --note-paper-knowledge-border:#356957;
  --note-paper-review:          #2E1F22;  /* rose dark */
  --note-paper-review-border:   #724444;
  /* paper text (dark): 全部引 semantic，不新立 hex (lhr 裁决①)。
   * 依据: 原型 dark 下 .body 本就吃 --ink-2=text-secondary。 */
  --note-paper-free-text:       var(--color-text-secondary);
  --note-paper-question-text:   var(--color-text-secondary);
  --note-paper-knowledge-text:  var(--color-text-secondary);
  --note-paper-review-text:     var(--color-text-secondary);

  /* §10.2 aged overlay — dark (warm amber sepia on dark paper, 原型 dark 段) */
  --note-aged-tint: rgba(255, 200, 110, .10);
  --note-aged-edge: rgba(255, 200, 110, .22);

  /* §10.3 sticky shadow — dark (lhr 裁决②): 引既有 vetted dark 曲线，不自造 alpha。
   * rest=静置→l1 / hover=抬起→l2 (--shadow-l1/l2 dark 段已校准深色 rgba)。 */
  --note-sticky-shadow-rest:  var(--shadow-l1);
  --note-sticky-shadow-hover: var(--shadow-l2);
  /* §10.4 layout constants are theme-stable — NOT re-declared in dark. */
}
```

### A.4 分层 / lint / drift 小结

- **分层**：§10 整体落 component 层；dark 覆盖 §10.1/§10.2/§10.3，§10.4 layout 不随
  主题变（与契约一致）。dark 覆盖 paper 色属 CP.2 的合法例外（同 §1.6 shadow 先例）。
- **lint**：§10 在 tokens.css，不被 lint-hardcode/lint-shadow 扫（0.3 结论 1），写裸
  hex / 裸 box-shadow 合规。app 代码（W2+）禁裸 hex / 原型 var / color-mix %（H11）。
- **drift**：仅 `--note-wall-gap` 24px vs 原型 22px（契约 C3 已立 token、已登记）。
  paper 色 / aged / shadow rest+hover 与原型 light 段**逐值一致，无 drift**。

### A.5 本节拍板点汇总（lhr 2026-05-31 已裁决）

- **①✅** paper 4 色放 component 层就地 hex（J1）。
- **②✅** dark paper body text 全部引 `var(--color-text-secondary)`，不新立 hex
  （已落 §A.3 dark 块）。
- **③✅** dark sticky shadow 引 `var(--shadow-l1)`(rest) / `var(--shadow-l2)`(hover)，
  不自造 alpha（已落 §A.3 dark 块）。

---

## B. 字体（LXGW WenKai 自托管分包）

### B.1 `--font-family-handwriting` token 定义

落点：tokens.css §0.5 font families 区块（与 `--font-family-ui` 等并列），值 fallback
链对齐原型 `.sticky .body`（行 455）的 `'LXGW WenKai TC','LXGW WenKai','Source Han
Serif SC','Songti SC',serif`，按 V5 自托管口径收敛为：

```css
  /* §0.5 — handwriting family (Note body / detail Modal body only). SIK-108.
   * 简体 GB 版 LXGW WenKai 首选 (lhr 2026-05-31)；TC 仅作本机兜底名。 */
  --font-family-handwriting:
    'LXGW WenKai',          /* 自托管分包 (本 wave 新增，简体 GB 版) */
    'LXGW WenKai TC',       /* 用户本机若装了 TC 版兜底 */
    'Source Han Serif SC',  /* 思源宋体 */
    'Songti SC',            /* macOS 宋体 */
    'STSong',               /* 备选宋体 */
    serif;                  /* 终极兜底 */
```

> 简体优先：sikao 是简体产品，自托管选**简体 GB 版 `LXGW WenKai`**，TC 仅留作
> 系统兜底名。与原型首选 `LXGW WenKai TC` 的偏离已登记契约 §6 drift（lhr 2026-05-31）。

### B.2 `@font-face` 方案：照抄 DM Sans 分包模式，但 CJK 必须多片

DM Sans 是 Latin 字体，2 片（latin + latin-ext）就够。**LXGW WenKai 是 CJK 字体，
常用简体汉字 6700+、加扩展上万字，单片 woff2 体积 5-8MB 级，不能一刀切。** 必须按
Unicode 分片成几十到上百片小 woff2，每片配自己的 `unicode-range`，浏览器只拉页面
实际用到的那几片。`@font-face` 结构与 DM Sans 完全同款（`font-display: swap` +
`src: url('/__design-system-fonts/<file>.woff2') format('woff2')` + `unicode-range`），
只是 face 数量从 2 变成 N。形如：

```css
/* LXGW WenKai self-hosted handwriting font — SIK-108 W1.
 * CJK can't single-chunk; sharded by unicode-range (N faces). Same shape as
 * the DM Sans block above — only the shard count differs. font-display: swap. */
@font-face {
  font-family: 'LXGW WenKai';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/__design-system-fonts/lxgw-wenkai-cjk-001.woff2') format('woff2');
  unicode-range: U+4E00-4FFF; /* 示例片，实际区间由所选包/子集化产物决定 */
}
/* … 重复 N 个 face，每片不同文件名 + 不同 unicode-range … */
```

> N 个 `@font-face` 是机械重复，**应由所选 webfont 包提供的 CSS 直接抄/转写**，
> 不手写 unicode-range 区间（易错）。见 B.3 路径取舍。

### B.3 分包获取路径取舍（三选一 + 推荐）

> 体积为量级估算（LXGW WenKai 字形量决定 GB 全集 woff2 约 8-9MB；分片是切法不同，
> 总量级不变，关键差异在**分多少片 / 单片多大 / unicode-range 是否现成**）。
> 精确 per-shard 字节数需安装后实测，标 `待实测`。

| 方案 | 来源 | 分片 / unicode-range | 体积量级 | 取舍 |
|---|---|---|---|---|
| **P1 推荐** | `@fontsource/lxgw-wenkai`（npm，OFL-1.1） | Fontsource 标准产物，**每片自带 unicode-range CSS**（与 Google Fonts/DM Sans 完全同款机制），woff2 + 分片 | 全集 ~8-9MB 拆成数十~上百片；首屏常用片按需拉、单片几十~一两百 KB `待实测` | unicode-range 现成、机制与现有 DM Sans 一致、license 明确 OFL-1.1。**最省心、最贴现有模式。** |
| P2 | `chawyehsu/lxgw-wenkai-webfont` / `@callmebill/lxgw-wenkai-web` | 社区分片（`...-subset-1xx.woff2` 上百片），自带 CSS 含 unicode-range | 同量级，分片更细（100+ 片） | 也可用，但维护方分散、版本号语义各异（callmebill 标 1.520）。需额外核 license。次选。 |
| P3 | 自行 `fonttools` 子集化 LXGW 原始 ttf | 自定义 unicode-range（可只切常用简体 GB2312/3500 字 + 标点） | 可压到 **~1.5-3MB** 总量（只保常用字） | 体积最优、最可控，但要自建子集化脚本 + CI 复现 + 自己维护 unicode-range 切分。**重，且引入构建期工具链依赖。** 仅在体积是硬指标时选。 |

**采用 P1（@fontsource/lxgw-wenkai，lhr 2026-05-31 确认）**，理由：

1. 产物结构与现有 DM Sans/Inter 的 unicode-range 分包**机制完全一致**，§B.2 的 N 个
   `@font-face` 可直接从 Fontsource 的 `.css` 转写（把它的 `src: url(./files/xxx.woff2)`
   改成 `/__design-system-fonts/xxx.woff2`，woff2 文件复制进 fonts 目录）。
2. license 明确 OFL-1.1（搜索结果确认），与字体本体一致。
3. 按需加载：浏览器只拉页面命中的片，笔记墙中文字符落在的片才下载，符合 swap 策略。

> **注意**：Fontsource 默认子集含 latin/latin-ext/cyrillic 等多西文片 + 中文片。
> W1 落地时**只需复制中文相关片 + 必要标点片**进 fonts 目录（西文已有 DM Sans 兜底），
> 避免无谓体积。具体保留哪些 subset 在落地时按原型正文用字确定，标 `待实测`。

### B.4 文件落点 + 命名规范

- 落点：`packages/design-system/src/fonts/`（host 物理目录，自动纳管，0.2 已核实）。
- 命名沿用现有 `<family-kebab>-<subset>.woff2`。建议：
  `lxgw-wenkai-<subset>.woff2`，CJK 分片用 `lxgw-wenkai-cjk-<NNN>.woff2`
  或沿用 Fontsource 原始片名加前缀（如 `lxgw-wenkai-chinese-<NNN>.woff2`）。
  **最终片名以所选包产物为准**，保持与 host glob（`*.woff2`）兼容即可。
- README（`fonts/README.md`）需更新：当前明确写 "CJK stays on system fallback in
  this wave; no self-hosted Chinese font here" —— W1 落地后这句**作废**，要改写为
  "LXGW WenKai self-hosted (SIK-108)"。这是 W1 连带文档改动。

### B.5 新增依赖 / 资产清单（lhr 2026-05-31 已确认）

| 项 | 内容 | 状态 |
|---|---|---|
| 新依赖 | `@fontsource/lxgw-wenkai`（OFL-1.1；作为**资产来源**，devDep 后复制 woff2，不一定进 runtime deps） | ✅ lhr 确认 |
| 字形版本 | **简体 GB 版 LXGW WenKai**（非 TC 繁体版）；登记契约 §6 drift | ✅ lhr 确认 |
| 新资产 | N 个 `lxgw-wenkai-*.woff2`（中文片 + 标点片子集）落 `packages/design-system/src/fonts/` | 待 W1 落地复制 |
| **license 资产（OFL-1.1 义务）** | 附 `OFL.txt` 进 `fonts/` + `fonts/README.md` 注明 LXGW WenKai OFL-1.1。OFL 允许免费商用/自托管/嵌入；唯禁原名单独售卖字体本体（不涉及）。**这是合规必做项，非成本。** | W1 必做 |
| lint 改动 | `lint-font-family-token.mjs` 白名单加 `handwriting`（见 C.5） | ✅ W1 必做（lhr 确认） |
| token | `--font-family-handwriting` + N 个 `@font-face`（tokens.css） | W1 落地 |

> **fail-fast 视角**：字体是渐进增强（swap + 系统楷宋兜底），LXGW 没加载到不算
> 功能性错误，不触 H7（不是 silent fallback，是 web 字体标准降级）。无需登记例外。

---

## C. 落地与验证

### C.1 W1 文件改动清单（H9：≤15 文件 / ≤400 净增）

| # | 文件 | 改动 | 量级估算 |
|---|---|---|---|
| 1 | `packages/design-system/src/tokens.css` | §0.5 加 `--font-family-handwriting`；顶部加 N 个 LXGW `@font-face`；末尾加 §10（light+dark） | token+§10 约 90 行；`@font-face` 视分片数（数十~上百片）可能**单独占几百行** |
| 2 | `packages/design-system/src/fonts/*.woff2` | 新增 N 个 woff2 资产（二进制，不计入"行") | N 文件 |
| 2b | `packages/design-system/src/fonts/OFL.txt` | LXGW WenKai OFL-1.1 许可证文件（合规义务） | 1 文件 |
| 3 | `packages/design-system/src/fonts/README.md` | 改写 CJK 政策段（B.4）+ 注明 OFL-1.1 | ~8 行 |
| 4 | `apps/web/scripts/lint-font-family-token.mjs` | 白名单正则加 `handwriting`（C.5） | ~2 行 |
| 5 | `docs/vault/04-design/Design-System.md` | 硬规则 4/7 文案更新（仅指出，C.6） | 文档 |

### C.2 commit 拆分（H9 + H5 + lhr "<100 行/块"要求）

`@font-face` 分片块可能上百行，且字体资产是二进制 + 文档/lint/token 是不同关注点，
**不能一个 commit 混装**（H9 禁混合 plan/schema/实现）。建议拆 3-4 个原子 commit：

1. `feat(tokens): add Note view component tokens §10 (light+dark)` —— 纯 §10 + dark。
2. `feat(fonts): self-host LXGW WenKai handwriting font + token` —— woff2 资产 +
   `@font-face` + `--font-family-handwriting` + README。（资产二进制，行数不计净增，
   但 `@font-face` 文本若 >100 行，按 lhr 规则文档收敛例外说明处理或进一步按 subset 分。）
2 中 `@font-face` 文本块如果确实 >100 行，**这是机械生成的字体声明**，落地时在 commit
   message 注明"自托管字体声明，机械分片，非逻辑代码"，并附 lint PASS 证据。
3. `chore(lint): allowlist --font-family-handwriting in lint-font-family-token` ——
   lint 脚本白名单。
4. `docs(design-system): note Modal/soft-delete override + handwriting font` ——
   硬规则 4/7 文案（C.6，可能并入 SIK-108 文档专门 commit）。

> **写文件落地纪律**：本草案已遵守 lhr "每次 fs_write/fs_append <100 行" 要求分块写。
> 真正改 tokens.css 时同样分块 append，不一次性灌入。

### C.3 W1 验证命令清单

落地后（**本草案阶段不跑**）必须全绿：

```
# tokens / 字体不外链
node apps/web/scripts/lint-external-font-hosts.mjs      # 必跑：含 packages/design-system/src
node apps/web/scripts/lint-font-family-token.mjs        # 必跑：验证 handwriting 已进白名单
node apps/web/scripts/lint-hardcode.mjs                 # app 代码无裸 hex（W1 不动 app 代码，应天然过）
node apps/web/scripts/lint-shadow-token.mjs             # 同上
node apps/web/scripts/lint-radius-token.mjs             # 同上
node apps/web/scripts/lint-spacing-token.mjs            # 同上
pnpm -C apps/web typecheck                              # 或 repo 既定 typecheck 命令（待确认具体脚本名）
pnpm -C apps/web test designSystemFontHost              # 见 C.4
```

> `lint-hardcode/shadow/radius/spacing` 只扫 `apps/web/src`，W1 不改 app 代码，理论上
> 不受影响；仍建议全跑确认无回归。typecheck/test 的确切 package.json script 名 `待确认`
> （未读 package.json，不臆测）。

### C.4 designSystemFontHost.test 是否要补？

读了 `designSystemFontHost.test.ts`，现有 4 个断言：root 计算、合法 woff2 解析、
目录穿越拒绝、`listDesignSystemFonts` 含 `dm-sans-latin-variable.woff2`。

- host **逻辑**（`designSystemFontHost.ts`）W1 不改——它对任意 `*.woff2` 通用，新增
  LXGW 片自动纳管，无需改逻辑、无需为"能服务 lxgw"补功能测试。
- **建议补 1 条轻量断言**（可选，低优先）：在 `listDesignSystemFonts` 用例追加一条
  断言新增的某个 `lxgw-wenkai-*.woff2` 也在产出列表里，作为"字体资产已落盘 + 被
  build 纳管"的回归哨兵。
- **判断**：host 测试**不是 W1 阻塞项**；补哨兵断言属 nice-to-have，依赖最终片名定下
  后再加（片名 `待实测`）。W1 必跑的是这个测试**保持绿**（确认没破坏 host）。

### C.5 lint-font-family-token 白名单改动（W1 必做，最易漏）

当前脚本（已读）允许正则写死三族：

```js
/font-family\s*:\s*var\(--font-family-(ui|ui-secondary|mono)\)/
/fontFamily\s*:\s*['"]var\(--font-family-(ui|ui-secondary|mono)\)['"]/
```

W1 必须把 `handwriting` 加进这两条正则的分组（→ `(ui|ui-secondary|mono|handwriting)`），
否则 W2 在卡片正文 / detail Modal 正文写 `font-family: var(--font-family-handwriting)`
会被判违规。这是 **apps/ 脚本改动，非生产运行时代码**，属低风险但必须连带做的一环。
草案不在此阶段改脚本（只指出）。

### C.6 与 Design-System.md 文档更新的关系（仅指出，不展开）

视觉契约 §5.1 记录了 lhr 2026-05-31 的 H1 override（推翻硬规则 4 / 7）。其"后续动作"
明确要求在 **W1** 同步更新 `docs/vault/04-design/Design-System.md §35-component`：

- 硬规则 4：改为「Note **quick** detail = Modal；Note **富文本编辑** = 脱壳全屏
  NoteEditor（SIK-109）」，并改/删现有 `Note view does NOT render any Modal` 测试。
- 硬规则 7：补「可逆软删 + undo 可豁免 ConfirmDialog」例外说明。

> 本草案只指出此关系（属契约既定 W1 动作）。文案细节与测试改动归 W1 落地时处理，
> 不在本 token/font 草案展开。注意：改硬规则文案 + 删既有测试触及 H5 review gate
> 与 H8 validation，落地时需独立 subagent review。

### C.7 W1 整体风险 / 阻塞小结（lhr 2026-05-31 裁决后更新）

- **R1（W1 必做）**：`lint-font-family-token` 白名单加 handwriting → ✅ 已确认 W1 改。
- **R2（已拍板）**：A.5 三点（paper 分层 J1 / dark text 引 secondary / dark shadow 引
  l1·l2）+ 来源包 `@fontsource/lxgw-wenkai` → ✅ 全部已定，见 §A.3/§A.5/§B.3/§B.5。
- **R3（量级）**：`@font-face` 分片块可能 >100 行 → 触 lhr "<100 行/块"写入纪律 +
  可能触 H9 单 commit 行数，按 C.2 拆分 / 机械声明例外说明处理。
- **R4（已登记）**：手写体选简体 GB 版而非原型 TC 版 → ✅ 已登记契约 §6 drift。
- **R5（OFL 合规）**：随字体附 `OFL.txt` + README 注明 OFL-1.1（§B.5 / §C.1）。
- **无阻塞外部依赖**：host 机制 / index.css import / tokens 分层先例都已就绪，W1 可落。
