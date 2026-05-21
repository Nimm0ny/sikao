# Phase-Home · 05 · LLM Module

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Prompt 模板**：见 `06-LLM-Prompts.md`

---

## 1. 接入策略（Infra-LLM）

DeepSeek 官方与阿里百炼平台**都提供 OpenAI 兼容接口**，使用统一 OpenAI 兼容 client（基于 `openai` Python SDK），通过配置切换 provider。

| Provider | base_url | API key env | 默认 model | 说明 |
|---|---|---|---|---|
| DeepSeek 官方 | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` | `deepseek-v3.1` | 官方原厂，成本低 |
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` | `deepseek-v3.1`（百炼别名） | 国内访问稳定，备选 |
| mock | - | - | - | CI / 本地测试 |

> 实际模型 ID 由用户在 `.env` 决定，本文档只列默认值。CI 必须用 mock。

---

## 2. 模块结构

```
services/api/src/sikao_api/modules/llm_v2/
  __init__.py
  application/
    __init__.py
    service.py                     # facade，外部唯一入口
    provider_registry.py           # 注册 + 解析 provider
    plan_generator.py              # AI 制定 / 局部重生成
    plan_adjustor.py               # AI 每日调整提案
    recommender.py                 # 今日推荐
    recommender_policy.py          # 阈值表（详见 01-Boundary-Rules §2）
    cache.py                       # 进程内 LRU + DB 二级缓存
    cost_tracker.py                # token 计数 + 成本聚合
    sanitizer.py                   # 用户输入清洗（Infra-PII）
    parsers/
      base.py                      # ParserBase + 校验工具
      plan_output_parser.py
      adjustment_parser.py
      recommendation_parser.py
    prompts/                       # 详见 06-LLM-Prompts.md
      plan_generate.py
      plan_regenerate_range.py
      plan_adjust.py
      recommend_today.py
      _shared.py
  domain/
    __init__.py
    types.py                       # ChatMessage / LlmResponse / LlmRequest
    errors.py                      # LlmServiceError / LlmParseError 等
    quotas.py                      # 配额策略
  infrastructure/
    __init__.py
    openai_compatible_provider.py  # 统一基类
    deepseek_provider.py           # thin wrapper
    dashscope_provider.py          # thin wrapper
    mock_provider.py               # 按 prompt 关键字返回 fixture
```

---

## 3. 配置层

`services/api/src/sikao_api/core/config.py` 追加：

```python
class LlmSettings(BaseSettings):
    # provider 选择：deepseek | dashscope | mock
    llm_provider: Literal["deepseek", "dashscope", "mock"] = "mock"

    # DeepSeek 官方
    deepseek_api_key: SecretStr | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v3.1"

    # 阿里百炼
    dashscope_api_key: SecretStr | None = None
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    dashscope_model: str = "deepseek-v3.1"

    # 通用
    llm_timeout_seconds: int = 60                # plan_generate 较慢
    llm_max_retries: int = 1                      # AI-5
    llm_temperature: float = 0.7
    llm_max_input_tokens: int = 16000
    llm_max_output_tokens: int = 4000

    # 单价（CNY / 1M tokens），用于 cost_tracker
    llm_cost_input_per_1m: float = 1.0
    llm_cost_output_per_1m: float = 2.0

    # 配额（Stage 1 单机：宽松；Stage 2 多用户：收紧）
    llm_quota_per_user_per_day: int = 50          # 总调用次数
    llm_quota_per_user_cost_cny_per_day: float = 5.0

    # cache
    llm_cache_ttl_seconds: int = 3600
```

API key 用户本机部署时通过 `.env` 注入。代码层不读取 secret 明文，仅通过 `SecretStr.get_secret_value()` 暴露给 SDK。

---

## 4. Provider 抽象

### 4.1 接口

```python
class LlmProvider(Protocol):
    async def chat_complete(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        response_format: dict | None = None,    # JSON mode
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: int | None = None,
    ) -> LlmResponse: ...

    async def chat_complete_stream(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: int | None = None,
    ) -> AsyncIterator[LlmStreamChunk]: ...

    @property
    def supports_json_mode(self) -> bool: ...
    @property
    def supports_stream(self) -> bool: ...
    @property
    def name(self) -> str: ...
    @property
    def model(self) -> str: ...
```

### 4.2 LlmResponse

```python
class LlmResponse(BaseModel):
    content: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    finish_reason: Literal["stop", "length", "content_filter", "tool_calls"]
    raw: dict | None = None              # 供调试

class LlmStreamChunk(BaseModel):
    delta: str
    is_done: bool
    finish_reason: str | None = None
    accumulated_tokens: int | None = None
```

### 4.3 OpenAICompatibleProvider 基类

```python
class OpenAICompatibleProvider:
    def __init__(self, *, base_url: str, api_key: str, model: str, name: str):
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        self._model = model
        self._name = name

    async def chat_complete(self, *, system, messages, response_format=None, ...):
        # 调 self._client.chat.completions.create
        # 包装为 LlmResponse
        # 失败抛 ProviderError（含 status_code / 是否可重试）
```

### 4.4 各 provider thin wrapper

```python
class DeepSeekProvider(OpenAICompatibleProvider):
    name = "deepseek"
    supports_json_mode = True
    supports_stream = True

class DashscopeProvider(OpenAICompatibleProvider):
    name = "dashscope"
    supports_json_mode = True
    supports_stream = True

class MockProvider:
    name = "mock"
    supports_json_mode = True
    supports_stream = True

    def __init__(self, fixtures_dir: Path):
        self._fixtures = load_fixtures(fixtures_dir)

    async def chat_complete(self, *, system, messages, ...):
        # 按 system + messages 内的关键字匹配 fixture，返回固定输出
        # 未匹配 → 抛 MockMissError，CI 立刻失败（fail-fast）
```

---

## 5. 流式输出（AI-7）

### 5.1 后端 SSE

`POST /plans/auto-generate` 与 `POST /plans/events/regenerate-range` 返回 `text/event-stream`：

```
event: meta
data: {"plan_id": 123, "estimated_events": 30}

event: event_generated
data: {"index": 1, "title": "...", "start_at": "...", ...}

event: event_generated
data: {"index": 2, ...}

...

event: done
data: {"events_total": 30, "duration_ms": 18500, "cost_cny": 0.12}

event: error
data: {"code": "LLM_PARSE_FAILED", "message": "..."}
```

### 5.2 实现

```python
async def stream_plan_generation(user_id, params):
    yield sse_event("meta", {...})
    full_text_buf = ""
    async for chunk in provider.chat_complete_stream(...):
        full_text_buf += chunk.delta
        # 增量解析：尝试 partial JSON parsing
        new_events = parser.extract_new_events(full_text_buf)
        for evt in new_events:
            await persist_event(evt)              # P6 audit
            yield sse_event("event_generated", evt)
        if chunk.is_done:
            break
    yield sse_event("done", {...})
```

增量 JSON 解析依赖 `ijson` 流式或自定义"找到 `}` 立即尝试 JSON.parse"策略。失败时降级 buffer 全文最后一次性解析。

### 5.3 recommend_today 不流式

payload 小（< 2KB），直接 chat_complete 返回 JSON。

---

## 6. 用户输入清洗（Infra-PII / sanitizer）

### 6.1 风险

会拼进 prompt 的用户字段：
- `PlanV2.name`（用户起的计划名）
- `PlanEventV2.notes`（用户写的备注）
- `RecommendationFeedbackV2.note`（拒绝原因）
- `ProfileGoal.exam_targets[].exam_name`
- AiPlanGenerateDialog 表单中的"重点科目"自由文本

### 6.2 sanitize 规则

```python
def sanitize_user_input(text: str, *, max_length: int = 500) -> str:
    if not text:
        return ""
    # 1. 长度截断
    text = text[:max_length]
    # 2. 去除控制字符（含 \r\n\t 之外的）
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # 3. 屏蔽 prompt 注入关键 token
    blocked = [
        "ignore previous", "ignore the above", "disregard the",
        "system:", "assistant:", "</system>", "<|im_start|>", "<|im_end|>",
        "###", "---SYSTEM---",
    ]
    lower = text.lower()
    for kw in blocked:
        if kw in lower:
            # 替换为占位符，不直接删（保留语义可见性）
            text = re.sub(re.escape(kw), "[REDACTED]", text, flags=re.IGNORECASE)
    return text.strip()
```

### 6.3 模板插入约定

prompt 模板内任何用户字段必须用 `{user_input.xxx}` 命名，且**必须先经 sanitize_user_input**。代码层 lint 检查：

```python
# tests/llm/test_sanitizer_lint.py
# 扫描 prompts/*.py，确保所有 {user_input.*} 在格式化时来自 sanitize_user_input 处理过的值
```

---

## 7. 缓存层（cache.py）

### 7.1 二级缓存

| 级别 | 实现 | TTL | 命中率目标 |
|---|---|---|---|
| L1 | 进程内 LRU（cachetools.TTLCache） | 1 小时 | recommend_today 高（同 user 多次请求） |
| L2 | DB（IdempotencyKeyV2 表） | 24 小时（AI-8） | 防止用户连点烧 token |

### 7.2 cache key

```python
# recommend_today
key = sha256(f"recommend_today:v{prompt_version}:{user_id}:{date}:{signal_hash}")

# plan_generate
# 不缓存（每次输入参数都不同 + 用户期待"重新生成"也走全流程）
# 但 IdempotencyKeyV2 防连点 24h（AI-8）

# plan_adjust
# 不缓存（基于实时数据）
```

### 7.3 缓存 invalidate

- session.submit hook 调用时，invalidate 当前 user 的 recommend_today L1
- profile.exam_targets 改动时，invalidate 该 user 的所有 L1

---

## 8. 成本与配额（cost_tracker / quotas）

### 8.1 cost_tracker

每次 LLM 调用后写 `LlmCallV2`：
- input_tokens / output_tokens 从 provider 返回（含 mock 的固定值）
- cost_cny = (input × cost_input_per_1m + output × cost_output_per_1m) / 1M

### 8.2 quotas（Stage 2 主用，Stage 1 仅打日志）

```python
class LlmQuotaService:
    async def check_quota(self, user_id: int, purpose: LlmPurpose) -> None:
        used = await self.repo.get_today_count(user_id)
        cost = await self.repo.get_today_cost(user_id)
        if used >= settings.llm_quota_per_user_per_day:
            raise QuotaExceededError("daily call quota exceeded")
        if cost >= settings.llm_quota_per_user_cost_cny_per_day:
            raise QuotaExceededError("daily cost quota exceeded")
```

Stage 1（user 只有自己）：超额仅写 audit_log warning，不阻断；Stage 2 切多用户后通过 config flag 启用阻断。

### 8.3 dashboard

`GET /admin/llm/usage`（admin only）：
- 按 user / purpose / day 聚合
- 输出 cost_cny / call_count / parse_failure_rate / avg_latency_ms

---

## 9. 重试与失败兜底（AI-5）

```python
async def with_retry(
    call_fn: Callable[[], Awaitable[T]],
    *,
    max_retries: int,
    retry_on: tuple[type[Exception], ...] = (TimeoutError, ProviderError, ConnectionError),
) -> T:
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return await call_fn()
        except retry_on as e:
            last_exc = e
            if attempt == max_retries:
                break
            backoff = 0.5 * (2 ** attempt)
            await asyncio.sleep(backoff)
    raise LlmServiceError(
        "AI 服务暂时不可用，请稍后重试",
        cause=last_exc,
    )
```

业务层捕获 `LlmServiceError` → 返回 503 + 引导用户手动操作（前端 AI-5 行为）。

---

## 10. JSON mode 与 fallback（结构化输出）

### 10.1 主路径

DeepSeek + 百炼 都支持 OpenAI 兼容的 `response_format={"type": "json_object"}`。

```python
response = await provider.chat_complete(
    system=PLAN_GENERATE_SYSTEM_PROMPT,
    messages=[...],
    response_format={"type": "json_object"},
)
parsed = parser.parse(response.content)
```

### 10.2 fallback：当 JSON 输出仍不合 schema

```python
def parse_with_fallback(raw: str, schema: dict, prompt_purpose: str) -> dict:
    # 1. 直接 json.loads
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # 2. 尝试找到第一个 { 到最后一个 }
        first = raw.find("{")
        last = raw.rfind("}")
        if first >= 0 and last > first:
            try:
                data = json.loads(raw[first:last+1])
            except json.JSONDecodeError:
                raise LlmParseError("invalid_json", raw_excerpt=raw[:500])
        else:
            raise LlmParseError("no_json_object")
    # 3. JSON Schema 校验
    try:
        jsonschema.validate(data, schema)
    except jsonschema.ValidationError as e:
        raise LlmParseError("schema_violation", details=str(e))
    return data
```

LlmParseError 写 audit_log（parse_status='invalid_json' 或 'schema_violation'），业务层返回 502 LLM_PARSE_FAILED。

### 10.3 mock 也跑 schema

mock fixture 必须经过相同 parse_with_fallback 校验，防止"测试通过但生产挂"。

---

## 11. Service facade（service.py）

```python
class LlmService:
    def __init__(self, *, provider, cache, cost_tracker, quotas, sanitizer, repo):
        ...

    async def generate_plan(
        self,
        *,
        user_id: int,
        params: PlanGenerateParams,
        idempotency_key: str,
    ) -> AsyncIterator[PlanGenerateStreamEvent]:
        await self.quotas.check_quota(user_id, LlmPurpose.PLAN_GENERATE)
        prompt = render_plan_generate_prompt(
            params=params,
            user_input_sanitized=self.sanitizer.sanitize(params.user_notes),
        )
        # ... 流式调用 + 增量解析 + 持久化 + audit
        async for event in stream_plan_generation(...):
            yield event

    async def adjust_plan(self, *, user_id, plan_id) -> PlanAdjustmentV2:
        ...

    async def recommend_today(self, *, user_id) -> list[RecommendationV2]:
        ...

    async def regenerate_range(
        self,
        *,
        user_id: int,
        plan_id: int,
        from_date: date,
        to_date: date,
    ) -> AsyncIterator[StreamEvent]:
        ...
```

**纪律**：
- LLM 模块**不暴露 HTTP 端点**（避免 prompt injection）
- 仅供 `modules/plans/`、`modules/recommendations/` 内部调用
- 所有调用必须经 `application/service.py` 的 facade 函数
- prompt 与 parser 必须有单测（用 mock provider + fixture）

---

## 12. 测试策略

### 12.1 单元测试

| 文件 | 覆盖 |
|---|---|
| `tests/llm/test_sanitizer.py` | sanitize_user_input 边界（注入 token / 长字符串 / 控制字符） |
| `tests/llm/test_parser_plan.py` | plan_output_parser 解析 happy / invalid_json / schema_violation / partial json |
| `tests/llm/test_parser_adjustment.py` | 同上 |
| `tests/llm/test_parser_recommendation.py` | 同上 |
| `tests/llm/test_cache.py` | L1/L2 命中 / 过期 / invalidate |
| `tests/llm/test_cost_tracker.py` | token 计数 / 成本计算 |
| `tests/llm/test_quotas.py` | 超额 / 边界 |
| `tests/llm/test_retry.py` | 重试逻辑 / backoff / fail-fast |
| `tests/llm/test_provider_mock.py` | mock fixture 加载 / 关键字匹配 / 缺失抛错 |
| `tests/llm/test_sanitizer_lint.py` | 静态扫描 prompts 目录 |

### 12.2 集成测试（用 mock provider）

| 文件 | 覆盖 |
|---|---|
| `tests/llm/integration/test_generate_plan.py` | facade 全流程：sanitize → prompt → mock provider → parse → persist |
| `tests/llm/integration/test_adjust_plan.py` | 同 |
| `tests/llm/integration/test_recommend_today.py` | 同（含阈值表生效验证） |

### 12.3 真 provider 联调脚本（CI 不跑）

```
services/api/scripts/llm_smoke.py
```

手动跑：
```bash
LLM_PROVIDER=deepseek DEEPSEEK_API_KEY=... python services/api/scripts/llm_smoke.py plan_generate
```

输出：实际 prompt / 响应 / parsed output / cost。结果不入库（dry_run mode）。

---

## 13. 部署与切换（Stage 1 → Stage 2）

| 维度 | Stage 1（单机） | Stage 2（多用户） |
|---|---|---|
| Cache L1 | cachetools 进程内 | 同 |
| Cache L2 | SQLite DB | PostgreSQL DB |
| Quota | 仅 audit warning | 启用阻断 + admin override |
| Streaming | uvicorn + SSE 单 worker | uvicorn + SSE + sticky session（nginx） |
| Provider failover | 单 provider | 多 provider 自动 failover（DeepSeek 限流时切百炼） |
| Cost dashboard | 无 | `/admin/llm/usage` |

failover 实现（Stage 2）：

```python
class FailoverProvider:
    def __init__(self, primary, secondary):
        ...
    async def chat_complete(self, ...):
        try:
            return await self.primary.chat_complete(...)
        except (RateLimitedError, ServiceUnavailableError):
            metrics.incr("llm.failover.triggered")
            return await self.secondary.chat_complete(...)
```

---

## 14. 引用矩阵

| 本文档被引用 |
|---|
| `06-LLM-Prompts.md` 模板按本文 §2 / §6 / §10 约定 |
| `02-Data-Model.md` LlmCallV2 / IdempotencyKeyV2 |
| `03-Backend-WU.md` WU-B7 PR 拆分 |
| `08-NonFunctional.md` 限流 / 配额 / 部署形态 |
| `09-Observability-Audit.md` cost_tracker 写 LlmCallV2 |
