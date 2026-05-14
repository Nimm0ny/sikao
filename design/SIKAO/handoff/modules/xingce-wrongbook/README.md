# 行测错题本 · 设计交接

**主文件**: `xingce-wrongbook.html`
**设计系统**: SIKAO（纸面、墨黑、暗朱单点 accent）
**布局容器**: design_canvas（4 张画板可拖拽对比 / 全屏聚焦）

---

## 1 · 视图清单

| # | 画板 | 组件名 | 尺寸 | 说明 |
|---|---|---|---|---|
| 1 | 主页 | `MainPage` | 1280 × auto | 续答 hero / 30 天 × 5 模块热图 / 三栏 standout（毕业候选·蒙对识破·AI周报）/ 筛选 / 列表 |
| 2 | 详情 A 纵堆 | `DetailA` | 1280 × auto | 错题告警条 + 三段 collapsible（题干/解析/同类）+ 右侧 sticky 知识点 |
| 3 | 详情 B 分栏 | `DetailB` | 1280 × 760 | 左题干右解析 tabs 切换 |
| 4 | 智能复盘 | `SmartReview` | 1280 × auto | 5 种推送模式卡 + 推送预览 |

---

## 2 · 设计 Tokens（`<style>:root`）

| 类 | 变量 | 用途 |
|---|---|---|
| 纸 | `--paper / --paper-2 / --paper-3` | 主背景 / 次级 / 强 |
| 墨 | `--ink / --ink-2 / --ink-3 / --ink-4` | 主文 / 次文 / 弱 / 极弱 |
| 朱 | `--accent / --accent-2 / --accent-50` | **限 ≤5 处状态信号**：热图今日 outline · 蒙对"19" · 蒙对 CTA · 列表 high-sev · 失分 chip dot |
| 数据 | `--data-0 .. --data-5` | 热图蓝色色阶（浅纸 → 深海军）|
| 反相 | `--on-ink / --on-ink-2` | 暗底卡（hero / AI 周报 / act-card）上的字色 |
| 状态 | `--ok / --warn / --err` + `-bg` | 已掌握 / 待复习 / 错误 |
| 字 | `--serif / --sans / --mono` | Source Serif 4 / Inter / JetBrains Mono |
| 圆角 | `--r-sm: 4px / --r-md: 6px` | 全局零至极小圆角 |

---

## 3 · 类型刻度

| 级别 | 字号 | 字族 | 用途 |
|---|---|---|---|
| H1 | 44 px / 600 | serif | 页头 |
| H3 | 22 px / 600 | serif | hero / 卡片标题 |
| body | 15 px / 400 | sans | 主文 |
| 数据大字 | 28–42 px / 600 | serif | 统计数字 / 蒙对"19" |
| eyebrow | 11 px / .18em uppercase | mono | 元信息标签 |
| chip / 状态 | 10 px / .14em uppercase | mono | 失分 / 状态徽 |

CJK 不可走 uppercase；筛选 `.fchip` 用 13 px / sans / 无 uppercase 变体。

---

## 4 · 组件契约

| 类 | 角色 | 状态 |
|---|---|---|
| `.btn` + `-primary / -secondary / -ghost / -accent / -sm` | 按钮 | hover 深背景 |
| `.stamp` | 暗朱圆点 + mono 元信息 | — |
| `.fchip` | 筛选标签（CJK 友好） | `.active` 墨底纸字 |
| `.row[data-sev=high/mid/low/ok]` | 列表项 + 左 8 px 严重度色条 | accent/warn/ink-4/ok |
| `.body .why` | 失分原因 dashed chip | `.ok` 变绿 |
| `.body .danger` | 高危标签（暗朱实底）| — |
| `.mast .dots` + `.d.on` | 掌握度 3 点指示 | — |
| `.mast .grad` | "已毕业"绿徽 | — |
| `.hg .cell[data-v=0..5]` | 热图单元格 | `.now` 红框 / `.peak` ink 三角刻痕 |
| `.so` + `.bluff / .aiwk / .gradc` | standout 卡 | bluff/aiwk 为特殊变体 |

---

## 5 · 状态模型

**列表行**
- `sev: high → mid → low → ok` 错频递减
- `repeat ≥3` → 加 `.rep`「重复 N 次」徽
- `mast: 0..3 dots` + `grad: true` → 显示"已毕业"

**热图**
- `heat[row][col]`：5 行 × 30 列，值域 0–5
- 当列 `c === 29` → `.now`（今日）
- 行内最大值且 `v ≥ 4` → `.peak`（峰值刻痕）

**蒙对识破**
- 触发条件：`耗时 > 均时 × 2` 且 答对 → AI 标记为蒙对
- 进入"蒙对盲测"流程后改色阶/状态可视化

---

## 6 · 响应式

`@media (max-width: 1280px)`：
- 页头网格坍缩为单列
- `.ov / .standout / .det-wrap / .psh` → 1 fr
- 热图列宽自适应 `minmax(20px, 1fr)`
- 列表 6 列宽收紧 + gap 16 px
- SmartReview 5 卡 → 2 列
- DetailB split → 单列、解除高度锁

---

## 7 · 已知 trade-off

1. **demo 数据混杂** — 列表 6 行包含 high/mid/low/ok 四种 sev，未与顶部"待重做"筛选联动，仅作展示。生产端需筛掉 ok 行。
2. **wkTick 横轴** — `-4w / -3w / -2w / -1w / 今` 仍使用 mono 字标记；CJK 化会导致字宽不齐。
3. **DetailA 进度环** stroke 用了写死 `#9B2F2F`，未走 token（svg 内联限制）。
4. **SmartReview 图例色阶** `#FAF7F0 → #9B2F2F` 渐变写死，作图例语言一部分保留。
5. **打字稿** — 全部为 React Babel 内联，未拆模块。如需迁移至 npm 项目，每个 `function XXX(){ return (...) }` 即一 React 组件。

---

## 8 · 后续工作建议

| 优先级 | 项 |
|---|---|
| P0 | 接入真实错题流（替换 `[...].map(r=>...)` 的硬编码数组）|
| P0 | "蒙对识破"判定阈值需产品/数据团队对齐（当前 2× 均时）|
| P1 | 错题本 ↔ 笔记本双向链接（参考 `essay-review-notes.html`）|
| P1 | 移动端单独切版（≤768 px 当前未覆盖）|
| P2 | 暗夜主题（tokens 已支持反相，需补 `[data-theme="night"]` 块）|
| P2 | 国际化（mono 元信息中英混排已就绪，但 chip CJK 需逐项审）|

---

## 9 · 关键文件

```
xingce-wrongbook.html        # 错题本主文件（4 画板）
xingce-list.html             # 题型/套卷选择（之前阶段）
essay-review-notes.html      # 笔记本 + 错题本反思双向（之前阶段）
HANDOFF.md                   # 本文档
```

---

_最后修订: 收敛 accent 至 ≤5 处状态信号、补 data-token 与响应式、清理 21 项 review 意见。_
