---
type: architecture
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Backend

## 模块化（per brief §7）

每个领域一个 module，每 module 内分四层：

```
module/
  domain/         领域模型 + 业务规则
  application/    用例服务（command / query）
  infrastructure/ DB repo / 外部服务客户端
  interface/      controller / dto / route
  README.md
```

## Module 清单

| Module           | 主要职责 | 旧 route 文件 |
|------------------|----------|---------------|
| auth             | 登录 / 注册 / 绑定 / 密码重置 / 验证码 / token | `auth_v2.py` |
| user             | UserGoal / Profile | `me_v2.py`（部分） |
| user-exams       | 自定义考试 | `user_exams_v2.py` |
| question-bank    | Paper / Question / Asset / ImportJob | `papers_v2.py` |
| answer-session   | PracticeSession 状态、保存、提交 | `practice_v2.py` |
| grading          | 评分（行测客观 + 申论 AI） | 散落在 practice / essay |
| wrong-book       | Mastery / Attempt | （在 practice 服务内） |
| favorite         | 收藏 | 待识别（注：new_web 实现可能并入 question_notes） |
| study-record     | StudyPlan / Quotas | `study_plan_v2.py` |
| notes            | QuestionNote / Notebook / 社交 | `notes_v2.py` / `notebook_v2.py` / `note_social_v2.py` |
| llm              | BYOM 配置 / 对话 / 批改 prompts | `llm_v2.py` / `llm_conversations_v2.py` |
| analytics        | PredictedScore / Weakness / Heatmap / Specialty stats | `me_v2.py` / `xingce_specialty_v2.py` |
| exam-events      | 考试日历 | `exam_events_v2.py` |
| admin            | 题库导入审核 / Note Report | `admin_v2.py` / `admin_note_reports_v2.py` |
| system           | 健康检查 / bootstrap / ops | `system_v2.py` / `ops.py` |
| essay-specialty  | 申论专项分类 | `essay_specialty_v2.py` |
| essay            | 申论草稿 / 批改 / 评分 | `essay_v2.py` |
| xingce-specialty | 行测专项分类 / weakness | `xingce_specialty_v2.py` |

> 注：essay 与 essay-specialty / xingce-specialty 第二轮重构时可能并入 `grading` 与 `analytics`，本轮保留独立 module 与原 route 对齐。

## 路由前缀

全部 `/api/v2/...`，与 new_web 保持一致以兼容前端老 URL。

## 错误响应

per brief §11.2：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "QUESTION_NOT_FOUND",
    "message": "题目不存在",
    "details": {}
  },
  "meta": {"requestId": "xxx"}
}
```

## 启动

**不用 docker**（2026-05-13 用户拍板，全场景 native）。

```bash
# 装依赖
cd services/api
pip install -e ".[dev,postgres]"   # postgres extra 装 psycopg

# 配 DB（直连 native PG / dev SQLite）
export DATABASE_URL=postgresql+psycopg://exam_api:secret@127.0.0.1:5432/exam_api

# 跑 alembic 拉 schema
cd D:/py_pj/sikao
alembic -c database/migrations/alembic.ini upgrade head

# 启动 API
cd services/api
uvicorn sikao_api.main:app --reload --port 8000 --host 127.0.0.1
```

> 当前状态：`sikao_api.main` 与各 module router 已迁入，`create_app()` smoke pass（138 路由）。实际跑通需要：
> 1. `pip install -e ".[dev,postgres]"` 补齐运行时依赖
> 2. native PG 实例（dev 默认 SQLite 也可）
> 3. `alembic upgrade head` 拉 schema 到 0023
> 4. 跑 `scripts/import/import_fenbi_batch` 灌题库（数据在 `backend_data/`）
