---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# docs/plan/

跨模块 / 契约级任务的计划文件归档地。

## 何时建 plan doc（CLAUDE.md §5.1 / §10）

满足任一条件才允许新建 `docs/plan/*.md`：

1. 涉及跨服务 API / DB schema / 状态机契约
2. 涉及架构变更或模块边界变化
3. 涉及前端大改版 / 复杂交互 / 视觉体系变动
4. 涉及安全、鉴权、支付、部署、数据迁移
5. lhr 明确要求形成 plan doc
6. 该计划需要多 agent / 多 session 反复引用

否则，任务计划只写在 Multica issue comment，不进本目录。

## 命名

- Multica 来源：`<issue-id>-<slug>.md`（例如 `42-auth-recovery.md`）
- 非 Multica 主题：`<topic>.md`（例如 `frontend-style-guide-v1-migration.md`）

## frontmatter 规范

```yaml
---
type: engineering
status: draft | active | archived
owner: <agent or human>
last-reviewed: YYYY-MM-DD
source: multica            # 可选；来自 Multica 时写
multica-issue: <issue-id>  # 可选；来自 Multica 时写
archived-at: YYYY-MM-DD    # 仅 status=archived 才填
shipped: YYYY-MM-DD        # 仅 archived 已投产 plan，对应 deploy/RELEASES.md
---
```

## 历史 plan 在哪查

- `web_new` 仓库 `docs/plan/`（<https://github.com/Nimm0ny/web_new>）—— sikao 迁移前的 session-level handoff / 实施记录
- sikao 本目录 —— 2026-05-13 起的新 plan

历史 plan 不迁入 sikao（详见 `docs/engineering/codex-migration.md`）。
