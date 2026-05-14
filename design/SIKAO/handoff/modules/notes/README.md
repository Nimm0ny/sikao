# Handoff: 笔记本（行测 + 申论跨领域） + 笔记捕获流程

## Overview
SIKAO 笔记本是**跨领域单一笔记池**，统一收录行测和申论两个学习域产生的所有笔记。模块包含：
- **笔记本主页 `/notes`** — 四类卡片盒（金句 / 方法论 / 反思 / 素材）+ source filter（全部 / 行测 / 申论）+ 标签云筛选 + 复习侧栏（今日 5 张 · 间隔重复）+ 考前冲刺模式
- **捕获流程 A** — 选中文本浮条（"看参考答案"场景，最低摩擦）
- **捕获流程 B** — 右侧抽屉（"看 AI 批改"场景，留住上下文，关联错题）
- **捕获流程 C** — 独立编辑器（主动整理，元数据 + 富文本 + AI 协写）

（错题本属于行测模块独立 view `modules/xingce-wrongbook/`，**不在本模块**。）

## Master decision: 跨领域单一笔记池

**用户决策 2026-05-11**：笔记本不再按学习域拆分，行测和申论共用同一 /notes 池子。

**4 维理由**：

| 维度 | 论证 |
|---|---|
| **用户价值（思考 USP）** | SIKAO 的核心是「让备考从刷题变成思考」。思考的产物（金句 / 方法论 / 反思 / 素材）跨领域共通——行测看到的逻辑技巧可能启发申论论证，申论积累的金句可能反哺行测言语理解。强行拆分破坏「思考连续性」。 |
| **数据 schema 统一** | NoteCard 类型 4 种（quote / method / reflect / material）在两个域语义一致；只差 `sourceDomain` 一个标签字段。两套独立 schema 是重复，单池 + filter 更经济。 |
| **入口分场景但落点统一** | 捕获入口可以分场景（行测做题页浮条 / 申论批改抽屉 / 独立编辑器），但落点统一进 `/notes`。用户心智简单：「我的笔记都在一个地方」，不需要记「这条金句是行测还是申论」。 |
| **未来扩展** | 未来加面试 / 公基模块时，复用同一 /notes 池子 + 新 `sourceDomain` 值，零结构改动；如果按域拆分，每加一个域就要复制一套笔记本，运维成本线性增长。 |

**实现层面**：source filter（全部 / 行测 / 申论）作为 `/notes` 主页顶部一级过滤维度，跟 TypeTabs（金句 / 方法论 / 反思 / 素材）正交并列，组合筛选用 AND。

## 行测捕获 spec 扩写（P0 outsource 给 xingce-exam 模块）

行测做题页 / 解析页的捕获入口设计（浮条 / 抽屉 / 编辑器三态触发点）**不在本 README 详写**，由 `modules/xingce-exam/SPEC.md` 补章节 "笔记捕获入口" 负责。

**契约边界**（本模块的唯一约束）：
- 捕获后数据落 `NoteCard`，`sourceDomain='xingce'`
- `source.kind='xingce-question'` 或 `'xingce-explanation'`
- `source.ref` 填行测题 ID（与申论的 paper ID / specialty ID 命名空间隔离）
- `attachedTo.xingceQuestionIds` 数组保存关联题列表
- 捕获到的 NoteCard 在 `/notes` 主页通过 source filter='行测' 即可筛出

申论侧的三种捕获场景（A 浮条 / B 抽屉 / C 编辑器）spec 仍在本 README 详写（见下文 Screens / Views 部分），因为申论本身没有独立的 exam 模块来 outsource。

## About the Design Files
`essay-review-notes.html` 是高保真设计参考稿（React + 原生 JSX，通过 design_canvas 呈现多板对照）。**文件名保留 essay- 前缀是历史原因**，实际设计内容已扩展为跨领域笔记本。
**不是直接上线的产品代码**——请按现有技术栈和组件库重写，复用项目已有的 `design/tokens.css` 和 `design/components.md` 契约。

## Fidelity
**高保真 (hifi)** — 颜色 / 字体 / 间距 / 半径 / 边线已对齐 SIKAO tokens；请像素级还原。

---

## Screens / Views

### 1. 笔记本主页  (`/notes`)

**Purpose** — 笔记四类合并视图 + 类型切换 + 标签/搜索/视图工具 + source filter + 右侧复习推送。

**Layout**
- main 最大宽 1200，padding 48 64 96
- 内容自上而下：PageHeader → SourceFilter → TypeTabs → Toolbar → TagCloud → Grid（`grid-template-columns: 1fr 280px`）
- 右栏：今日复习卡（暗色，stack 效果）+ 考前冲刺卡（待开启）

**Components**

#### SourceFilter `.nt-source-filter`（新增）
- 顶部 segmented control：全部 / 行测 / 申论
- 与 TypeTabs 正交并列（AND 过滤）
- mono 数字徽显示各 source 下的笔记总数
- active → ink 底 paper 字

#### TypeTabs `.nt-tabs`
- 5 等分横向 tab（全部/金句/方法论/反思/素材），1 px rule 分隔
- 单 tab 内：mono 编号 + serif 18px 标题 + mono 计数 + 12px 描述
- active → ink 底 paper 字
- 每类型用专属 `ctype` 左边线色：金句=暗朱 / 方法论=ink / 反思=warn 橙 / 素材=ok 绿

#### Toolbar `.nt-toolbar`
- 三列：搜索框（含 ⌘K 提示）/ 视图切换（网格·列表·时间线）/ "＋ 新建笔记" primary
- 搜索框 38 px 高，1 px rule，无圆角

#### TagCloud `.nt-tag`
- 24 px 高 mono chip，1 px rule，hover → 描边变 ink
- 标签后跟数字徽（10 px 半透）
- "+ N" 折叠后续

#### NoteCard `.ncard`
- 22 × 22 padding，1 px rule，3 px 左边线（ctype）
- 头：kind eyebrow（带 6 × 6 色块）+ sourceDomain mono 标记（行测/申论）+ ago mono
- 不同 type 不同 body：
  - **quote** — serif 17 px 引号体（暗朱大引号开头），padding-left 18
  - **method** — serif 17 px 加粗标题 + 三步骨架列表（mono 序号 + body 行）
  - **reflect** — serif 15 px ink-2 散文
  - **material** — grid `auto 1fr` 多行，左 key mono uppercase，右 body
- 脚：源 → 来源 mono（题号 + 位置）+ tag 列表（`#xxx`）
- hover → border-color ink，translateY -1 px

#### ReviewCard `.review-card`（右栏）
- 暗 ink 底，paper 字；右下暗金 radial（rgba(217,160,85,.16)）
- stack 三张卡片（z-1/2/3，scale 0.92/0.96/1，opacity .4/.7/1）
- 顶卡显示一张实例
- meta-row：1/5 · 左右键提示
- CTA：跳过 / 开始 5 张
- **跨域共享**：复习队列混合行测+申论笔记，按间隔重复算法统一排序

#### SprintCard `.sprint-card`
- paper 底 1 px rule
- 高频金句池 / 方法论卡片 / 建议每日 三行 mono 指标
- D-30 按钮禁态
- **跨域共享**：冲刺池子合并两域所有高频笔记

---

### 2. 捕获流程 A · 选中即存  (overlay over `/essay/papers/:id/answer` 及 `/practice/xingce/:id/explanation`)

**Purpose** — 用户在阅读参考答案 / 解析时划词 → 浮条立即出现。无需切走当前页面。

**Components**
- `.ans-pane` — 参考答案展示容器，paper 底，serif 15 px / line 1.85，含 `.hl`（暗朱 50 % 下划线 highlight）+ `.hl.sel`（选中态描边）
- `.cap-bar` — 浮条，ink 底，4 个按钮：
  - **存为金句**（primary，前置暗朱小圆点）
  - 加批注
  - 关联反思
  - 取消
- 下尖三角 ::after 指向选区
- 偏移 6 px above selection
- `.toast` — 右上 ink 暗黑 toast，"已存入金句库 · 查看 →"

**Behavior**
- 长按 / 拖选 → 计算选区 rect → 浮条 absolute 定位
- 自动识别类型（看答案/解析场景=金句）；用户可改
- 来源（题号 + 位置 + sourceDomain）自动写入
- AI 推荐 3 个 tag，可一键采纳
- toast 4 秒后淡出，"查看"跳转笔记本对应卡片

---

### 3. 捕获流程 B · 右侧抽屉  (overlay over `/essay/papers/:id/grading`)

**Purpose** — 看 AI 批改时右侧固定抽屉；默认在"反思"tab；关联题号、AI 反思角度、tag 都预填。

**Layout**
- `.cf-layout-2` — `1fr 380px` grid
- 左：批改 ans-pane，含 `mark.lose`（暗朱 dashed 下划线）+ `mark.gain`（绿）
- 右：`.drawer` — 380 px 固定宽，1 px ink 描边

**Drawer 组成**
- dhead：标题 + ×
- dtabs：金句 / 方法论 / 反思（默认）/ 素材
- 关联题目：`.qlink` 显示 #01 题号 + 标题 + 分数 pill
- AI 建议反思角度：chip-pick，默认勾选最严重失分维度
- 本次反思：textarea（最小 120 px，serif 14 px）
- 标签：chip-pick + "+ 新标签"
- footer：存为草稿 / 存入·关联错题

**Responsive**
- 屏宽 < 1100 px 时改为右侧浮层（可拖关闭），不挤压批改区
- 切换 tab 时 form 变形（金句 tab 是 1 行短输入 + 来源选择）

---

### 4. 捕获流程 C · 独立编辑器  (`/notes/new` · `/notes/:id/edit`)

**Purpose** — 不依赖做题/批改场景的主动整理；左侧固定元数据，右侧专注书写。

**Layout** — `.editor-frame` grid `280px 1fr`

**左栏 `.ed-side`（paper-2 底）**
- 笔记类型：4 格选择器（2 × 2），on 态 ink 底
- sourceDomain 选择：行测 / 申论 / 通用（手动整理）
- 挂载到题型：单 chip 显示当前选择
- 关联错题：可多选 `.link-q`，单条带 # 题号 + 标题 + × / ＋
- 标签：mixed mono chip + "＋ 添加"
- 可见性：仅自己 / 同组可见

**右栏 `.ed-main`**
- titlebar：左侧 ic + 类型标签 + 自动保存时间；右侧"存为模板 / 保存 ⌘S"
- title input：serif 30 px，无边线，光标可直接打字
- toolbar：B / I / U / H1 / H2 / 引用 / 列表 / 分隔 / 引错题 / 引金句 / + AI 协写
- body：serif 15 px / line 1.85；`.q` 块（暗朱左 3 px border + 斜体 17 px 加粗）作引用样式
- foot：字数 / 引用统计

**Behavior**
- 草稿自动保存（debounce 1.5 s）
- 关闭页面不丢；回到上次光标位
- "引错题"打开错题选择器；"引金句"打开金句选择器
- "AI 协写"按光标位置追加段落，可一键回退

---

## Interactions & Behavior

| 触发 | 行为 |
|---|---|
| SourceFilter 切换 | 筛选 grid 内卡片 = `card.sourceDomain === active`；active=all 显示全部，跟 TypeTabs AND 组合 |
| TypeTab 点击 | 筛选 grid 内卡片 = `card.type === active`；active=all 显示全部 |
| TagCloud chip 点击 | toggle active；多选时为 AND 过滤 |
| `.ncard` 点击 | 打开抽屉预览 / 进入编辑器编辑 |
| `.ncard:hover` | border-color → ink，translateY -1 |
| ReviewCard "开始 5 张" | 进入全屏 flashcard 模式；左/右键切卡 + 标记记住/没记住；队列跨域混合 |
| SprintCard | D-30 前 disabled；到期自动激活；池子跨域合并 |
| 流程 A 浮条按钮 | 立即保存 + toast；类型可改但默认为金句；sourceDomain 跟入口推断 |
| 流程 B 抽屉 tab | 切换时表单形态变化（反思=textarea / 金句=单行 + 来源 / 方法论=结构化步骤 / 素材=分类字段） |
| 流程 C "AI 协写" | 调用后段落追加，整段可一键回退 |

**Transitions** — 120 ms ease（hover、active、border）；抽屉 slide-in 200 ms cubic-bezier(.2,.7,.2,1)；toast fade 300 ms。

---

## State Management

```ts
type NoteType = 'quote' | 'method' | 'reflect' | 'material';
type SourceDomain = 'xingce' | 'essay';

type NoteCard = {
  id: string;
  type: NoteType;
  sourceDomain: SourceDomain;        // 笔记产生的学习域，跨域单池的标签字段
  body?: string;                     // quote / reflect
  method?: { title: string; steps: Array<[index:string, text:string]> };
  material?: { rows: Array<[key:string, value:string]> };
  source: {
    kind: 'paper' | 'specialty' | 'xingce-question' | 'xingce-explanation' | 'manual';
    ref: string;                     // paper ID / specialty ID / 行测题 ID
    quote?: string;
  };
  tags: string[];
  attachedTo?: {
    wrongAnswerIds?: string[];       // 申论错题关联
    questionTypeIds?: string[];      // 题型关联
    xingceQuestionIds?: string[];    // 行测题 ID 关联
  };
  createdAt: string;
  reviewedAt?: string;
  reviewCount: number;
  ease: number;                      // 间隔重复算法用
  visibility: 'self' | 'group';
};

type NotesPageVM = {
  totals: {
    total: number;
    byType: Record<NoteType, number>;
    bySource: Record<SourceDomain, number>;  // 跨域统计
    weekNew: number;
    todayReview: number;
    streak: number;                          // 跨域 streak 共享：行测+申论任一域产笔记都续 streak
  };
  filters: {
    typeTab: NoteType | 'all';
    sourceTab: SourceDomain | 'all';        // 新增 source filter 维度
    tags: string[];
    search: string;
    view: 'grid' | 'list' | 'timeline';
  };
  cards: NoteCard[];                        // 跨域单池
  reviewQueue: NoteCard[];                  // 今日 5 张，跨域混合
  sprint: { open: boolean; daysToExam: number; threshold: 30 };
};

type CaptureVM = {
  mode: 'inline-bar' | 'drawer' | 'editor';
  type: NoteType;
  sourceDomain: SourceDomain;               // 捕获入口推断
  source: { kind; ref; quote? };
  draft: Partial<NoteCard>;
  aiSuggested: { tags: string[]; angle?: string };
};
```

**跨域 streak 计算**：streak 按日维度计算，只要当日有任一域（行测 OR 申论）产生 ≥1 张新笔记即续 streak，跨域共享。

---

## Design Tokens — 从 `design/tokens.css` 引入；勿在组件内重定义

```
--paper / --paper-2 / --paper-3
--rule / --rule-strong
--ink / --ink-2 / --ink-3 / --ink-4
--accent #9B2F2F / --accent-2 / --accent-50
--ok / --warn / --err (+ -bg)
--serif / --sans / --mono
--t-h1 44 / --t-h3 22 / --t-h4 18 / --t-body 15 / --t-sm 13 / --t-cap 12 / --t-eyebrow 11
--s1..s8 (4/8/12/16/24/32/48/72)
--r-sm 4 / --r-md 6        (笔记本几乎不用 r-lg/r-xl)
```

各 NoteType 的 ctype 色与 head 圆点：
- quote → `--accent`
- method → `--ink`
- reflect → `--warn`
- material → `--ok`

主题：`<html data-theme="paper|pure|night">`。Night 模式下 ReviewCard 暗金 accent 直接用 `--accent`（已经是暗金）。

---

## Components Referenced (按 `design/components.md` 契约)
- **ui/Button** — primary / secondary / ghost / accent × sm / md
- **ui/Card** (`.ncard`) — 1 px rule paper 底 + ctype 左边线
- **ui/Stamp** — `.stamp` 暗朱小圆点 + mono uppercase
- **ui/Chip** — `.fchip` / `.nt-tag` / drawer `.c` 多个变体
- **ui/Textarea / ui/Input** — 1 px rule，paper-2 底，focus → paper 底 + ink 边
- **ui/Toast** — ink 底 paper 字，右上定位 4 s 自动消

新增组件（建议沉淀）：
- **SourceFilter**（跨域 segmented control，主页顶部）
- **CaptureBar**（浮条，A 用）
- **NoteDrawer**（B 用，含 tab 切换）
- **NoteEditor**（C 用）
- **ReviewStack**（三层叠卡，复习侧栏）
- **NoteCard**（四种 type 渲染分支 + sourceDomain mono 标记）

---

## Assets
- Google Fonts: Source Serif 4 / Inter / JetBrains Mono / Noto Serif SC
- 全 SVG 自绘（搜索 icon、checkbox tick、箭头）；无 icon 库依赖

---

## Files in this bundle
- `essay-review-notes.html` — 设计参考稿（5 artboards on design canvas，文件名保留 essay- 前缀是历史原因，实际跨领域）
- `design-canvas.jsx` — canvas runtime（仅为预览，落地实现不需要）
- `README.md` — 本文档
