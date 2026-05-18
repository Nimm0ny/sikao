# SIKAO

> 让备考从刷题变成思考。

## 仓库结构（按现行架构与迁移文档）

```
sikao/
  apps/
    web/                  Web 端入口（已迁移 partial）
    mobile/               手机端，not_started
    tablet/               平板端，not_started
    admin/                后台管理，not_started
  packages/
    ui/                   通用 UI 组件
    design-system/        设计系统、主题、字号、间距、颜色
    api-client/           API 请求封装
    domain/               前端领域模型与业务封装
    answer-engine/        答题核心逻辑
    editor/               申论编辑器、富文本能力
    shared-utils/         通用工具
    config/               通用配置
  services/
    api/                  后端 API 服务（FastAPI）
    worker/               异步任务，not_started
    storage/              文件/导入导出服务，not_started
  database/
    migrations/           Alembic 迁移（23 versions，head 0023_essay_draft_sessions）
    seeds/                初始化数据（含 MVP demo seed；全量题库在仓库外 backend_data/）
    schema/               数据模型对照
  docs/
    vault/                类 Obsidian 文档仓库
    assets/
    templates/
  scripts/
    migration/            迁移脚本
    import/               数据导入脚本
  tests/
    e2e/
    fixtures/
```

## 迁移状态

本仓库是 `new_web` → `sikao` 的迁移结果。已完成 R0（骨架）+ R1（代码批量迁移）+ R3（数据组件）。

- 代码与文档：迁完，状态 `partial`（业务逻辑深抽 R2 进行中）
- 数据组件：alembic / 导入脚本 / schema 对照已就位（2026-05-13）
- MVP demo seed：仓库内自包含生成（行测 10 套 + 申论 100 套），见 `npm run bootstrap:mvp-demo`
- 题库冷存：`D:/py_pj/backend_data/`（仓库外，行测 764 套 + 申论 745 套）
- 完整状态见 `docs/vault/05-migration/Migration-Status.md`

## 部署

**不用 docker**。生产/开发全 native（PostgreSQL native install / uvicorn / 静态托管）。详见 `docs/vault/03-tech/Architecture.md`。

## 开发

```bash
# 1. 装前端依赖（npm workspaces，含全部 @sikao/* 包）
npm install

# 2. 前端开发服务器（端口 18080 硬约束）
npm run dev

# 3. 后端
cd services/api
pip install -e ".[dev,postgres]"
cd ../..

# 4. 配 DB（MVP demo 推荐 native PG）
export DATABASE_URL=postgresql+psycopg://exam_api:secret@127.0.0.1:5432/exam_api

# 5. 拉 schema（从仓库根）
alembic -c database/migrations/alembic.ini upgrade head

# 6A. 灌 MVP demo 题库（仓库内自包含，不依赖 backend_data）
npm run seed:mvp-demo

# 6B. 可选：灌全量题库（数据在仓库外 backend_data/）
export BACKEND_DATA_ROOT=D:/py_pj/backend_data
python -m scripts.import.import_fenbi_batch

# 7. 启动 API
cd services/api
uvicorn sikao_api.main:app --reload --port 8000 --host 127.0.0.1
```

也可以从仓库根一条命令完成 schema + MVP demo seed：

```bash
npm run bootstrap:mvp-demo
```
