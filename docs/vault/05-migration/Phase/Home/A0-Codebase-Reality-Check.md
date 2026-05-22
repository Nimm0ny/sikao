# Phase-Home · A0 · Codebase Reality Check

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **目的**：在动手前把现有代码库的真实状态摊开，避免下游 WU 文档（写于 IA 决策稿之上）撞到代码现实。
> **必读对象**：所有 Home Phase 的 PR agent。开工前必读，比 00-Decisions 更前置。

---

## 0. 为什么有这份文档

03/04/05 等 WU 文档基于 [Frontend-IA-V2.md](../../Frontend-IA-V2.md) 决策稿编写，决策稿描述的是**目标态**。本文记录**当前态**与**目标态的 delta**，让 PR 拆分能正确估算工作量。

下游文档（00~10）若与本文冲突，**以本文为准**；本文 §11 给出受影响章节的精确修订指引。

---

## 0.1 2026-05-22 Restart Baseline Addendum

Home 前端 runtime 轨已被显式重启，`M7 / SIK-38`、`M8 / SIK-39`、`M9 / SIK-40` 与 `M10 / SIK-41` 已在 `main` 上落地。

当前阶段的约束固定为：

- 已完成 `@sikao/api-client` canonical Home queries、`@sikao/domain` Home stores、`@sikao/calendar-engine`、Section A runtime、Section B / Section C 与 `/profile/learning`。
- 仍不做 5-tab、`/profile/records`、root-route convergence 与 legacy redirect cleanup。

同时需要把以下现实作为新的前置真相：

- `"/"` 仍是 marketing + authed redirect。
- `"/dashboard"` 已是 authenticated Home runtime host，`"/plan"` alias 到同一入口。
- `TabBar.tsx` 与 `RailMini.tsx` 仍是 4 tab，且 `/me` 仍然未注册。
- `apps/web/src/views/Plan.tsx` 与 `apps/web/src/views/study/StudyToday.tsx` 已不存在。

因此，本文后文凡是把 `/dashboard` 仍当作旧“学情页”或把 `Plan.tsx`、`StudyToday.tsx` 当作仍然存在的迁移目标，都只能视为历史 WU 假设，不能再作为当前实现入口。
---

## 1. 一级导航现状（关键修订）

### 1.1 当前 = 4 tab，不是 5 tab

`apps/web/src/layouts/TabBar.tsx`：

```ts
const TABS = [
  { to: '/study/today',   label: '首页' },
  { to: '/practice/center', label: '练习' },
  { to: '/wrong-book',    label: '错题' },
  { to: '/me',            label: '我的' },   // /me 路由实际未注册（bug）
] as const;
// 不可扩 · 超过 4 个 = 砍 (Handoff §3.3 铁线)
```

`apps/web/src/layouts/RailMini.tsx` 同样 4 项，testid 一致。

### 1.2 目标 = 5 tab

[Frontend-IA-V2 方案 A](../../Frontend-IA-V2.md#方案-a-5-tab推荐与-v2-模块-11-对齐最干净) + 用户 2026-05-21 拍板：

```
首页 / 练习 / 复盘 / 笔记 / 我的
/    /practice  /review  /notes  /profile
```

### 1.3 真实迁移工作（替换 04-Frontend-WU §F7.2）

| 项 | 当前 | 目标 | 动作 |
|---|---|---|---|
| 首页 tab 路由 | `/study/today` → `Navigate('/dashboard')` | `/` | 路径 rename + redirect 老路径 |
| 首页 tab label | "首页" | "首页" | 无 |
| 练习 tab 路由 | `/practice/center` | `/practice` | rename + redirect 子路径 |
| 复盘 tab 路由 | `/wrong-book` | `/review` | rename + 大量子路径 redirect（`/wrong-book/smart-review` → `/review/smart` 等） |
| 复盘 tab label | "错题" | "复盘" | rename |
| 笔记 tab | **无导航入口**（路由 `/notes` 已实现） | tab 第 4 位 | TabBar/RailMini 新增条目 |
| 我的 tab 路由 | `/me`（未注册，bug） | `/profile` | 修 bug + 与 `/profile` 合并 |
| TabBar 注释"超过 4 = 砍" | 在 | 改"超过 5 = 砍" | sed 改注释 |

涉及组件：`TabBar.tsx` / `RailMini.tsx` + `router/index.tsx` 路由表 + 各被 rename 路径下的 view import 改名 + `lib/ui-copy/` 中相关文案 + 测试 fixture。

工作量：约 3 PR（原 plan 1 PR），合计 ~700 行（不含 redirect 老路径的清理）。

### 1.4 受牵连的子路由 redirect 清单

`/wrong-book` 整族需要迁移：

```
/wrong-book                   → /review
/wrong-book/smart-review      → /review/smart
/wrong-book/:questionId       → /review/items/:questionId
/wrong-book/:questionId/redo  → /review/items/:questionId/redo
```

`/practice/center` 整族需要迁移：

```
/practice/center                          → /practice
/practice/center/xingce/categories        → /practice/xingce/categories
/practice/center/xingce/papers            → /practice/xingce/papers
/practice/center/essay/categories         → /practice/essay/categories
/practice/center/essay/papers             → /practice/essay/papers
/papers                                   → /practice/xingce/papers（已有 redirect）
/categories                               → /practice/xingce/categories（已有）
/xingce/specialty                         → /practice/xingce/categories（已有）
```

`/study/today` 与 `/dashboard`：

```
/study/today    → /
/dashboard      → /profile/learning（旧"学情"页迁移到我的子页）
                  注：/dashboard 此前是"学情数据"页（router 注释明确说明）
                  迁移后 pages.dashboard view 文件迁移到 ProfileLearning.tsx
```

`/me`（未注册修 bug）：

```
/me             → /profile（bug fix，先建 redirect）
```

---

## 2. 后端模块现状

### 2.1 db/models 是单文件

```
services/api/src/sikao_api/db/models_v2.py     ← 全部 V2 模型集中此文件
```

不存在 `db/models/` 目录。下游文档中所有"`db/models/plan_v2.py`"等路径均为**逻辑命名**，**实际实现 = 在 `db/models_v2.py` 中追加新 class**。

### 2.2 现有 V2 模型清单（grep 自 models_v2.py）

```
UserV2 / PasswordCredentialV2 / EmailContactV2 / PhoneContactV2 / AuthSessionV2 / VerificationTokenV2
PaperV2 / PaperRevisionV2 / PaperSectionV2 / PaperBlockV2 / MaterialGroupV2 / MaterialGroupAssetV2
QuestionV2 / QuestionOptionV2 / QuestionAssetV2
PracticeSessionV2 / PracticeSessionAnswerV2
EssayDraftV2 / EssaySubmissionV2 / EssayReportV2
DailyPlanV2 / DailyPlanItemV2 / WeeklyPlanV2          ← 待 drop（B1.5）
DiagnosisReportV2
ProgressSnapshotV2 / WeaknessSnapshotV2
ReviewItemV2 / ReviewAttemptV2
NoteV2 / NoteLinkV2
ProfileInfoV2 / ProfileGoalV2
```

新增模型（PlanV2 / PlanEventV2 / PlanAdjustmentV2 / RecommendationV2 / RecommendationFeedbackV2 / IdempotencyKeyV2 / LlmCallV2 / AuditLogV2）追加到本文件末尾，按 02-Data-Model.md 字段定义。

### 2.3 `DailyPlanV2 / WeeklyPlanV2` 的引用面（B1.5 cleanup 范围）

```
services/api/src/sikao_api/modules/record/application/service.py
services/api/src/sikao_api/modules/session/application/service.py
```

仅这两处引用。B5.1 cleanup PR 删完即可 drop。

### 2.4 现有 `modules/llm/` 已含真实代码（重大）

下游 05-LLM-Module / 06-LLM-Prompts / 03-Backend-WU 提到"新建 `modules/llm_v2/`"是**错误**，应改为**扩展现有 `modules/llm/`**。

现有结构：

```
modules/llm/
  application/
    llm/
      _stub.py                      ← 有 stub fallback
      byom_config.py                ← BYOM（Bring Your Own Model）配置
      conversations.py              ← 对话历史持久化（用于 Onboarding/Diagnosis）
      json_parser.py                ← LLM JSON 输出 parser
      openai_compatible.py          ← 用 httpx 直接调 OpenAI 兼容接口（不用 openai SDK）
      pricing.py                    ← cost / token 计算
      prompts/
        __init__.py
        _shared.py
        essay_grading.py            ← 申论批改 prompt（已存在）
        qa.py                       ← 问答 prompt
        study_plan.py               ← AI 制定学习计划 prompt（已存在）
      provider.py                   ← LLMMessage / ChatCompletion 等 dataclass
```

### 2.5 现有 LLM 模块设计要点（必须沿用）

1. **httpx 直调，不用 openai SDK**。原因：BYOM 用户接老 OpenAI proxy / 早期 vLLM build 时，openai SDK 行为不一致。下游 plan 中"使用 openai Python SDK"的描述应改为"沿用现有 httpx-based OpenAICompatibleProvider"。

2. **已支持 BYOM**：用户可在前端 settings 配置自己的 base_url + api_key（不是仅系统 default）。下游 plan 中"DeepSeek 官方 + 阿里百炼双支持"应表达为"在现有 BYOM provider 抽象基础上增加 system 默认 provider 池（DeepSeek/百炼）"。

3. **prompts/study_plan.py 已存在**，是为旧 DailyPlan/WeeklyPlan 服务的。Phase-Home 的 plan_generate prompt 是新一代（输出 PlanEventV2[]），**不直接 evolve study_plan.py**：
   - 旧 study_plan.py：保留至 B5.1 cleanup，与 DailyPlan/WeeklyPlan 一起删
   - 新 plan_generate prompt：在 prompts/ 目录下并存（与 essay_grading.py 同级）

4. **conversations.py（对话历史）保留**，用于 Onboarding/Diagnosis Phase。Phase-Home 不动它。

5. **现有 prompts/ 已有 `__init__.py + _shared.py`**，下游 plan 提到的 `_shared.py` 已存在，按现有约定 evolve。

### 2.6 修订后的 LLM 模块演进策略（替换 05-LLM-Module §1-2）

```
modules/llm/                           ← 不新建 _v2，全部追加在此
  application/
    llm/
      _stub.py                         保留
      byom_config.py                   保留 + 扩展（增加 system 默认 provider 字段）
      conversations.py                 保留
      json_parser.py                   保留 + 升级（加 schema 校验 = 新需求）
      openai_compatible.py             保留 + 增加 streaming 增量解析能力
      pricing.py                       保留 + 扩展成本聚合
      provider.py                      保留 + 增加 LlmProvider Protocol 封装
      ─────────── 以下新增 ───────────
      service.py                       ← 新增 facade（plan_generate / plan_adjust / recommend）
      sanitizer.py                     ← 新增 用户输入清洗
      cache.py                         ← 新增 二级缓存
      cost_tracker.py                  ← 新增 LlmCallV2 写入 + dashboard
      quotas.py                        ← 新增 配额服务
      plan_generator.py                ← 新增（消费 prompts/plan_generate.py）
      plan_adjustor.py                 ← 新增
      recommender.py                   ← 新增
      recommender_policy.py            ← 新增（阈值表）
      parsers/
        plan_output_parser.py          ← 新增
        adjustment_parser.py           ← 新增
        recommendation_parser.py       ← 新增
      prompts/
        _shared.py                     已有，扩展（追加 SAFETY_FOOTER / POLICY_HEADER）
        essay_grading.py               已有，不动（属其它 Phase）
        qa.py                          已有，不动
        study_plan.py                  保留至 B5.1，与旧 DailyPlan 一起删
        ─────────── 以下新增 ──────────
        plan_generate.py               ← 新增
        plan_regenerate_range.py       ← 新增
        plan_adjust.py                 ← 新增
        recommend_today.py             ← 新增
  infrastructure/                      ← 现状是否有此层？看现有 modules/llm，
                                        如不存在则不新建，把 provider impl 留在 application/llm/
```

---

## 3. 前端 view 现状

### 3.1 待删除文件（修订 04-Frontend-WU §F7.5 路径）

| plan 写的 | 实际路径 | 状态 |
|---|---|---|
| `apps/web/src/views/Plan.tsx` | **已不存在** | 下游文档若仍引用，视为历史假设；当前 tranche 不再以该文件为入口 |
| `apps/web/src/views/studyToday.tsx` | **已不存在** | 下游文档若仍引用，视为历史假设；当前 tranche 不再以该文件为入口 |
| `apps/web/src/views/Onboarding.tsx` | `apps/web/src/views/study/Onboarding.tsx` | 路径错；本 Phase 不删（Onboarding Phase 处理） |
| `apps/web/src/views/DiagnosisResult.tsx` | `apps/web/src/views/study/DiagnosisResult.tsx` | 路径错；本 Phase 不删（Onboarding Phase 处理） |

### 3.2 现有首页相关 view 的去留

| view | 现状 | Phase-Home 动作 |
|---|---|---|
| `views/Dashboard.tsx` | **已不存在** | 旧 A0 / WU 对它的迁移描述只保留为历史设计意图；当前 tranche 不以该 view 为入口 |
| `views/Progress.tsx` | 旧"学情"路由 | 删，被 `ProfileLearning.tsx` 替代 |
| `views/Plan.tsx` | **已不存在** | 当前 tranche 不处理文件删除；仅把路由/页面收口留给 `M11` |
| `views/study/StudyToday.tsx` | **已不存在** | 当前 tranche 不处理文件删除；仅把路由/页面收口留给 `M11` |
| `views/study/Onboarding.tsx` | Gate 流 | 不动（Onboarding Phase） |
| `views/study/DiagnosisResult.tsx` | Gate 流 | 不动 |
| `views/Profile.tsx` | `/profile` 渲染 | 保留（5 tab 的我的 tab 落点） |
| `views/NotesHome.tsx` | `/notes` 渲染 | 保留（5 tab 笔记 tab） |

### 3.3 现有目录"前菜"

```
apps/web/src/components/dashboard-sikao/         ← 已存在！这是首页 V2 的目标位置
  MetricsRow.tsx                                  ← 已有部分原型组件
```

下游 04-Frontend-WU 文档中 `apps/web/src/components/dashboard-sikao/plan/` 等子路径与现状一致，**沿用此目录**。

---

## 4. 缺失依赖清单（必须在 PR 中安装）

### 4.1 后端依赖（services/api/pyproject.toml）

| 包 | 用途 | 引入 PR |
|---|---|---|
| `apscheduler>=3.10` | Cron runner | B8.1 |
| `python-dateutil>=2.9` | RRULE 解析 | B2.4 |
| `jsonschema>=4.23` | LLM 输出 schema 校验 | B7.1 |
| `cachetools>=5.5` | LLM L1 cache | B7.1 |
| `slowapi>=0.1.9` | 限流 | B1.4（与中间件一同接入） |
| `structlog>=24.4` | 结构化日志 | B8.1（与 OTel 一起） |
| `opentelemetry-api>=1.27`<br>`opentelemetry-sdk>=1.27`<br>`opentelemetry-exporter-otlp-proto-http>=1.27` | 监控 | B8.1 |
| `ijson>=3.3` | LLM 流式增量 JSON 解析（可选，若不用则全量 buffer） | B7.2 |

> **不引入**：`openai` SDK（沿用现有 httpx-based provider，详见 §2.5）

### 4.2 前端依赖（apps/web/package.json）

| 包 | 用途 | 引入 PR |
|---|---|---|
| `rrule@^2.8` | calendar-engine RRULE 展开 | F3.3 |
| `date-fns@^3` + `date-fns-tz@^3` | 时区 / 日期 | F3.2 |
| `@dnd-kit/core@^6` + `@dnd-kit/sortable@^8` | 拖拽 | F4.7 |
| `recharts@^2.15` | 图表（懒加载，仅 ProfileLearning） | F5.4 |
| `web-vitals@^4` | LCP/INP/CLS 上报 | F1.4（可选）/ 9 章 |
| `idb-keyval@^6` 或 `@tanstack/query-sync-storage-persister` + `@tanstack/query-async-storage-persister` | 离线缓存 | F1.1 |
| `vitest-axe@^0.1` | a11y 测试 | F8.4 |

### 4.3 依赖分包

calendar-engine 包应**自带 rrule + date-fns + date-fns-tz**：

```json
// packages/calendar-engine/package.json
{
  "dependencies": {
    "rrule": "^2.8",
    "date-fns": "^3",
    "date-fns-tz": "^3"
  }
}
```

apps/web 通过工作区依赖引用 calendar-engine，不需要重复装。

---

## 5. AGENTS.md 关键约束摘录（最易踩雷）

| 约束 | 说明 |
|---|---|
| H6 Define First | 任一实现 PR 前必须有对应 plan 文档；本 Phase 已就绪 |
| H7 Fail Fast | LLM/parser/cron 失败必须显式抛错，禁止 try/except 静默吞 |
| H9 PR Batch | ≤15 文件 / ≤400 行变更（含测试）；超出必拆 |
| H10 No Docker | 全场景禁止 docker，部署用本地 + nginx 直跑 |
| H8 Validation | 写完测试必须实跑（pytest -q / vitest --run），证据贴 PR description |
| H4.4 No console.log | 前端禁 console.log，用 packages/shared-utils/logger |

---

## 6. 当前 RailMini/TabBar 的 `/me` 路由 bug

`RailMini.tsx` / `TabBar.tsx` 都用 `to: '/me'`，但 `router/index.tsx` 没有 `/me` 路由，仅有 `/profile`。

→ 用户点击"我的"目前会进 NotFound。**Phase-Home WU-F7.2 的第一件事是修这个 bug**（甚至可以拆成一个 stub bug-fix PR 先 ship）。

---

## 7. /dashboard 的语义历史

router/index.tsx 注释（line 注释）明确：

```
// /dashboard  → 学情数据（require-auth；route path 保持 /dashboard 不改, sidebar
//               redesign 2026-05-07 后 label 从"用户中心"改"学情数据", 跟 /profile=个人中心解耦）
```

含义：
- `/dashboard` 是**学情数据页**，不是 IA-V2 决策稿中的"首页"
- "首页" IA 概念在当前代码中分散在 `/study/today`（Navigate）+ `/dashboard`（实际 view）+ `/`（Marketing landing）

迁移：
- IA-V2 的"首页 `/`" = 全新 view（Section A/B/C），目前 `/` 渲染 marketing landing 页（公开层）
- 当前 `/dashboard` view → 迁移成 `/profile/learning`（Phase-Home WU-F5.3）
- 当前 `/study/today` Navigate → redirect 到新 `/`

需要协调的点：
- 公开层 `/` Marketing landing 页 vs 登录态 `/` 首页：通过 AppShell 的鉴权拦截区分。已存在的 RedirectGuard 可处理（已在 router 中使用）

---

## 8. AppShell / 公开 nav / 路由壳的现状

router 当前结构：

```ts
{
  path: '/',
  element: routeElement(<...marketing landing...>),  // ← 公开层
}
// ... auth 路由（/login, /register/email 等）
{
  // AppShell 作 layout route（无 path 只有 element）
  element: <AppShell> + RedirectGuard require-auth
  children: [
    /app           → Navigate /dashboard
    /practice/center, ...
    /wrong-book, ...
    /dashboard
    /profile
    /notes, /notes/:id
    /study/today   → Navigate /dashboard
  ]
}
```

迁移目标态：

```ts
{
  path: '/',
  element: <PublicLanding>,                            // 未登录看 marketing
  // 登录态：在 PublicLanding 内做客户端 detect → redirect /
  // 或更干净：把"已登录用户访问 /"用 RedirectGuard redirect-if-authed → /home
}
```

**决策点（新增）**：
- A 方案：登录后 `/` 直接渲染首页 view（PublicLanding 改造为"未登录 marketing / 已登录首页"）
- B 方案：登录后 `/` redirect 到 `/home`，`/home` 是首页 view 路由

倾向 **A**（与 IA-V2 决策稿"`/` = 首页"一致），但会影响 router/PublicLanding 改造。

→ 本决策需在 WU-F7.1 启动前在 [00-Decisions](./00-Decisions.md) 补一条 D-Root-Route。

---

## 9. /notes 已实现但未在导航暴露

`/notes` + `/notes/:noteId` 都在 router 中注册并指向 `pages.notesHome` / `pages.noteEditor`。

含义：5 tab 升级时，**笔记 tab 不需要新建 view**，只需在 TabBar/RailMini 加一项指向 `/notes` 即可。这是 Phase-Home 范围内最小改动。

`Phase/Notes` Phase 启动时再做笔记功能的 V2 升级。

---

## 10. 现存测试影响面

修订路由后下列测试需要同步：

| 测试 | 影响 |
|---|---|
| `apps/web/src/views/__tests__/Dashboard.test.tsx` | 改名 / 改 expectations（dashboard 重写后） |
| `components/wrong-book/__tests__/*` | 路径改名 + 文件目录可改成 review/ |
| `components/dashboard/__tests__/*` | 拆分到 `dashboard-sikao/__tests__/` |
| `layouts/__tests__/AppShell*` | 5 tab 断言 |
| `router/OnboardingGate.test.tsx` | 不变 |

测试迁移单独拆 1 PR（不混在功能 PR 里），列入 F7 系列。

---

## 11. 受影响章节的精确修订指引

| 文档 / 章节 | 现写法 | 修订为 |
|---|---|---|
| `02-Data-Model §2` 各 schema | "新增 `db/models/plan_v2.py`" | "在 `db/models_v2.py` 末尾追加 PlanV2 等 class" |
| `02-Data-Model §8` Alembic 命名 | 路径不动 | 不动 |
| `03-Backend-WU §0` 总览 PR 数 | 后端 38 PR | 后端 39 PR（B1.5 之外加 B1.6 cleanup study_plan.py） |
| `03-Backend-WU §2.1`-`§2.5` 文件路径 `db/models/plan_v2.py` | 各处文件路径 | 改为 `db/models_v2.py` |
| `03-Backend-WU §8` WU-B7 模块路径 `modules/llm_v2/` | 整章 | 改为 `modules/llm/`，其余子模块按 §2.6 修订 |
| `03-Backend-WU` 隐式假设的 openai SDK | LLM client 描述 | 改为 httpx-based（沿用现有） |
| `04-Frontend-WU §1.4` 路由清单 | 已是目标态（5 tab + `/`） | 在表格上方加："**注：实现时需先做 §A0 §1.3 的 4→5 升级**" |
| `04-Frontend-WU §8` WU-F7 PR 拆分 | F7.2 1 PR | 拆 3 PR：F7.2a /me bug fix + 5 tab labels；F7.2b 路径 rename + 老路径 redirect；F7.2c view 文件迁移 |
| `04-Frontend-WU §8` 删除文件路径 | `studyToday.tsx` / `Onboarding.tsx` | 改 `study/StudyToday.tsx`；Onboarding/DiagnosisResult 不在本 Phase 删 |
| `04-Frontend-WU §F5.3` ProfileLearning 内容来源 | "新建" | "从 views/Dashboard.tsx 迁移内容 + 重写" |
| `05-LLM-Module §2` 模块结构 | `modules/llm_v2/` | 改 `modules/llm/`，结构按 §A0 §2.6 |
| `05-LLM-Module §3` provider abstraction | "openai SDK" | "httpx + 现有 OpenAICompatibleProvider 升级" |
| `05-LLM-Module §13` Stage 1→2 | 不动 | 不动 |
| `06-LLM-Prompts §0` 路径 | `application/prompts/` | 改 `application/llm/prompts/` |
| `08-NonFunctional §2.4` 密钥与机密 | 提 SecretStr | 现有 byom_config.py 已有处理，沿用 |
| `09-Observability-Audit §3` LlmCallV2 写入 | 提 service.py | 沿用现有 pricing.py 与新增 cost_tracker.py |
| `10-Testing §2.2` 路径 | 各 module 测试位置 | 按 §A0 §2.2 / §2.4 现实路径 |

---

## 12. 启动顺序建议

按本文件修订后，开工顺序略调：

```
P0  本文件 + 11 §A0 修订指引被各文档读懂（M0 启动周）
P1  /me bug fix 单独 1 PR（前置，可与 B1 并行）
P2  WU-B1 数据建模（按 §2 真实路径追加 db/models_v2.py）
P3  WU-B2 plans 模块 + B5.1 cleanup（清 DailyPlan 引用）
P4  WU-B6 profile 扩展
P5  WU-B7 LLM 模块（按 §2.5/§2.6 扩展现有 modules/llm）
P6  WU-B3/B4/B5/B8/B9 按原顺序
P7  WU-F1-F8 按原顺序，F7 拆 a/b/c
```

---

## 13. 引用矩阵

| 本文档被引用 |
|---|
| [README.md](./README.md) 顶部"开工前必读"提示 |
| 所有 00-10 子文档的"路径错误" 自动以本文 §11 为准 |

---

## 14. 维护

发现下游文档与本文 §11 已同步修订后，将本文 Status 从 ACCEPTED 改为 SUPERSEDED，并保留作为审计记录。

修改 §11 修订指引时 PR description 必须标 `[A0 update]`，触发 reviewer 同步检查下游文档是否一致。
