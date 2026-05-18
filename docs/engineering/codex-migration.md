---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Codex 迁移索引

> 本文是 `web_new` → `sikao` 代际迁移（2026-05-13 落地）的索引文档。
>
> **用途**：记录两件事 ——
> 1. sikao 当前 agent 入口（Claude Code / Codex / Multica 统一进入点）
> 2. web_new 时代的 `.claude/` artifact 和 历史 plan 在哪里查（sikao 不带过来，按需回 web_new 仓库查）
>
> 不进 git 的内容：大文件、密钥、一次性产物、本机绑定凭据。

## Active Rules (sikao 当前)

| 范围 | sikao 入口 | 说明 |
|---|---|---|
| 根仓 | `AGENTS.md` | sikao 当前唯一项目级 agent 规则；Codex / Claude Code / Multica-managed 统一从此进入 |
| 根仓（Claude 兼容镜像） | `CLAUDE.md` | 与 `AGENTS.md` 语义一致（CLAUDE.md §0.1）；修改任一必须同步另一份 |
| 项目迁移 SSOT | `docs/vault/05-migration/` | `Migration-Plan.md` 定义路线，`Migration-Status.md` 记录状态，`Legacy-Feature-Inventory.md` 记录旧功能盘点，`Data-Migration.md` 记录数据迁移 |
| vault 入口 | `docs/vault/00-index/Home.md` | 类 Obsidian 文档仓库索引 |

## Historical Rules (web_new 时代, 只读参考)

| 范围 | web_new 入口 | sikao 处理 |
|---|---|---|
| 根仓 | `AGENTS.md` (web_new) | sikao 已根据 web_new 内容 + 当前硬约束（全场景禁 docker / 端口 18080 唯一 / 单仓 monorepo 等）重写 |
| 前端 | `frontend/AGENTS.md` (web_new) | sikao 不再有"前端专属"AGENTS.md；所有规则收敛到根仓 |
| 历史 Claude 规则 | `CLAUDE.md` / `frontend/CLAUDE.md` (web_new) | 只在 web_new 仓库查；sikao 不带过来 |

## web_new 时代 Local Artifacts (仅参考查询)

| 路径 (web_new) | 用途 | sikao 处理 |
|---|---|---|
| `.claude/fenbi-mirror/` | fenbi 原始题库 mirror，约 461 MB | sikao 改用 `backend_data/xingce/` + `backend_data/shenlun/`（4.4 GB，仓库外，gitignored；详见 CLAUDE.md §12） |
| `.claude/import-staging/` | fenbi adapter 输出 | sikao 改用 `backend_data/import-staging/`（脚本自动生成，可重建） |
| `.claude/aipta-samples/samples.txt` | 申论真样本文本 | sikao 收编进 `backend_data/shenlun/standard_json/`（745 套） |
| `.claude/plans/*.md` | 旧 session handoff 和 review 记录 | sikao 不带过来；如需历史 plan 上下文，回 web_new 仓库 `docs/plan/` 查 |
| `.claude/launch.json` | 旧 Claude Preview 启动配置 | sikao 不带；Codex 用根目录 `AGENTS.md` |
| `.claude/exam-vps-key*` | 旧 VPS SSH key pair | 本机保留；敏感文件，禁止提交 |
| `.claude/ssh-vps.py` / `.claude/sync-fenbi.py` / `.claude/import-one-paper.py` | VPS helper 脚本 | sikao 用 `scripts/import/sync_fenbi_mirror.py` 等正式脚本，不再用本机 wrapper |

## Existing Implementations (sikao 当前路径)

| 需求 | sikao 入口 (R3 已迁) |
|---|---|
| 同步 fenbi mirror | `scripts/import/sync_fenbi_mirror.py` |
| 批量导入 fenbi mirror | `scripts/import/import_fenbi_batch.py` |
| fenbi 转 standard JSON（行测） | `scripts/import/fenbi_to_standard.py` |
| fenbi 转 standard JSON（申论） | `scripts/import/fenbi_shenlun_to_standard.py` |
| Aipta plain-text 转 standard JSON | `scripts/import/aipta_text_to_standard.py` |
| 本机开发初始化 | 详见 CLAUDE.md §11.5 Quick Commands |

> 历史 web_new 路径（仅参考）：`apps/exam-api/app/scripts/sync_fenbi_mirror.py` 等
>
> 新建导入、同步、VPS helper 前，先查本节和 `scripts/import/`，确认没有现成入口。

## Do Not Migrate

以下文件 / 目录在 web_new 时代属于本机缓存或一次性产物，sikao **不带过来**，也不进 git：

- `.claude/settings.local.json` / `.claude/session.json` / `.claude/*.lock` / `.claude/*.tar.gz`
- `.claude/chapters.txt` / `.claude/preview/` / `.claude/worktrees/`
- `.claude/*key*` / `.claude/ssh-vps.py` / `.claude/sync-fenbi.py` / `.claude/import-one-paper.py`（绑定本机凭据或路径，保留在 web_new 本机，不提交）

sikao 默认 `.gitignore` 应继承此清单（git init 后落地）。
