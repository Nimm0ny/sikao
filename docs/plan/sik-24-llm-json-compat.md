---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-23
source: multica
multica-issue: SIK-24
---

# SIK-24 LLM JSON Compatibility

## Goal

修复百炼真实 provider 下 `question_generation` / `reference_generation` 的结构化 JSON 兼容性缺口，不再只依赖提示词“软约束”。

## Define-First Boundary

- `LLMProvider.chat_completion(...)`
  - 新增可选 `response_format` 边界；结构化 JSON 调用方显式传 `json_object`
  - provider 侧只对已知支持的 host 下发该字段；未知 OpenAI-compatible BYOM 端点保持旧行为
  - 非结构化 chat / stream 路径保持现状，不强制附带该参数
- `question_generation`
  - prompt 必须内嵌真实输出 schema，而不是只说“满足 schema”
  - 当 provider 返回“单题 object”且字段完整时，parser 允许自动包成 `questions=[...]`
- `reference_generation`
  - draft / self-audit 都必须走 `json_object` 请求，减少“近 JSON”输出

## Acceptance Mapping

- `question_generation` 真 provider 下不再因缺少顶层 `questions` wrapper 直接失败
- `reference_generation` 真 provider 下不再依赖纯提示词约束输出 JSON
- provider 单测覆盖 `response_format` request payload
- parser / prompt 单测覆盖单题 object 兼容和 schema 文本暴露
