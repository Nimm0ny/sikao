# SPEC · 行测答题 UI

## 1. 页面骨架

```
┌────────────────────────────────────────────────────────────────┐
│  TOPBAR  [Logo · SIKAO 占位] ········ 00:38:14 ······ ⏸ ⚙       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   PART 01 · 言语理解          15 题 · 当前 16                   │
│   ───────────────────────────────────────────                   │
│                                                                │
│   ┌──────┐                                                     │
│   │  15  │  题干文字 ...........                                │
│   │  ☆   │  A · ...                                            │
│   │  ⚐   │  B · ...                                            │
│   │  ☱   │  C · ...   (selected)                               │
│   │  ✎   │  D · ...                                            │
│   └──────┘                                                     │
│                                                                │
│   ...更多题...                                                  │
│                                                                │
│   PART 05 · 资料分析 · 材料一                                   │
│   ┌─ 段一 ── 段二 ── 段三 ───────┐  [折叠材料]                 │
│   │ sticky 材料 (可折叠)         │                              │
│   └──────────────────────────────┘                              │
│                                                                │
│   ┌──────┐                                                     │
│   │  26  │  Q26 子题 ...                                       │
│   └──────┘                                                     │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  ◀  第 29 题 / 35  ▶   ▦   ✓        (bottom dock, sticky)      │
└────────────────────────────────────────────────────────────────┘

                          🪶 (右侧悬浮 · AI 解析 · 付费)
```

---

## 2. Topbar

- 高度 56px，左 logo / 中计时器 / 右 ⏸ + ⚙ 三段式
- **Logo slot**：占位符为 SIKAO，落地需替换（见 README）
- **计时器**：`00:38:14`，JetBrains Mono，21px，tabular-nums，暂停时颜色变 ink-3 + 闪烁
- **⏸ 暂停**：icon-btn 32×32，键盘 `Space`，toggle 播放/暂停 icon
- **⚙ 设置**：点击展开 280px 弹层，含 3 项 segmented control
  - 阅读字号 M / L / XL → `--read-fs` 切换 (15 / 17 / 19px)
  - 行间密度 Cozy / Compact → `[data-density]` attr
  - 选项 letter 圆形 / 方形 → `[data-opt-style]` attr
  - 持久化 localStorage key `fb-settings-v1`

> 顶部不放「提交」按钮 —— 与底部 dock 重复，已统一到 dock 右端图标按钮。

---

## 3. 题卡 (FbCard)

### 3.1 布局

```css
.fb-card {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 24px;
  padding: 24px 0;
  border-bottom: 1px solid var(--rule);
  position: relative;
}
.fb-card.is-current {
  background: linear-gradient(to right, var(--paper-2), transparent 100px);
}
.fb-card.is-current::before {
  /* 左侧 2px accent 朱红色边 */
  content: '';
  position: absolute;
  left: -24px; top: 24px; bottom: 24px;
  width: 2px;
  background: var(--accent);
}
```

### 3.2 左列 (72px 宽)

| 元素 | 说明 |
|---|---|
| 题号 | Serif 30px / 居中 / `tabular-nums` / 当前题朱红 / 下方 1px 分隔线 |
| ☆ 收藏 | icon-btn 30×30，toggle，`is-on` 时填充 |
| ⚐ 标记 | 同上，给"难题/回头看"打旗 |
| ✎ 笔记 | 点击 → prompt → 在题干上方插入 `.fb-note-strip` |
| 🖋 划线 | 点击 → 浮出色板工具条 → 用户选中文字上色 |

按钮**纵向居中**排列，gap 4px。

### 3.3 右列 (Body)

- `.fb-note-strip` — 若有笔记，置顶（朱红色 left-border + 浅 accent-50 底色）
- `.fb-stem` — Serif，`var(--read-fs)`，`line-height: var(--read-lh)`，`text-wrap: pretty`
- `.fb-opts` — 选项区，类型见下

---

## 4. 选项形式

### 4.1 单选 / 多选 (`.fb-opts[data-qtype="single|multi"]`)

```
┌──────────────────────────────────────────────────┐
│  ⓐ   选项文字内容                                 │
└──────────────────────────────────────────────────┘
```

- 卡片：`border: 1px solid var(--rule); border-radius: 4px; padding: 12px 16px`
- letter：32×32 圆形 (`[data-opt-style="circle"]`) / 方形 (`square`)
  - 未选：1px 边框 + 字母居中
  - 已选 (单)：`bg: var(--ink); color: var(--paper)` 完全填充
  - 已选 (多)：letter 内显示 ✓ 而非字母，方形为主
- 选中卡片本身：`border-color: var(--ink); background: var(--paper-2)`
- 多选可同时选中多个，单选互斥

### 4.2 判断 (`.fb-tf`)

```
┌──────────────────┐   ┌──────────────────┐
│  ✓   正确   T    │   │  ✗   错误   F    │
└──────────────────┘   └──────────────────┘
```

- `grid-template-columns: 1fr 1fr; gap: 16px`
- 每项大 pill，高 64px，左侧 24×24 SVG (✓ / ✗)
- 中文标签 18px Serif；右侧角标 `T` / `F` mono 提示快捷键
- 选中：朱红 border + 浅 accent-50 底色

### 4.3 资料分析 (`.section-label.is-group` + `.pg-sub`)

- **材料区** sticky 在 section 顶部：`.fb-passage`
  - 顶部三个段落 tab：`段一 / 段二 / 段三`，点击平滑滚动到对应 `<p id="passage-p1|p2|p3">`
  - 右上角「折叠材料」按钮（快捷键 `P`），折叠后只显示 24px 顶 strip
  - 段落内含表格 / 数据 → 用 mono 数字 + `var(--paper-2)` 行间斑纹
- **子题** 5 道 (Q26-Q30)，复用普通 `.fb-card`，每个选项可点击 `⤴ 段二` 锚点回跳到原文，并瞬时高亮段落 (1.2s `var(--accent-50)` 闪烁)

---

## 5. 浮动工具条 (Selection Toolbar)

ID：`#sel-toolbar`

**触发方式两种**：

1. 在题干 / 材料 / 题卡内**用鼠标选中文字** → 工具条出现在选区上方
2. 点击左列 **🖋 划线** 按钮 → 工具条锚定在按钮旁，等待用户选中（卡片左侧 1.2s 朱红脉冲提示）

**按钮**（深色 pill，从左到右）：

| 按钮 | 行为 |
|---|---|
| 🟡 黄 / 🟢 绿 / 🔵 蓝 / 🩷 粉 swatch | 用 `<mark class="fb-hl" data-c="...">` 包裹选区 |
| 🗑 清除 | 移除选区内所有 `mark.fb-hl` |
| ⤺ 撤销 | 弹栈最近一次划线/清除操作，无操作时 disabled |

**撤销机制**：

- 栈最长 50，超过丢弃最早
- 支持 `Cmd+Z` / `Ctrl+Z` 快捷键
- 清除操作也可撤销（保留 outerHTML 快照重新插入）

**笔记**：

- 笔记功能已**从工具条移除**，统一在左列 ✎ 按钮触发
- 笔记以 `.fb-note-strip` 形式置于题干上方（朱红 left-border）
- 笔记内容存在 `dataset.note`，再次点击 ✎ 可编辑 / 清空

---

## 6. 底部 Dock

```
◀  第 29 题 / 35  ▶   ▦   ✓
```

- 5 个对称的 32×32 图标按钮
- 「第 N 题 / 35」mono 14px，居中位置文字
- ▦ 答题卡 → 抽屉 (`#drawer`)，键盘 `A`
- ✓ 交卷 → 弹确认（落地需实现）
- 整条 dock：`position: sticky; bottom: 0`，半透明 paper bg + 上边 `--rule`

---

## 7. 答题卡抽屉 (`#drawer`)

- 右滑入 360px 宽
- 顶部：标题「答题卡」+ 进度 22/35 + 进度条
- 主体：5 个 `grid-section`，每段对应 PART 01-05
  - `PART 05` 标 `is-group`，背景 `var(--paper-2)` 表示资料分析组
- 每格 32×32 小按钮，状态：
  - 默认 1px border
  - 已答 (`is-answered`) 实底 `var(--ink-2)` 白字
  - 当前 (`is-current`) 实底 `var(--accent)` 白字
  - 已标记 (`is-flagged`) 右上角朱红小三角
- 点击格子 → 关闭抽屉 → smooth scroll 到该题

---

## 8. AI 解析（付费功能）

### 8.1 入口

页面右中浮按钮 `.ai-fab`：

- 48×48 圆形 paper bg + 1px ruleStrong border
- 中心五角星 SVG，右上角小朱红 dot 内嵌 🔒 表示付费
- hover：转为 ink 实底 + 左移 2px + 显示 tooltip「AI 解析 · Pro」

### 8.2 付费弹窗 `.ai-modal-scrim`

- 半透明 scrim + backdrop blur 2px，居中 440px 卡
- Hero：`PRO · AI 解析` badge + 标题 + 副标语
- Features 列表 4 条（骨架解析 / 错点诊断 / 同类题推荐 / 口语讲解）
- 两个套餐 segmented：月度 ¥39 / 年度 ¥298（默认推荐）
- 主 CTA：ink 实底「解锁 AI 解析」
- 关闭：右上 × 按钮 / 点 scrim / Esc

> 落地时 CTA 需对接订阅 / 支付流；feature 文案与套餐价格请走运营审稿。

---

## 9. Tweaks 面板

设计阶段用，落地可丢弃。只剩一个 `Theme` 选择 (warm / pure / night)。

---

## 10. 交互规约

### 键盘快捷键

| 键 | 行为 |
|---|---|
| `1`–`4` | 选当前题的 A–D |
| `T` / `F` | 选判断题正确 / 错误 |
| `Space` | 暂停 / 继续 |
| `A` | 打开答题卡 |
| `P` | 折叠 / 展开资料分析材料 |
| `Esc` | 关闭抽屉 / AI modal |
| `Cmd+Z` / `Ctrl+Z` | 撤销划线 |

### 动效

- 抽屉滑入：240ms `cubic-bezier(.4, 0, .2, 1)`
- AI modal 入场：200ms `cubic-bezier(.4, 0, .2, 1)`，translateY(8px) → 0 + opacity
- 段落锚跳：scroll-behavior smooth + 1.2s 背景闪烁
- 划线卡片 armed：1.2s 单次脉冲（box-shadow inset 3px 0 0 accent）

---

## 11. 落地注意

1. **Logo 占位符必须替换**（README 已强调）
2. 计时器需后端发题时即开始，刷新页面要走 server timestamp，不能依赖前端时钟
3. 划线 / 笔记 / 收藏 / 标记 状态需持久化到答题会话；建议每次状态变化 debounce 500ms 同步
4. 资料分析子题与材料的关联：`<a href="#passage-pX">` 锚跳目前是前端硬编码，落地需根据资料分析题目数据动态生成段落 id
5. AI 解析功能落地需对接订阅服务；未付费用户点 fab 只展示弹窗，不要泄露付费内容
6. 多选题的「至少选 2 项」校验目前没有；落地交卷前需校验
7. 移动端：左列折叠为题号 + 操作按钮横向 row（已有 media query 1024px 断点骨架）
