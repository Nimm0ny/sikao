# TOKENS · 速查

所有 token 的 SSOT 是 `tokens.css`。本文件是给开发的人类阅读速查；落地时**只引用 `tokens.css`** 中的 CSS 变量，不要重新硬编码颜色 / 字号。

---

## 1. 主题切换

通过 `<html data-theme="...">` 切换：

| 值 | 风格 | accent | 用途 |
|---|---|---|---|
| `warm`（默认 / 不带 attr） | 纸黄底 + 深棕墨 | `#3F7EF1` 蓝色 | 主答题界面 — 长时间阅读舒适 |
| `pure` | 纯白底 + 黑墨 | `#1F4FD8` 深蓝 | 高对比模式 |
| `night` | 夜读棕底 + 米色字 | `#D9A055` 暖金 | 夜间 |

> 行测答题原型当前实际用的 accent 朱红 `#B42318` 是从 `--bad` 借的，作为"做题状态/当前题"信号色。落地时建议为答题场景**独立定义** `--exam-accent`，避免与"错误"语义混淆。

---

## 2. 颜色

### Paper / Ink (warm)

| Token | Hex | 用途 |
|---|---|---|
| `--paper` | `#FAF7F0` | 页面底 |
| `--paper-2` | `#F4F0E6` | 当前题左渐变 / 卡片底 / 资料分析组底 |
| `--paper-3` | `#ECE6D7` | hover / focus 底 |
| `--rule` | `#E2DBC8` | 分隔线 / 卡片 border |
| `--rule-strong` | `#C9C0A8` | 重要边界 / 按钮 border |
| `--ink` | `#1A1815` | 正文标题 |
| `--ink-2` | `#3A352D` | 正文 |
| `--ink-3` | `#6B6358` | 次文 / icon |
| `--ink-4` | `#948A7A` | 占位 / disabled |

### 语义

| Token | Hex | 用途 |
|---|---|---|
| `--ok` / `--ok-bg` | `#4F7A4F` / `#E8EFE2` | 正确 / 通过 |
| `--warn` / `--warn-bg` | `#B47A1F` / `#F4ECDC` | 警示 |
| `--bad` / `--bad-bg` | `#B42318` / `#F5E6E2` | 错误 / **当前题朱红** |

---

## 3. 字体

| Token | Stack | 用途 |
|---|---|---|
| `--serif` | Source Serif 4 → Noto Serif SC → Georgia → Songti SC | **题干 / 选项中文 / 大标题** |
| `--sans` | Inter → system-ui | UI 按钮 / tooltip |
| `--mono` | JetBrains Mono → SFMono | 计时器 / 题号 / 选项 letter / 数字 |

字号尺度走 `--t-*`；答题正文用 `--read-fs` (15/17/19px 三档) + `--read-lh`，由 `data-reading` 切换。

---

## 4. 间距 / 圆角 / 阴影

```
--s1=4  --s2=8   --s3=12  --s4=16
--s5=24 --s6=32  --s7=48  --s8=64  --s9=96

--r-sm=4  --r-md=6  --r-lg=10  --r-xl=14   /* 纸质风 · 圆角克制 */

--shadow-1  细描边阴影（卡片浮起）
--shadow-2  弹层 / 抽屉
--shadow-3  全屏 modal
```

> 答题界面整体阴影使用克制，主要靠 `--rule` 边线与 `--paper-2` 底色区分层级。

---

## 5. Density / Reading

由⚙ 设置弹层控制，写到 `<html>`：

```
data-density="cozy|compact"  → --row-y / --card-pad
data-reading="md|lg|xl"      → --read-fs / --read-lh
data-opt-style="circle|square" → 选项 letter 形状
```

落地时这些控件状态需要写入用户配置，跨设备同步。
