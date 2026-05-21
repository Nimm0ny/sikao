# Frontend IA · V2 Wiring 讨论稿

> Status: **DRAFT — Pending Decisions**
> Owner: master
> Scope: V2 后端登录后的 Web "主 app" 信息架构。Marketing / Health / NotFound 不在内。
> Goal: 在动代码之前，把"几屏、每屏长什么样、卡片去哪/能不能改"全部摊开讨论清楚再实施。
> 范围限定：本文不涉及任何视觉元素（颜色 / 排版 / 间距 / 图标），只定功能结构与交互边界。

> **落地文档**：本文是 IA 决策 SSOT。具体每个一级导航 / 层的落地实施 plan 见 [`Phase/`](./Phase/README.md) 子目录。
>
> | Phase | Status |
> |---|---|
> | [Phase/Home](./Phase/Home/README.md)（首页 tab） | ACCEPTED · 详细规格完成（11 子文档 / 80 PR） |
> | Phase/Practice/Review/Notes/Profile（其他 4 tab） | TBD（占位 README） |
> | Phase/Auth/Onboarding/Marketing（3 个 layer） | TBD（占位 README） |

---

## 0. 用户路径分层（先约定 4 个壳）

整个 web 运行时分 4 个壳，下文一级导航只指 ③。

| 层 | 角色 | 包含 view | 显示导航 |
|---|---|---|---|
| ① Public | 未登录访客 | marketing 12 个、Health、NotFound | 顶部公开 nav |
| ② Auth | 注册登录流 | Login / RegisterEmail / RegisterPhone / ForgotPassword / ResetPassword | 无导航，单屏 |
| ③ Main App | 已登录 + bootstrap.canStartPractice=true | 见下文一级导航 | RailMini（桌面）/ TabBar（移动） |
| ④ Onboarding/Diagnosis Gate | 已登录 + canStartPractice=false | study/Onboarding、study/DiagnosisResult | 无导航，强制流程 |

**决策点 D-Layer**：登录后是先跳 Main App ③ 还是先跳 Gate ④？根据当前 `OnboardingGate.tsx`，是 Gate 优先。需要确认这个逻辑保留。

---

## 1. 一级导航候选

V2 后端共 6 个用户向模块（identity/planning/progress/record/content/session/review/notes/profile，其中 progress 与 record 都长在 dashboard 下）。可以映射出 3 套一级导航方案：

### 方案 A · 5 tab（推荐，与 V2 模块 1:1 对齐最干净）

| # | tab | 路由 | 对应 V2 模块 |
|---|---|---|---|
| 1 | 首页 | `/` | planning + progress + record（envelope 聚合） |
| 2 | 练习 | `/practice` | content + session 入口 |
| 3 | 复盘 | `/review` | review |
| 4 | 笔记 | `/notes` | notes_v2 |
| 5 | 我的 | `/profile` | profile_v2 + identity（登出） |

### 方案 B · 4 tab（合并复盘进练习）

| # | tab | 路由 | 备注 |
|---|---|---|---|
| 1 | 首页 | `/` | 同 A |
| 2 | 练习 | `/practice` | 顶部 segment：题库 / 错题复盘 |
| 3 | 笔记 | `/notes` | 同 A |
| 4 | 我的 | `/profile` | 同 A |

### 方案 C · 3 tab（极简）

| # | tab | 路由 | 备注 |
|---|---|---|---|
| 1 | 学习 | `/` | 顶部 segment：今日 / 题库 / 复盘 |
| 2 | 笔记 | `/notes` | |
| 3 | 我的 | `/profile` | |

### 方案对比

| 维度 | A | B | C |
|---|---|---|---|
| 信息密度 | 中 | 高 | 高 |
| 路径深度 | 浅 | 中 | 深 |
| 与 V2 后端对齐 | 完美 | 良好 | 差 |
| 移动 TabBar 拥挤度 | 5 个边缘可接受 | 舒适 | 太宽松 |
| 学习曲线 | 低（每件事一个 tab） | 中（要学 segment） | 高（要学双层 segment） |

**决策点 D1**：选 A / B / C？倾向 A，下文都按 A 展开；改方案后重写。

---

## 2. 每个 tab 的内容（按方案 A 展开）

每屏列：
- 包含的卡片/区块
- 每个卡片是否能跳转（→ 路由）
- 每个卡片是否能"设置/自定义"（用户可改）
- 每个卡片的内容来源（V2 endpoint）

---

### Tab 1 · 首页 `/`

最复杂的一屏，因为它聚合了 5 个 V2 endpoint，并且涉及"自定义"。

#### 2.1.1 区块清单（默认顺序）

| 区块 | 来源 | 跳转 | 可自定义？ |
|---|---|---|---|
| ① 顶部问候条 | bootstrap.user + profile.overview.name | 点头像→`/profile` | 否 |
| ② 学习指标摘要（4 格 metrics） | `dashboard/overview.summary[]` | metric 不跳；右上"详情"→`/progress` 或滚到下方 | 否 |
| ③ 今日任务 | `dashboard/today` | 任务卡→对应练习 session | **是**（布局可选） |
| ④ 本周计划 | `dashboard/weekly-plan` | 卡→今日；点目标→可改目标 | **是**（视图可选 + 目标可改） |
| ⑤ 学情速览（趋势 + 弱项） | `dashboard/progress`（取前 N） | 整卡→`/progress`（如保留）或滚动 | 是（隐藏） |
| ⑥ 最近记录 | `dashboard/records`（取前 5） | 单条→该次 result；查看全部→records 入口 | 是（隐藏） |
| ⑦ 快捷入口（Action 行） | `dashboard/overview.actions[]` | 各跳对应路由 | 是（顺序） |

> **stub 期注意**：planning + progress 全 stub。在 stub 期 ②③④⑤ 都会拿到空 envelope 或固定占位。所以这一屏的"骨架"必须容忍空数据。这正是 envelope renderer 的价值（详见第 3 节）。

---

#### 2.1.2 ③ "今日任务"区块的布局选项

V2 `dashboard/today` 给的是 `OverviewResponseV2`（summary + sections + actions），并且有 3 个细分子端点（`/today/must-do` `/today/continue` `/today/review`），可以聚合也可以分组渲染。

| 选项 | 描述 | 后端契合 | 复杂度 |
|---|---|---|---|
| **L1 单列时间轴** | 今天所有任务垂直流，每条带 type tag（必做/继续/复盘） | 直接消费 `today` envelope | ★ |
| **L2 三段卡** | 上下三段："必做 / 继续 / 复盘"各一卡，分别拉 3 个子端点 | 拉 3 次 | ★★ |
| **L3 7 天横向胶囊** | 顶部一行胶囊（昨/今/明...今天高亮），点胶囊换日；下面渲染当日任务 | today 是今天，其他天 V2 暂没接口 → 其他天显空 | ★★★ |
| **L4 月历画廊** | 月历视图，有任务的日期点圆点；点日 → 任务列表 | 同 L3，需要每日聚合接口（V2 没有） | ★★★★ |
| **L5 番茄钟+任务** | 顶部番茄计时器，下面"下一项任务" | 不需要日期切换 | ★★ |

| 维度 | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| stub 期可用性 | ✅ | ✅ | 🟡（其他日空） | ❌ | ✅ |
| 数据请求成本 | 1 | 3 | 1（只请求今天） | N | 1 |
| 能拓展"自定义" | 难 | ✅ 可隐藏段 | ✅ 选默认日 | ✅ | 难 |
| 与移动端贴合度 | ✅ | ✅ | ✅ | 🟡 | ✅ |
| 推荐度 | 中 | **高** | 中 | 低 | 低 |

**决策点 D2**：今日任务采用 L1 / L2 / L3 / L4 / L5？推荐 **L2 三段卡**（与 V2 三个细分端点 1:1 + 容错好）。如想"日历画廊"必须先在 V2 后端补一个 `/dashboard/days?from=&to=` 聚合接口，否则 L3/L4 是无源之水。

---

#### 2.1.3 ④ 本周计划的布局选项

V2 `dashboard/weekly-plan` 有 4 个端点：overview、`/goal`、`/today-completion`、`/adjust`。

| 选项 | 描述 |
|---|---|
| **W1 周环形进度** | 大圆环显示本周达成率，下方一行 7 天小圆点 |
| **W2 7 天柱状图** | 横向 7 柱，每柱代表当日完成度，今天高亮 |
| **W3 目标卡 + 调整 CTA** | 单卡显示"本周目标 X 题/Y 篇"，右下角"调整目标"按钮（弹窗用 `/goal` 与 `/adjust`） |
| **W4 W1+W3 组合** | 上半进度可视化，下半目标 + 调整按钮 |

**决策点 D3**：周计划用 W1 / W2 / W3 / W4？倾向 **W4**（既可视化又可操作）。

---

#### 2.1.4 首页"自定义"语义（必须先定义清楚）

"自定义"在前端可以指 4 种不同能力，颗粒度差很大：

| 能力 | 实现成本 | 是否需要后端 |
|---|---|---|
| **C1 区块顺序拖拽** | ★★★ | 需要存到 profile_v2.info（或 localStorage） |
| **C2 区块显示/隐藏** | ★★ | 同 C1 |
| **C3 任务列表筛选**（按 tag/题型/时长） | ★★ | 不需要（前端过滤） |
| **C4 目标参数可调**（每天 X 题、Y 分钟） | ★★ | profile_v2.goals.PUT（已就绪） |
| **C5 默认入口/快捷动作可改** | ★★ | localStorage 即可 |

**决策点 D4**：首页要支持 C1~C5 的哪些？倾向 Phase 1 只做 **C2 + C4**（隐藏 + 目标参数），C1/C3/C5 列入 Phase 2 backlog。

**决策点 D5**：自定义偏好存哪？
- 选项 X：localStorage（隔设备）
- 选项 Y：`profile_v2.info` 加一个 `dashboardPreferences` 字段（跨设备）
- 选项 Z：localStorage 即时 + 异步同步到后端

倾向 **Y**（profile_v2.info 已有 PUT 通道，存进去同步好）。

---

### Tab 2 · 练习 `/practice`

#### 2.2.1 屏面结构

| 区块 | 来源 | 跳转 | 可自定义？ |
|---|---|---|---|
| ① 顶部 segment：行测 / 申论 | 本地 state | 切 segment 改路由 query | 否 |
| ② 主体（按 segment 切换） | content 模块 | 见下 | 否 |
| ③ 底部"继续上次练习" | 取 `dashboard/today/continue` 第一条 | →恢复 session | 否 |

#### 2.2.2 主体布局选项

V2 给了 `/practice/center`（envelope，含 SectionCardV2）+ `/{xingce|essay}/{categories|papers}`（4 个空 catalog）。

| 选项 | 描述 | stub 期表现 |
|---|---|---|
| **P1 双卡入口**（"分类练习" / "整卷练习"两个大卡） | 进卡后再分页选 categories/papers | catalog 空 → 每个分页空状态 |
| **P2 双 segment**（顶部"分类 / 整卷" + 列表） | 列表页 | 空状态 |
| **P3 树状导航**（左 categories 树 / 右 papers 列表） | 桌面友好 | 树空 |

**决策点 D6**：P1 / P2 / P3？移动端 P1 最舒服，桌面 P3 最高密度。如果想统一一种，**P2** 折中（移动 + 桌面都过得去）。

#### 2.2.3 答题闭环路由（不在 tab 内）

| 路由 | 屏 | 是否走出 tab 壳？ |
|---|---|---|
| `/practice/sessions/:id` | PracticeSession（答题） | **是**，全屏，隐藏 RailMini/TabBar |
| `/practice/sessions/:id/result` | Result | 是，全屏 |

**决策点 D7**：答题中是否完全脱离主导航壳？倾向 **是**（避免误触退出）。

---

### Tab 3 · 复盘 `/review`

#### 2.3.1 屏面结构

| 区块 | 来源 | 跳转 | 可自定义？ |
|---|---|---|---|
| ① 顶部 metrics 摘要（错题总数/今日待复盘） | `review/items` 聚合 + `review/smart` summary | 否 | 否 |
| ② 顶部 segment：错题 / 智能复盘 | 本地 state | 切 segment | 否 |
| ③ 主体（按 segment 切） | review 模块 | 见下 | 否 |

#### 2.3.2 「错题」segment 布局选项

| 选项 | 描述 | 适合 |
|---|---|---|
| **R1 列表** | 一行一题，标题 + tag + 重做按钮 | 默认推荐 |
| **R2 卡片堆/Anki** | 居中卡片，左/右滑 = 跳过/重做 | 沉浸复盘 |
| **R3 双列网格** | 桌面密度更高 | 桌面优先 |

V2 review.list 的 item 只有 `id/title/href/kind`（没有更多元数据），R2 体验不出优势 → **R1**。

#### 2.3.3 「智能复盘」segment 布局

V2 `/review/smart` 是单一 envelope，无法支持原"5-mode 智能复盘"。两条路：

- **S-front**：前端用 record + session.result 数据本地聚合（哪些题最近错了、错过几次）→ 列表
- **S-stub**：直接渲染 envelope，等后端补真接口

**决策点 D8**：智能复盘用 S-front / S-stub？推荐 **S-front**（体验差距太大不能等）。

#### 2.3.4 「错题详情/重做」路由

| 路由 | 屏 |
|---|---|
| `/review/items/:id` | WrongQuestionDetail（题面 + 历史答题 + 笔记入口） |
| `/review/items/:id/redo` | 走入 session 模块（建一个 single-question session） |

**决策点 D9**：重做是新建一个 `session.create({question_ids: [id]})` 走完整 session 流？还是单独的轻量重做 view？倾向 **走完整 session**（统一答题闭环，少一套代码）。

---

### Tab 4 · 笔记 `/notes`

#### 2.4.1 屏面结构

| 区块 | 来源 | 跳转 | 可自定义？ |
|---|---|---|---|
| ① 顶部搜索框 + "新建" | 本地 + notes.POST | →NoteEditor | 否 |
| ② 笔记列表 | `notes`（list） | 单条→`/notes/:id` | 是（排序） |

#### 2.4.2 列表布局选项

| 选项 | 描述 |
|---|---|
| **N1 单列文本列表**（标题 + 摘要 + 时间） | 默认 |
| **N2 双列网格**（标题 + 摘要） | 桌面密度高 |
| **N3 文件夹/标签树**（左侧 + 右列表） | V2 没暴露 folder/tag 字段，做不到 |
| **N4 Kanban**（按状态分列） | V2 笔记无 status 字段，做不到 |

**结论**：只能 **N1**（移动）或 **N2**（桌面）。建议 **N1 默认 + 桌面响应到 N2**。

#### 2.4.3 笔记编辑器

`/notes/:id` 单屏全屏编辑（不在 tab 内），保存即 PUT，离开页 dirty 提示。

**决策点 D10**：编辑器富文本到什么程度？V2 NoteV2 model 只有 title + body（推测纯文本/markdown）。建议 **markdown 文本框 + 简易预览**，不上 lexical/prosemirror（V2 没字段支持）。

---

### Tab 5 · 我的 `/profile`

V2 profile_v2 有 4 子页（overview/security/goals/info），决策："一屏长滚动" vs "1 + 3 子路由"。

#### 2.5.1 选项 M-One · 单屏长滚动

```
/profile
├─ 用户卡（overview）
├─ 学习目标（goals + 编辑）
├─ 个人信息（info + 编辑）
├─ 账号安全（security + 改密 / 绑定邮箱 / 绑定手机）
├─ 偏好设置（C1~C5 自定义入口）
└─ 退出登录
```

#### 2.5.2 选项 M-Multi · 概览 + 3 子路由

```
/profile           概览（4 卡：目标/信息/安全/偏好），每卡点击 → 子路由
/profile/goals     学习目标编辑
/profile/info      个人信息编辑
/profile/security  账号安全（改密 / 绑邮箱 / 绑手机 / 验证码 + 完成资料）
```

| 维度 | M-One | M-Multi |
|---|---|---|
| 移动易用 | 长滚动累 | ✅ 单页轻 |
| 桌面易用 | ✅ 一览 | 多次跳 |
| 实现成本 | 单 view | 4 view |
| Bind/Complete 收编 | 内嵌段 | `/profile/security` 子流程 |

**决策点 D11**：M-One / M-Multi？倾向 **M-Multi**（与"4 子页 4 endpoint"自然 1:1，且把 BindEmail/BindPhone/CompleteProfile 收编进 `/profile/security` 干净）。

---

## 3. 跨 view 的复用模式

### 3.1 Envelope 渲染器（关键）

V2 的 5 个 stub 端点（planning/progress + content catalogs + review.smart）都返 `OverviewResponseV2`。需要统一 3 个组件：

| 组件 | 渲染 |
|---|---|
| `<SummaryRow>` | summary[] 横排 metric |
| `<SectionList>` | sections[] 卡片堆叠（每卡可含 list/link/text） |
| `<ActionBar>` | actions[] CTA 行 |

**决策点 D12**：是否同意把这 3 个 envelope 组件作为"标准空容器协议"？

### 3.2 设置入口位置

每屏多多少少有 1-2 个"设置"按钮（自定义、目标编辑、偏好），三种放法：

- **G1 屏内点击直接 inline 编辑**（适合 goals 编辑）
- **G2 右上角齿轮 → 弹窗/抽屉**（适合首页自定义、笔记排序）
- **G3 跳到 `/profile/*`**（适合一次性配置）

**决策点 D13**：默认走哪种？倾向 **混用**：高频 inline（G1）、中频抽屉（G2）、低频跳 profile（G3）。

### 3.3 空状态/Stub 状态

stub 期 5 个模块要展示"等后端"或"暂无数据"，定一个统一组件 `<EmptySection title icon hint cta?>`。

**决策点 D14**：是否同意统一这一个组件？

### 3.4 全屏沉浸路由（脱壳）

下列路由完全脱出 tab 壳，全屏：

- `/practice/sessions/:id`（答题）
- `/practice/sessions/:id/result`（结果）
- `/notes/:id`（编辑）
- `/review/items/:id/redo`（同 session）

**决策点 D15**：是否同意脱壳清单就这 4 条？

---

## 4. 总览图（方案 A + 默认推荐合集）

```
壳 ① Public:    /, /features, /pricing, /faq, /invite, /health, /404
壳 ② Auth:      /login, /register/email, /register/phone, /forgot, /reset
壳 ④ Gate:      /onboarding, /diagnosis
壳 ③ Main App (5 tab):

    /                       首页
        ├─ ① 问候条
        ├─ ② 4 metric 摘要
        ├─ ③ 今日任务（L2 三段卡）
        ├─ ④ 本周计划（W4 圆环+目标可调）
        ├─ ⑤ 学情速览（小卡 → /progress？此处 progress 已合并入首页）
        ├─ ⑥ 最近记录（小列表 → /profile 或独立 records 页）
        └─ ⑦ 快捷入口
        右上齿轮 → 自定义抽屉（C2 隐藏 + C4 目标）

    /practice               练习中心（segment：行测/申论；P2 列表）
    /practice/sessions/:id            ★ 全屏脱壳
    /practice/sessions/:id/result     ★ 全屏脱壳

    /review                 复盘（segment：错题/智能；R1 列表 + S-front 本地聚合）
    /review/items/:id       错题详情
    /review/items/:id/redo  → session 模块

    /notes                  笔记（N1 单列 + 搜索）
    /notes/:id              ★ 全屏脱壳，markdown 编辑

    /profile                个人中心（M-Multi 概览）
    /profile/goals          目标编辑
    /profile/info           信息编辑
    /profile/security       安全（含 Bind/Complete 收编）
```

> 注意：在方案 A 下，因为首页已经塞入 metrics + progress 速览 + records 速览，**不再需要独立 `/progress` 和 `/records` tab**。如果发现首页太重，可以把 records 升为顶部 RailMini 的次级条目（不在 tab 中），但移动端就会有点尴尬。

**决策点 D16**：是否同意"不独立 progress/records tab，全部聚合进首页"？还是想把 records 提到一个独立路由？

---

## 5. 决策清单

拍板这 16 项就能进 Phase 2。

| # | 决策 | 推荐 |
|---|---|---|
| **D-Layer** | 登录后 Gate 优先于 Main App | 是 |
| **D1** | 一级导航 5/4/3 | A 方案 5 tab |
| **D2** | 今日任务布局 L1-L5 | L2 三段卡 |
| **D3** | 本周计划布局 W1-W4 | W4 圆环+目标可调 |
| **D4** | 自定义能力范围 C1-C5 | 只做 C2 + C4 |
| **D5** | 自定义偏好存哪 | profile_v2.info.dashboardPreferences |
| **D6** | 练习中心布局 P1-P3 | P2 双 segment + 列表 |
| **D7** | 答题/结果是否脱壳 | 是 |
| **D8** | 智能复盘做法 | S-front 本地聚合 |
| **D9** | 错题重做实现 | 复用 session 单题模式 |
| **D10** | 笔记编辑器 | markdown 文本框 + 预览 |
| **D11** | profile 单屏 vs 子路由 | M-Multi 4 路由 |
| **D12** | envelope 3 组件标准化 | 是 |
| **D13** | 设置入口策略 | G1+G2+G3 混用 |
| **D14** | 空状态统一组件 | 是 |
| **D15** | 脱壳路由 4 条 | 是 |
| **D16** | progress/records 独立 vs 合并首页 | 合并进首页（保留独立的 records 升级口） |

---

## 6. 下一步

拍板上述决策点后：

1. 把本文 Status 从 DRAFT 改成 ACCEPTED 并冻结。
2. 写 ADR-0006（envelope renderer 作为 stub 期标准空容器协议）。
3. 进入 Phase 2 PR-A（systemQueries + bootstrap store + main.tsx wire），按本文 IA 落地。

在决策未确认之前，runner 不动 view / router 任何代码。
