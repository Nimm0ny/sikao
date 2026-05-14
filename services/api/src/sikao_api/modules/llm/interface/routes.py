"""LLM token usage + BYOM config endpoints — Slice 0b + 0c.

Slice 0b (usage):
  GET /api/v2/llm/usage/me                      # 用户自己用量 (require auth)
  GET /api/v2/admin/llm/usage                   # 全局用量 (require admin Basic)

Slice 0c (BYOM CRUD, all require cookie auth + CSRF for mutating):
  GET    /api/v2/llm/configs                    # 列我的
  POST   /api/v2/llm/configs                    # 创建 (含 SSRF check + AES encrypt)
  PATCH  /api/v2/llm/configs/{id}               # 改 partial (api_key 改触发 re-encrypt)
  DELETE /api/v2/llm/configs/{id}               # 删
  POST   /api/v2/llm/configs/{id}/set-default   # 设默认 (其他 is_default=False)
  POST   /api/v2/llm/configs/{id}/test          # 测连通性 (1 token round-trip)
"""

from __future__ import annotations

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.llm.application.llm import LLMMessage
from sikao_api.modules.llm.application.llm.byom_config import InvalidEncryptedBlob
from sikao_api.modules.llm.application.llm.ssrf_guard import SsrfBlockedError
from sikao_api.modules.llm.application.usage import (
    UsageByFeature,
    UsageByUser,
    UsageDay,
    UsageSummary,
    get_admin_usage_summary,
    get_user_usage_summary,
)
from sikao_api.modules.auth.application.security import (
    get_admin_principal,
    get_current_user,
    verify_csrf_token,
)
from sikao_api.modules.llm.application.user_configs import TestStatus, UserLlmConfigService

logger = logging.getLogger(__name__)

# User-facing router (auth required) — Profile LlmUsageCard 拉.
router = APIRouter(prefix="/api/v2/llm", tags=["llm-v2"])

# Admin router — basic-auth admin only, global aggregate.
admin_router = APIRouter(prefix="/api/v2/admin/llm", tags=["llm-admin-v2"])


def _serialize_summary(summary: UsageSummary) -> schemas.LlmUsageSummaryV2:
    return schemas.LlmUsageSummaryV2(
        total_tokens=summary.total_tokens,
        total_cost_cents=summary.total_cost_cents,
        by_feature={
            feat: _serialize_by_feature(value)
            for feat, value in summary.by_feature.items()
        },
        recent_days=[_serialize_day(d) for d in summary.recent_days],
        by_user=(
            [_serialize_by_user(u) for u in summary.by_user]
            if summary.by_user is not None
            else None
        ),
    )


def _serialize_by_feature(value: UsageByFeature) -> schemas.LlmUsageByFeatureV2:
    return schemas.LlmUsageByFeatureV2(
        prompt_tokens=value.prompt_tokens,
        completion_tokens=value.completion_tokens,
        cost_cents=value.cost_cents,
    )


def _serialize_day(day: UsageDay) -> schemas.LlmUsageDayV2:
    return schemas.LlmUsageDayV2(
        date=day.date.isoformat(),
        tokens=day.tokens,
        cost_cents=day.cost_cents,
    )


def _serialize_by_user(value: UsageByUser) -> schemas.LlmUsageByUserV2:
    return schemas.LlmUsageByUserV2(
        user_id=value.user_id,
        username=value.username,
        total_tokens=value.total_tokens,
        total_cost_cents=value.total_cost_cents,
    )


@router.get("/usage/me", response_model=schemas.LlmUsageSummaryV2)
def get_my_usage(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.LlmUsageSummaryV2:
    """Profile 'My LLM usage' card. Aggregate over last 30 days."""
    summary = get_user_usage_summary(session, user_id=user.id)
    return _serialize_summary(summary)


@admin_router.get("/usage", response_model=schemas.LlmUsageSummaryV2)
def get_global_usage(
    session: Annotated[Session, Depends(get_db_session)],
    _: Annotated[str, Depends(get_admin_principal)],
) -> schemas.LlmUsageSummaryV2:
    """Admin LlmUsageAdmin view. System-wide aggregate (含 anonymous calls)."""
    summary = get_admin_usage_summary(session)
    return _serialize_summary(summary)


# ─── BYOM configs CRUD (Slice 0c) ─────────────────────────────────────────


def _serialize_config(data: dict[str, object]) -> schemas.LlmConfigV2:
    """service.serialize_masked → LlmConfigV2 (CamelModel auto camelCase)."""
    return schemas.LlmConfigV2(
        id=data["id"],  # type: ignore[arg-type]
        label=data["label"],  # type: ignore[arg-type]
        base_url=data["base_url"],  # type: ignore[arg-type]
        model=data["model"],  # type: ignore[arg-type]
        is_default=data["is_default"],  # type: ignore[arg-type]
        api_key_masked=data["api_key_masked"],  # type: ignore[arg-type]
        last_tested_at=data["last_tested_at"],  # type: ignore[arg-type]
        last_tested_status=data["last_tested_status"],  # type: ignore[arg-type]
        created_at=data["created_at"],  # type: ignore[arg-type]
        updated_at=data["updated_at"],  # type: ignore[arg-type]
    )


@router.get("/configs", response_model=schemas.LlmConfigListResponse)
def list_my_configs(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.LlmConfigListResponse:
    """List my BYOM configs. api_key always masked (never raw)."""
    service = UserLlmConfigService(session, settings)
    configs = service.list(user_id=user.id)
    items = [_serialize_config(d) for d in service.serialize_masked(configs)]
    return schemas.LlmConfigListResponse(items=items)


@router.post(
    "/configs",
    response_model=schemas.LlmConfigV2,
    status_code=status.HTTP_201_CREATED,
)
def create_my_config(
    payload: schemas.LlmConfigCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> schemas.LlmConfigV2:
    """Create BYOM config. SSRF check + AES encrypt + UNIQUE label per user."""
    service = UserLlmConfigService(session, settings)
    config = service.create(
        user_id=user.id,
        label=payload.label,
        base_url=payload.base_url,
        api_key=payload.api_key,
        model=payload.model,
    )
    [serialized] = service.serialize_masked([config])
    return _serialize_config(serialized)


@router.patch("/configs/{config_id}", response_model=schemas.LlmConfigV2)
def update_my_config(
    config_id: int,
    payload: schemas.LlmConfigUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> schemas.LlmConfigV2:
    """Partial update. base_url 改触发 SSRF re-check, api_key 改触发 AES re-encrypt."""
    service = UserLlmConfigService(session, settings)
    config = service.update(
        user_id=user.id,
        config_id=config_id,
        label=payload.label,
        base_url=payload.base_url,
        api_key=payload.api_key,
        model=payload.model,
    )
    [serialized] = service.serialize_masked([config])
    return _serialize_config(serialized)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_config(
    config_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> Response:
    UserLlmConfigService(session, settings).delete(
        user_id=user.id, config_id=config_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/configs/{config_id}/set-default", response_model=schemas.LlmConfigV2
)
def set_default_my_config(
    config_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> schemas.LlmConfigV2:
    """设当前 config 默认 (build_llm_provider 优先读). 其他 is_default=False."""
    service = UserLlmConfigService(session, settings)
    config = service.set_default(user_id=user.id, config_id=config_id)
    [serialized] = service.serialize_masked([config])
    return _serialize_config(serialized)


@router.post(
    "/configs/{config_id}/test", response_model=schemas.LlmConfigTestResponse
)
async def test_my_config(
    config_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> schemas.LlmConfigTestResponse:
    """Test connectivity: 1-token round-trip 调用 LLM, 写 last_tested_at + status.

    status 字面量 (TestStatus Literal):
      - 'ok': 200 + 正常返
      - 'auth_failed': 401/403
      - 'unreachable': 其他 4xx/5xx / network error
      - 'timeout': httpx.TimeoutException

    sync service + async route 混合: service 只 build provider (decrypt + SSRF
    re-check), route handler 跑 await call.
    """
    service = UserLlmConfigService(session, settings)

    # Phase 1: build provider (decrypt + SSRF re-check). 失败 → 'unreachable'.
    # 5th-review P1 #A: master key 漂移 / DNS rebind 让 build_provider 抛
    # InvalidEncryptedBlob / SsrfBlockedError, 之前裸调让 endpoint 500.
    try:
        provider, config = service.build_provider(
            user_id=user.id, config_id=config_id, timeout_seconds=10.0
        )
    except (InvalidEncryptedBlob, SsrfBlockedError) as exc:
        logger.warning(
            "llm.byom.test_setup_failed config_id=%s err=%s",
            config_id,
            exc,
        )
        service.update_test_status(user_id=user.id, config_id=config_id, status="unreachable")
        return schemas.LlmConfigTestResponse(status="unreachable")

    # Phase 2: actual LLM call. status 字面量 (TestStatus Literal):
    #   - 'ok': 200 + 正常返
    #   - 'auth_failed': 401/403
    #   - 'unreachable': 其他 4xx/5xx / network error / build_provider 失败
    #   - 'timeout': httpx.TimeoutException
    test_status: TestStatus
    try:
        await provider.chat_completion(
            messages=[LLMMessage(role="user", content="ping")],
            model=config.model,
            max_tokens=1,
        )
        test_status = "ok"
    except httpx.HTTPStatusError as exc:
        test_status = (
            "auth_failed"
            if exc.response.status_code in (401, 403)
            else "unreachable"
        )
    except httpx.TimeoutException:
        test_status = "timeout"
    except Exception as exc:
        # 网络问题 / DNS 失败 / etc — 记 warn log 让 dev 排查.
        logger.warning(
            "llm.byom.test failed config_id=%s err=%s",
            config_id,
            exc,
        )
        test_status = "unreachable"

    service.update_test_status(user_id=user.id, config_id=config_id, status=test_status)
    return schemas.LlmConfigTestResponse(status=test_status)
