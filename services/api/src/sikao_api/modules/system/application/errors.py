from __future__ import annotations


class ServiceError(Exception):
    def __init__(self, message: str, *, status_code: int, code: str) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


class ValidationError(ServiceError):
    def __init__(self, message: str, *, code: str = "validation_error") -> None:
        super().__init__(message, status_code=422, code=code)


class NotFoundError(ServiceError):
    def __init__(self, message: str, *, code: str = "not_found") -> None:
        super().__init__(message, status_code=404, code=code)


class ConflictError(ServiceError):
    def __init__(self, message: str, *, code: str = "conflict") -> None:
        super().__init__(message, status_code=409, code=code)


class UnauthorizedError(ServiceError):
    def __init__(self, message: str = "authentication required", *, code: str = "unauthorized") -> None:
        super().__init__(message, status_code=401, code=code)


class ForbiddenError(ServiceError):
    def __init__(self, message: str = "forbidden", *, code: str = "forbidden") -> None:
        super().__init__(message, status_code=403, code=code)


class GoneError(ServiceError):
    """410: resource existed but is no longer valid (expired / used).

    Phase B (auth recovery): reset / verify token 过期或已用过返 410, 让
    前端能区分 "token 不存在" (400/422) vs "token 曾经有效但失效了"
    (410, 给 'token 已过期, 请重新申请' UX).
    """

    def __init__(self, message: str = "resource gone", *, code: str = "gone") -> None:
        super().__init__(message, status_code=410, code=code)


class LLMServiceError(ServiceError):
    """503: LLM provider 不可用 (config 缺失 / API 5xx / network 失败).

    Slice 0a 起统一 LLM 错误返码. route 层 catch 后 503 + code 让前端
    分态展示 (config_missing → "AI 服务尚未配置" / 其他 → "AI 服务暂时不可用").
    """

    def __init__(
        self, message: str = "llm service unavailable", *, code: str = "llm_service_unavailable"
    ) -> None:
        super().__init__(message, status_code=503, code=code)


class LLMParseError(ServiceError):
    """502: upstream LLM returned text that cannot be parsed into the expected schema."""

    def __init__(
        self, message: str = "llm parse failed", *, code: str = "llm_parse_failed"
    ) -> None:
        super().__init__(message, status_code=502, code=code)


class QuotaExceededError(ServiceError):
    """429: per-user quota/cost budget exceeded."""

    def __init__(
        self, message: str = "quota exceeded", *, code: str = "quota_exceeded"
    ) -> None:
        super().__init__(message, status_code=429, code=code)
