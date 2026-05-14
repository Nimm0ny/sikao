---
type: product
status: active
owner: lhr
last-reviewed: 2026-05-09
---

# Design Brief · 跟 claude.ai design canvas 协作的标准 prompt

> **怎么用**：每次在 [claude.ai/design](https://claude.ai/design) 开新 session 时，把
> §1-§7 整段（约 150 行）复制粘贴到对话框第一条消息。然后再说"请帮我画 X 页面"。
>
> **为什么这样做**：design canvas 没有访问本地文件系统的能力。这份 brief 是
> 「让 design AI 在每次新对话里立刻知道我们的设计语言」的最小自包含版本。
> 完整规范（数值、组件状态枚举）在 `docs/design/style-guide.md`，本文是它的精简版。

---

## ⬇️ 复制下面整段到 design canvas（含分隔线）⬇️

---

## 1 · 产品

**思考**（SIKAO） — 公考备考工具。

- **标语**：让备考从刷题变成思考
- **调性**：备考同伴、克制的陪伴。「图书馆隔壁桌的同学」 — 安静、靠谱、不打鸡血
- **是**：专业 / 可信赖 / 冷静 / 锐利 / 安静 / 极简 / AI native
- **不是**：焦虑 / 套路 / 炫技 / 推销 / 说教 / 红点轰炸 / 励志鸡汤

---

## 2 · 视觉语言：ink-first

**Brand 是黑（ink），蓝降级为 accent**。这是项目最重要的视觉决策。

### Token（必须用这套）

```css
/* Light theme */
--brand: #0b1120;        /* 主按钮 / Logo / 当前态 / 标题 / tab active */
--brand-700: #000000;    /* hover 加深 */
--brand-50: #f1f5f9;     /* 选中底色 / chip 底色（slate-100 灰）*/
--brand-100: #e2e8f0;    /* chip 边框 */
--brand-200: #cbd5e1;    /* hover 边框 */

--accent: #3f7ef1;       /* focus ring / 超链接 / 单一关键 CTA */
--accent-50: #eff6ff;    /* accent chip 底色 */

--ink: #0b1120;
--ink-muted: #334155;    /* 次正文 */
--muted: #64748b;        /* 辅助文字 */
--placeholder: #94a3b8;

--paper: #ffffff;
--bg-alt: #f8fafc;       /* 页面底色 */
--sidebar: #020617;      /* 深色侧栏（黑底）*/
--line: #e5e7eb;
--line-strong: #cbd5e1;

--success: #16a34a;  --success-bg: #dcfce7;   /* ✓ 答对 */
--warn:    #f59e0b;  --warn-bg:    #fef3c7;   /* ⚑ 标记 */
--danger:  #dc2626;  --danger-bg:  #fee2e2;   /* ✗ 答错 */
```

### 使用比例 90 / 8 / 2

- **90% 留白 + 灰阶**（白底、`bg-alt` 底、灰色文字）
- **8% Ink 黑**（标题 + 主 CTA + 当前态）
- **2% Accent 蓝**（focus + 链接，一屏 ≤ 1-2 处）

> 想用第 3 处蓝 = 八成是层级没分清，先试 ink 或灰阶。

### 字体

```css
--sans: 'Inter', system-ui, 'PingFang SC', sans-serif;
--mono: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
```

**等宽字体硬规则**：分数、计时器、题号、ID、code label 一律走等宽，禁止用 Inter 凑数（数字会跳）。

### 字号阶梯（10 级）

`display 56 / h1 36 / h2 28 / h3 22 / h4 18 / body 14 / body-sm 13 / caption 12 / eyebrow 11 (大写 letter-spacing 0.08em) / mono-num 36`

### 间距 8px 倍数

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 80` — 禁止取 13 / 22 这种数。

### 圆角 5 档

`sm 8 (chip) · md 12 (btn/input/opt) · lg 16 (card) · xl 20 (hero) · pill 9999`

### 阴影 3 档

`shadow-card`（默认） · `shadow-pop`（hover/drawer） · `shadow-hero`（大卡/modal）

---

## 3 · 组件状态

### Option 答题选项 · 7 状态（必须画全）

| 状态 | 边 | 底 | 标号 |
|---|---|---|---|
| default | line | paper | 灰底灰字 |
| hover | brand-200 | paper | 灰底灰字 |
| selected | brand 黑 | brand-50 | 黑底白字 |
| correct | success | success-bg | 绿底白字 |
| wrong | danger | danger-bg | 红底白字 |
| revealed | success | success-bg | 绿底白字（解析中显示正确答案）|
| disabled | line | bg-alt | 半透 |

### Button · 4 类型 × 4 状态

`primary (bg=brand 黑) · secondary (outline) · ghost · danger`，每个画 default / hover / active / disabled。

### Card · 3 层级

- L1 基础卡：白底 + line 描边 + r-lg
- L2 浮起卡：白底 + shadow-pop（无边）
- L3 旗舰卡：黑底渐变 `linear-gradient(135deg, #0b1120, #1e293b)` + accent 蓝 radial glow + shadow-hero

---

## 4 · 白底 vs 黑底，蓝色用法不同

**白底场景** → brand 是黑，蓝**禁止**作主色：
- 主按钮 `bg=#0b1120`
- 选中 chip `bg=brand-50 (slate-100), color=#000`
- avatar gradient 走 `#0b1120 → #1e293b` 不要 `#2563eb → #1d4ed8`

**黑底场景**（sidebar / hero card / 专注模式 / 黑底 brief panel）→ 浅蓝是合理 accent：
- 黑底 sidebar 上 active 条 `#60a5fa` ✓
- 黑底 hero card 上 chip `rgba(96,165,250,.2) + #93c5fd 文字` ✓
- 黑底 hero card 上 radial blue glow ✓

**Why**：dark theme 把 brand 升为蓝（`#3b82f6`），因为黑色在黑底不可见。深色面板视作 dark theme 的局部实例，浅蓝是它的合理 accent。

---

## 5 · 图标

- **库**：lucide（线性，1.75-2px stroke，stroke linecap/join 用 round）
- **不混用填充图标**
- **尺寸**：16 (inline) / 20 (导航) / 24 (默认) / 32 (空状态)

---

## 6 · Voice & Tone

写文案前问自己：**图书馆隔壁桌会这么说吗？**

| 场景 | ✗ 不要 | ✓ 这么说 |
|---|---|---|
| 欢迎语 | 哈喽！亲爱的小可爱～开始你的上岸之旅吧 🎉 | 晚上好。今天还剩 1 小时 12 分。 |
| 错误反馈 | 哎呀做错啦~不要灰心！加油加油！ | 错。第三次错在同一个考点，建议看一遍解析再做。 |
| 成绩报告 | 恭喜你打败了 99% 的用户！ | 78 分。高于 82% 的同期备考者。资料分析失分较多。 |
| 空状态 | 哎呀，这里空空如也呢～ | 暂无错题。继续保持。 |

---

## 7 · 禁止反例

下面这些是「刷题」感的设计，**全部禁止**：

- 闪烁的红点 / 倒计时 / "还剩 X 秒" 焦虑文案
- 「恭喜你打败 99% 用户」式百分位排行（除非用户主动看）
- 大块品牌色 banner / 大渐变光晕作主视觉
- 卡通插画 / 题面里出现 emoji / 「亲～」「宝宝」式称呼
- 弹幕 / 直播感 / 红包 / 抽奖

---

## ⬆️ 复制结束 ⬆️

---

## 接下来跟 design canvas 说什么

把上面 §1-§7 贴完后，下一句直接说要做什么：

```
请按上面规范，画 [练习中心首页 / 错题本 / 今日学习计划 / xxx] 这个页面。
artboard 1280×800，用 ink-first 风格。
```

如果是改进现有页面：

```
我已经画过 [SessionA 单选 / Dashboard A / xxx]，现在要做的是 [新版本]，
请保持 §3 组件状态规范，重点在 [xxx 行为] 上做变化。
```

## 进阶：贴现成 jsx 给 design canvas 参考

如果想让 design canvas 「在现有组件基础上扩展」，复制对应 jsx 文件原文一起贴：

- 答题页系列：`design/session/session-shell.jsx` + `session-a.jsx`
- 整页 wireframe：`design/scenes/dashboard.jsx`
- 组件规范：`design/uikit/components.jsx`
- 颜色 / 字体规范：`design/uikit/foundations.jsx`

注意 design canvas 单条消息有 token 上限，分次贴：先 brief（§1-§7），再贴一个 jsx 文件做参考，最后说要求。

## 同步规则（design canvas 那边产出后回来）

每次设计稿落地到 `design/` 后，**新增的 token 要三处同步**：
1. `design/tokens.css`
2. `element/colors_and_type.css`
3. `frontend/src/styles/tokens.css`

→ 见 `CLAUDE.md §4 Design Token 三处 SSOT` 和 `docs/design/style-guide.md §0`。
