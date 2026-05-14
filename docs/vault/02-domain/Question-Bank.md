---
type: domain
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# Question Bank

## 范畴

题库领域，包含：

- 题目（Question）
- 选项（QuestionOption）
- 答案与解析（correct_answer / explanation）
- 材料（MaterialGroup / MaterialGroupAsset）
- 知识点 / 标签（Tag）
- 来源（fenbi / aipta）
- 资产（QuestionAsset 图片）
- 题型识别（isGraphicReasoning）

## 主要模型（来自 new_web/apps/exam-api/app/domain/models.py）

- `Paper` / `PaperRevision` / `PaperSection` / `PaperBlock`
- `MaterialGroup` / `MaterialGroupAsset`
- `Question` / `QuestionOption` / `QuestionAsset`
- `Tag`
- `ImportJob` / `ImportJobItem`

## 后端 module

`services/api/src/sikao_api/modules/question-bank/`

## 前端 domain

`packages/domain/src/question-bank/`

## 关联

- [[Paper]] / [[Answer-Session]] / [[Xingce]] / [[Shenlun]]
- [[Data-Migration]] §questions, options, papers

## 数据导入设计规范（从 CLAUDE.md §12 下沉）

> CLAUDE.md 保留三层 mirror→staging→DB 数据流图 + 三层去重表 + 一句话原则。
> 5 个设计选择 + 利弊 rationale 在此。
> **必读触发条件**：写 / 改导入脚本前，或新加数据源 adapter 前。

### A. Mirror 路径：`backend_data/xingce/`（已 gitignore）

- ✅ 不污染 git，体积无上限（90 套约 200MB+）
- ✅ 本机持久（rsync 增量）
- ❌ 换机器要重新 SCP（单人开发可接受）

### B. 导入入口：直接调 `ExamPaperService`（in-process Python 脚本）

- ✅ 比 HTTP API 快 10×（90 套要 90 次 multipart upload + 网络往返）
- ✅ 失败 stack trace 完整、可调试
- ❌ 跳过 admin auth（脚本即信任本地）—— 单机 dev 无所谓，生产用 admin API
- CLI：`python -m scripts.import.import_fenbi_batch --mirror backend_data/xingce`

### C. 事务粒度：每套 paper 独立事务

- ✅ 90 套中 1 套失败 → 其他 89 套已入库（已落地不丢）
- ✅ 沿用后端 `import_standard_json_files` 已有的 `with begin_nested()` 行为
- ❌ 单套内部失败仍是整套回滚（原子性依然保留）

### D. 增量策略：纯 hash-based + 一份 manifest 给报告

- 每次跑全量扫 mirror → adapter → import，三层都靠 hash 跳过已有
- manifest.json 仅 reporting：本次新增 N 套 / hash 命中跳过 M 套 / 失败 K 套
- ✅ 简单，无状态机
- ✅ 可重跑（idempotent）—— 任何阶段 crash 直接重跑
- ❌ 全量 hash 计算成本（90 套约 1-2 秒，可忽略）

### E. Assets 路径：DB 仍存 absolute path（现状），但用统一 `assets_root` 锚点

- 当前 `_resolve_assets` 把相对路径 resolve 成 `(base_dir / path).resolve()` 进 DB
- **本次** import 用 `data/assets/<paperCode>/assets/` 做 base_dir，`data/assets/` 是统一 root（生产可改 `/var/data/exam-assets/`）
- **不动后端代码**，只通过约束 base_dir 让 path 可控
- ⚠️ 已知问题：DB 存 absolute path = dev 数据不能直接搬到生产路径变。**这是 backend 内部架构问题，单独立 ticket 处理（标 known issue），本次不做**

### 这样设计的好处（核心三点）

1. **可重跑**：第 N 次跑只处理新增/变更，hash 命中即跳。任何阶段 crash 直接 `python -m ...` 重跑就好，不用清理状态
2. **解耦**：mirror / adapter / import 三层各自独立，单独 debug。adapter 改了 → 只重转 staging；import 改了 → 只重 import；都不用重新 SCP
3. **不污染 git**：mirror + staging + assets 全在 `backend_data/` 或 `data/`，git 只管脚本本身（CLI + manifest report）

## 状态

`not_started`（包结构就位）
