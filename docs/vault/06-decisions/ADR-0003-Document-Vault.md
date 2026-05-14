---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# ADR-0003 — Document Vault 类 Obsidian 结构

## Status

Accepted（2026-05-13）

## Context

new_web 文档分散在 `docs/agent`、`docs/architecture`、`docs/design`、`docs/engineering`、`docs/plan`、`docs/research`、`AGENTS.md`、`ARCHITECTURE.md`、`CHANGELOG.md`、`README.md`、子目录 `AGENTS.md`、`CLAUDE.md` 等多处，分布式 SSOT 维护成本高。

brief §10 推荐采用 Obsidian-like vault，单一目录树 + Markdown + 双链。

## Decision

sikao 的人类可读文档全部归到 `docs/vault/`，子目录：

- `00-index` — Home / Roadmap / Glossary
- `01-product` — Product-Overview / Feature-Map / User-Flows
- `02-domain` — Question-Bank / Xingce / Shenlun / Answer-Session / Grading / Study-Record
- `03-tech` — Architecture / Frontend / Backend / Database / API-Standard / Auth
- `04-design` — Design-System / *-Layout
- `05-migration` — Migration-Plan / Migration-Status / Legacy-Feature-Inventory / Data-Migration
- `06-decisions` — ADR-xxxx
- `08-archive` — 过时文档归档

每文档前置 frontmatter（type / status / owner / last-reviewed / archived-at）。

链接用 Obsidian 双链 `[[文档名]]`。

## Alternatives considered

- 分布式文档（new_web 模式）：维护成本高，新人不易找到入口
- Sphinx / mkdocs：要构建步骤；vault 直接看 Markdown 更轻

## Consequences

- 所有人都从 `docs/vault/00-index/Home.md` 进入
- 各包 README 只放包级别细节（Responsibility / Legacy Source / New Location / Status），跨包知识沉到 vault
- 跟 new_web 旧 docs 文档相对独立——旧文档作为迁移参考，不直接 import 到 vault

## 关联

- [[Migration-Plan]]
