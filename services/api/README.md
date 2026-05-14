# @sikao/services/api

## Responsibility

后端 FastAPI 服务：HTTP 接口、数据持久化、权限校验、业务规则执行、评分生成。

## 模块化结构（per brief §7）

```
services/api/src/sikao_api/
  modules/
    auth/             登录、绑定、密码恢复、token
    user/             UserGoal、UserExam、Profile
    question-bank/    Paper、Question、Asset、ImportJob
    paper/            试卷与练习集合（紧贴 question-bank）
    answer-session/   PracticeSession 状态、答题保存、提交
    grading/          行测/申论评分
    wrong-book/       错题、Mastery、Attempt
    favorite/         收藏（待识别 new_web 是否已有）
    study-record/     学习记录、StudyPlan
    notes/            QuestionNote、Notebook、社交化
    llm/              对话、BYOM、批改
    analytics/        预测分、Weakness、Heatmap
    exam-events/      考试日历
    admin/            后台
    system/           健康检查、ops、idempotency
  core/             config、deps、limiter、schemas
  db/               base、session
  cli/              命令行入口
  scripts/          题库导入、backfill
  main.py           FastAPI app 入口
```

每个 module 内建议（brief §7.2）：

```
module-name/
  domain/         领域模型
  application/    用例服务
  infrastructure/ DB repo、外部服务
  interface/      controller、dto、route
  README.md
```

## Legacy Source

- `new_web/apps/exam-api/app/`

## New Location

- `services/api/src/sikao_api/`

## Status

`partial` — 工程化（pyproject）就位，源码与模块拆分待批量迁入。

## Migrated

- pyproject.toml（依赖与 dev 工具）

## Missing

- 18 个 v2 router 拆分到 modules/<domain>/interface/
- 49 个 service 文件归类到 modules/<domain>/application/
- domain/models.py 拆分到各 modules/<domain>/domain/
- core/db/cli 顶层结构
- main.py 模块注册
- alembic（见 database/migrations，但数据按用户要求暂不迁）

## Notes

- 端口 8000 / FE 端口 18080 的 CORS 与硬约束保留。
- alembic versions 与 fenbi 导入数据按 brief 与用户指令**本轮不迁**，待数据补完后再启用。
- 路由前缀沿用 `/api/v2/...`，避免老前端的 URL 抓不到。
