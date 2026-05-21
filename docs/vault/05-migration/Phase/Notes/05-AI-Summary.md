# Phase-Notes · 05 · AI Summary & Weekly Review

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions §8 N-Weekly + §10 N-AI](./00-Decisions.md) · [02-Backend-WU §6~§7](./02-Backend-WU.md) · [Phase-Home/05-LLM-Module](../Home/05-LLM-Module.md)
> **SSOT 声明**：本文是 Phase-Notes AI 摘要拆卡 + 周回顾生成的唯一技术实现文档。

---

## 1. LLM 模块复用

Phase-Notes **完全继承** Phase-Home LLM Module 基础设施，不重复建设。

| 继承能力 | 来源文件 | Notes 使用方式 |
|---|---|---|
| Provider 抽象 | `modules/llm/.../provider.py` | `LlmProvider` Protocol，不感知底层 DeepSeek/百炼 |
| SSE 流式输出 | `provider.chat_complete_stream()` | Weekly Review 流式生成 |
| 审计记录 | `cost_tracker.py` → `LlmCallV2` | 每次调用自动写入 |
| 重试策略 | `with_retry()` max_retries=1, exponential backoff | 两功能共用 |
| 输入清洗 | `sanitizer.sanitize_user_input()` | body 拼 prompt 前必须清洗 |
| JSON mode + fallback | `response_format` + `parse_with_fallback()` | note_summary_cards 使用 |
| Mock provider | `MockProvider` + fixture | CI 测试专用 |
| 配额框架 | `LlmQuotaService.check_quota()` | 共享日限额池 |

**Notes 新增文件**：

```
modules/notes/application/weekly_review_service.py
modules/notes/application/ai_summary_service.py
modules/llm/.../prompts/note_summary_cards.py
modules/llm/.../prompts/cause_analysis_weekly.py
modules/llm/.../parsers/note_summary_parser.py
```

**调用纪律**：不直接 import Provider 实现；所有用户文本拼 prompt 前必须 `sanitize_user_input(text, max_length=2000)`。

---

## 2. Prompt 设计 — note_summary_cards

**Purpose**：从笔记正文提取 1~3 张复盘要点卡片（≤50 字/张），用户确认后写入 ReviewItemV2。

### 2.1 Input Template

```python
PROMPT_VERSION = "note_summary_cards_v1"

SYSTEM_PROMPT = """你是学习助手。从用户笔记中提取 1~3 个核心知识要点，每个 ≤50 字。
输出 JSON: {"cards": [{"text": "..."}]}。语言与笔记一致。提炼核心逻辑，不复述原文。"""

USER_TEMPLATE = """笔记内容：
{body_text}
{question_stem_section}
请提取知识要点卡片。"""
# question_stem_section: 仅 linked_question_id 非空时拼入 "关联题面：{stem}"
```

### 2.2 Output Schema

```json
{
  "type": "object",
  "required": ["cards"],
  "properties": {
    "cards": {
      "type": "array", "minItems": 1, "maxItems": 3,
      "items": {
        "type": "object", "required": ["text"],
        "properties": { "text": { "type": "string", "maxLength": 50 } }
      }
    }
  }
}
```

### 2.3 参数选择

| 参数 | 值 | 理由 |
|---|---|---|
| temperature | 0.3 | 摘要需确定性 |
| max_tokens | 512 | 输出短小 |
| response_format | `{"type": "json_object"}` | 强制 JSON |
| timeout | 30s | 兜底时限 |
| model | settings.deepseek_model | 继承全局 |

### 2.4 输入预处理

```python
def prepare_summary_input(note: NoteV2, question: QuestionV2 | None) -> dict:
    body_text = sanitize_user_input(note.body_text, max_length=2000)
    question_stem_section = ""
    if question:
        question_stem_section = f"关联题面：{sanitize_user_input(question.stem, max_length=500)}"
    return {"body_text": body_text, "question_stem_section": question_stem_section}
```

### 2.5 PROMPT_VERSION

- 文件顶部声明，修改 prompt 时递增（v1→v2→…）
- 写入 `LlmCallV2.prompt_version`；缓存键包含此版本，版本变更即缓存失效

---

## 3. Prompt 设计 — cause_analysis_weekly

**Purpose**：根据本周学习数据生成结构化周回顾（Markdown），后端转 TipTap JSON AST 存入 NoteV2(type=weekly_review)。

### 3.1 Input Template

```python
PROMPT_VERSION = "cause_analysis_weekly_v1"

SYSTEM_PROMPT = """你是学习分析助手。根据本周数据生成周回顾报告。
Markdown 格式，严格四个 ## 区块：本周成果 / 薄弱环节 / 下周建议 / 本周知识沉淀。
可用 emoji 前缀。中文输出。"""

USER_TEMPLATE = """第 {week_number} 周（{date_range}）

复盘：复盘 {review_count} 题，正确率 {redo_accuracy}%（{accuracy_delta}），毕业 {graduated_count} 题
练习：答题 {practice_count}，模块正确率：{module_accuracy_summary}
薄弱模块：{weakness_detail}
笔记：新增 {note_count} 条（题级 {question_note_count} 条）：{note_titles}

请生成周回顾。"""
```

### 3.2 Output 结构（固定四区块 Markdown）

```markdown
## 💪 本周成果
- ...（2~4 条）

## ⚠️ 薄弱环节
- ...（1~3 条）

## 🎯 下周建议
- ...（2~3 条）

## 📝 本周知识沉淀
- ...
```

后端正则校验 4 个 `##` 区块存在，缺失时补全空区块。

### 3.3 SSE 流式 chunking 策略

```python
async def stream_weekly_review(user_id: int, data: WeeklyReviewData):
    prompt = render_cause_analysis_weekly(data)
    full_text = ""
    async for chunk in provider.chat_complete_stream(
        system=SYSTEM_PROMPT, messages=[{"role": "user", "content": prompt}],
        temperature=0.7, max_tokens=2000, timeout=30,
    ):
        full_text += chunk.delta
        yield sse_event("chunk", {"text": chunk.delta})
        if chunk.is_done:
            break
    body_json = tiptap_converter.md_to_json(full_text)
    note = await persist_weekly_review(user_id, data, full_text, body_json)
    yield sse_event("done", {"note_id": note.id, "title": note.title,
                             "tags": ["周回顾", f"第{data.week_number}周"]})
```

不做 token 级攒批，chunk 到即推送（延迟 ≤50ms）。

### 3.4 参数选择

| 参数 | 值 | 理由 |
|---|---|---|
| temperature | 0.7 | 建议部分需创意 |
| max_tokens | 2000 | 回顾内容较长 |
| response_format | 不设（Markdown） | 非 JSON |
| timeout | 30s | 流式，用户可见中间结果 |

---

## 4. 缓存策略

### 4.1 note_summary_cards

| 维度 | 值 |
|---|---|
| Key | `(note_id, content_hash, PROMPT_VERSION)` |
| TTL | 无固定过期——content_hash 变更即失效 |
| 存储 | `AiSummaryCacheV2` 表 |
| 命中 | 直接返回 cards, `cached: true` |

### 4.2 cause_analysis_weekly

| 维度 | 值 |
|---|---|
| Key | `(user_id, year, week_number, PROMPT_VERSION)` |
| TTL | 7 天 |
| 存储 | `WeeklyReviewCacheV2` 表 |
| 命中 | 返回已有 note_id（幂等重放） |

### 4.3 缓存失效触发

| 触发 | summary_cards | weekly_review |
|---|---|---|
| 笔记内容编辑 | ✓ content_hash 变 | — |
| Prompt 版本升级 | ✓ | ✓ |
| TTL 过期 | — | ✓（7 天） |
| 用户"重新生成" | 跳过缓存 | 消耗限流次数 |

---

## 5. 限流与配额

### 5.1 共享日限额（daily_llm_quota）

- **额度**：20 calls/day/user（与 AI 错因分析 + AI 出题同池，N-AI-6）
- **重置**：每日 00:00 UTC+8
- **存储**：`LlmQuotaUsageV2(user_id, date, purpose, count)`

### 5.2 Weekly Review 专用

- **额度**：2 calls/week/user（N-Weekly-7）
- **计数**：COUNT(notes_v2 WHERE type='weekly_review' AND user_id=X AND this_week)
- **超限**：429 WEEKLY_REVIEW_RATE_LIMITED

### 5.3 配额检查流程

```python
async def check_and_consume_quota(user_id: int, purpose: LlmPurpose):
    # 1. 检查日限额 (≥20 → 429 LLM_QUOTA_EXCEEDED + retry_after)
    # 2. 若 weekly_review: 检查周限额 (≥2 → 429)
    # 3. 预扣减（LLM 调用前）
    # 4. LLM 失败不回滚（防恶意刷重试）
```

---

## 6. 错误处理与降级

### 6.1 错误码映射

| 场景 | HTTP | code | 额外 |
|---|---|---|---|
| LLM 超时 (30s) | 503 | `LLM_SERVICE_UNAVAILABLE` | 重试 1 次后仍超时 |
| LLM 输出解析失败 | 502 | `LLM_PARSE_FAILED` | + audit_log |
| 日限额耗尽 | 429 | `LLM_QUOTA_EXCEEDED` | + `Retry-After` header |
| 周回顾限流 | 429 | `WEEKLY_REVIEW_RATE_LIMITED` | + `Retry-After` header |
| 幂等键命中 | 200 | `IDEMPOTENT_REPLAY` | 返回已有结果 |

### 6.2 降级原则

**核心**：AI 功能永远不阻塞笔记 CRUD。LLM 宕机时：
- 笔记创建/编辑/删除/搜索完全不受影响
- AI 按钮返回 toast "AI 服务暂不可用"，不弹窗阻断

### 6.3 SSE 流中异常

```python
except (TimeoutError, ProviderError) as e:
    audit_log.error("weekly_review_stream_failed", error=str(e))
    yield sse_event("error", {"code": "LLM_SERVICE_UNAVAILABLE", "message": "生成中断，请重试"})
```

---

## 7. 审计与可观测

### 7.1 LlmCallV2 记录

每次 LLM 调用写入：`user_id, purpose, prompt_version, provider, model, input_tokens, output_tokens, cost_cny, latency_ms, status(success|timeout|parse_failed|error), error_detail, input_preview(200字), output_preview(500字), created_at`

### 7.2 Prompt 版本追踪

- `LlmCallV2.prompt_version` 关联产出版本
- 管理后台可按 prompt_version 分组查看 success_rate / avg_latency

### 7.3 关键指标

| 指标 | 告警阈值 |
|---|---|
| `llm.notes.summary.success_rate` | < 90%/h |
| `llm.notes.summary.avg_latency_ms` | > 15000ms |
| `llm.notes.weekly.success_rate` | < 90%/h |
| `llm.notes.weekly.avg_latency_ms` | > 20000ms |
| `llm.notes.parse_failure_rate` | > 5%/day |
| `llm.notes.quota_exhaustion_rate` | > 30%/day |

---

## 8. Markdown → TipTap JSON AST 转换

### 8.1 场景

Weekly Review LLM 输出 Markdown → 后端转 TipTap JSON AST → 存 NoteV2.body_json。

### 8.2 实现

`modules/notes/domain/tiptap_converter.py`，基于 `markdown-it-py` 解析后遍历生成 ProseMirror doc。纯 Python，无 Node.js 依赖。

### 8.3 节点映射

| Markdown | TipTap Node | attrs/marks |
|---|---|---|
| `## Heading` | `heading` | `level: 1\|2\|3` |
| paragraph | `paragraph` | — |
| `- item` | `bulletList` → `listItem` | — |
| `1. item` | `orderedList` → `listItem` | `start` |
| `**bold**` | mark `bold` | — |
| `*italic*` | mark `italic` | — |
| `[text](url)` | mark `link` | `href` |
| `---` | `horizontalRule` | — |

### 8.4 Edge Cases

| 情况 | 处理 |
|---|---|
| Emoji in headings (`## 💪 成果`) | 视为普通文本，UTF-8 全路径 |
| 嵌套列表（≤3 层） | 正确嵌套 bulletList/listItem |
| 嵌套列表（>3 层） | 平铺到第 3 层 |
| 输出被 \`\`\`markdown 包裹 | strip code fence |
| 缺少空行分隔 | 按换行拆 paragraph |
| 标题前无空行 | 仍识别为 heading（`^#{1,3}\s`） |
| Mixed bold/italic in list | 多 text node 带不同 marks |

---

## 9. 测试策略

### 9.1 Mock LLM

fixture 位于 `tests/fixtures/llm/note_summary_cards/` 和 `cause_analysis_weekly/`，覆盖 happy_path / invalid_json / schema_violation / partial_sections / empty_data。

### 9.2 测试场景

**note_summary_cards**：正常 3 卡生成 · 缓存命中 · 缓存失效(content_hash变) · prompt_version 失效 · 日限额 429 · LLM 超时 503 · 解析失败 502 · body 为空 422 · confirm 写入 ReviewItemV2 · confirm 幂等

**cause_analysis_weekly**：有数据生成 · 无数据空模板 · 周限流 429 · 幂等重放 · 自动标签 · SSE 中断 error 事件 · 日限额 429

**Markdown→JSON**：段落 · H1/H2/H3 · 无序列表 · 有序列表 · bold/italic · link · emoji heading · 嵌套列表(3层) · 超限嵌套(4层平铺) · code fence strip · 空输入

**限流边界**：第 20 次成功 → 第 21 次 429；周第 2 次成功 → 第 3 次 429

### 9.3 测试文件

| 文件 | 覆盖 |
|---|---|
| `tests/modules/notes/test_ai_summary.py` | summary_cards 全场景 |
| `tests/modules/notes/test_weekly_review.py` | weekly_review 全场景 |
| `tests/modules/notes/test_tiptap_converter.py` | MD→JSON 全场景 |
| `tests/modules/notes/test_llm_quota_notes.py` | 限流边界 |
| `tests/llm/test_parser_note_summary.py` | JSON schema 校验 + fallback |

---

## 10. 引用矩阵

### 10.1 本文引用来源

| 来源 | 条目 | 本文位置 |
|---|---|---|
| 00-Decisions.md | §8 N-Weekly-1~8 | §3, §4.2, §5.2 |
| 00-Decisions.md | §10 N-AI-1~8 | §2, §4.1, §5.1, §6.2 |
| 02-Backend-WU.md | §6 WU-N5 | §3 端点/规则 |
| 02-Backend-WU.md | §7 WU-N6 | §2 端点/规则 |
| Phase-Home/05-LLM-Module.md | §4 Provider, §5 SSE, §6 Sanitizer, §7 Cache, §8 Quota, §9 Retry, §10 JSON | §1~§7 全文 |

### 10.2 本文被引用于

| 引用方 | 用途 |
|---|---|
| 00-Decisions.md §14 | N-Weekly / N-AI 实现文档 |
| 02-Backend-WU.md §13 | WU-N5 / WU-N6 详细流程 |
| 03-Frontend-WU.md | AI 摘要 UI + SSE 对接 |
| 06-Testing.md | AI 模块测试清单 |

---

*文档结束*
