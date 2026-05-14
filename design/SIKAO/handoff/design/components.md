# Components Inventory

> 在 HTML 里搜 class 名 即可看到完整渲染。这里只列契约。

## ui/ (基础)
| Component | 用法 | HTML 锚点 |
|---|---|---|
| `Button` | variant: `primary` (黑底白字) / `secondary` (描边) / `ghost` / `accent` (暗朱) · size sm/md | `.btn` 系列 |
| `IconBtn` | 32×32 方形描边图标按钮，hover 变 paper-2 | `.icon-btn` |
| `Chip` | 小标签，可带 `tone="ok|warn|bad|accent"`，可 active | `.chip` `.tag` |
| `Stamp` | 印章式 metadata 横条 (uppercase mono + 暗朱小圆点) | `.stamp` |
| `Eyebrow` | mono 11px uppercase 0.18em letter-spacing | `.eyebrow` |
| `Mark` | logo 小方块 (黑底纸色字) | `.mark` |
| `Card` | 1px rule 描边 paper 底，无圆角默认。`tone="muted"` 时换 paper-2 | `.comp-card` |
| `Rail` | 左/右栏容器，1px 描边 + sticky | `.rail` `.left` `.right` |
| `MetricNumber` | serif tabular 数字大字，例：82.4 | `.score .num` |
| `ProgressRing` | SVG 圆环 + 中心数字 | `04 ai-skel .ring` |

## practice/ (行测)
| Component | 用法 | 锚点 |
|---|---|---|
| `FbTopbar` | 顶部 timer / title / 答题卡按钮 / 暂停 / 提交 | `.fb-top` (03/03b) |
| `FbCard` | 一道题的卡片（题干 + 选项 + 收藏/标记/笔记） | `.fb-card` |
| `FbOpt` | A/B/C/D 选项行（圆形字母 + 文本 + selected/correct/wrong 状态） | `.fb-opt` |
| `FbDock` | 底部浮动答题卡（35 个号码 + 提交） | `.fb-dock` |
| `FbPassage` | 题组共用材料（material 区块 + 高亮） | `.pg-passage` |
| `FbGroupTabs` | Q12-Q15 题组标签条（done/active/marked） | `.pg-tabs` |
| `AIBundle` | 03b 右栏：AI 三步骨架 + 你的画像 + AI 提问 | `.ai-skel` `.ai-portrait` `.ai-ask` |
| `Upsell` | 03 标准版底部"解锁 AI 解析"模糊预览 + 价格 | `.upsell-card` |

## essay/ (申论)
| Component | 用法 | 锚点 |
|---|---|---|
| `EssayGrid` | 申论双栏布局（1.1fr / 1fr） | `.essay-grid` |
| `MaterialPanel` | 左栏顶部：材料正文 · 划线短语带 ⋮⋮ grip · draggable | `.mat-block` `.hl[draggable]` |
| `ScratchPad` | 左栏底部：横线/格子纸 · 接受 drop · 已贴 clip + 自由便签 | `.scratch` `.scratch-clip` `.scratch-note` |
| `EditorPanel` | 右栏：题面 + 引用条 + 编辑器 + 字数 | `.essay-editor` `.cite-bar` |
| `MmStrip` | 04b 顶部：M1–M7 / Q1–Q4 标签条（均匀一行） | `.essay-mm-strip` |
| `DropMarker` | 拖拽到答题区时的虚线插入指示 | `.drop-marker` |

## dash/ (Dashboard / Plan)
| Component | 用法 | 锚点 |
|---|---|---|
| `MetricCard` | 大数字 + 副标 + 微图 | dashboard 顶部三联 |
| `PlanRow` | 今日任务行：时间 / 任务 / 状态 / 动作 | dashboard center |
| `AsideCard` | 右侧栏卡片：标题 + 列表 + 链接 | dashboard right |
| `CalWeek` | 7 天小日历，每日有进度点 | plan 顶部 |
| `WeakRow` | 薄弱模块条：名称 / 错题数 / 趋势条 | plan / wrongbook |

## result/ (报告)
| Component | 用法 | 锚点 |
|---|---|---|
| `ScoreHero` | 大分数 + 区间标记 + 用时 | `.score` |
| `BreakdownTable` | 模块/题型分项：完成 / 正确率 / 用时 / weak 高亮 | `.breakdown` |
| `EssayBreakdown` | 申论按 Q 的评分（结构 / 论据 / 文采 / 引用） | `.essay-res .grade-rows` |
| `AIThinking` | AI 的复盘段落 + 引用 + 推荐计划 | `.ai-think` |

## 不要做的
- 不要 lucide-react / heroicons — 自绘
- 不要 framer-motion 当全局依赖；过渡用 CSS transition 120ms
- 不要 shadcn — 直接从 HTML 把样式搬下来
