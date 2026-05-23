from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.daily_practice.application.service import ensure_daily_for_date
from sikao_api.modules.progress.application.aggregates import today_cn
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ServiceError


@dataclass(frozen=True)
class DailyPracticeCronResult:
    generated_count: int
    skipped_count: int
    failure_count: int


def generate_daily_practice(
    session: Session,
    settings: Settings,
    *,
    target_date: date | None = None,
    type_names: tuple[str, ...] = ("xingce", "essay"),
) -> DailyPracticeCronResult:
    run_date = target_date or today_cn()
    user_ids = list(
        session.scalars(select(UserV2.id).where(UserV2.is_active.is_(True)))
    )
    child_factory = sessionmaker(bind=session.get_bind(), expire_on_commit=False)

    generated_count = 0
    skipped_count = 0
    failure_count = 0

    for user_id in user_ids:
        for type_name in type_names:
            child_session = child_factory()
            try:
                user = child_session.get(UserV2, user_id)
                if user is None or not user.is_active:
                    child_session.close()
                    continue
                row, created = ensure_daily_for_date(
                    child_session,
                    settings=settings,
                    user=user,
                    type_name=type_name,
                    date_value=run_date,
                )
                if created:
                    add_audit_log(
                        child_session,
                        user_id=user.id,
                        actor_type="system",
                        actor_id="practice.daily.generate",
                        action="daily.generate",
                        target_type="daily_practice_v2",
                        target_id=row.id,
                        metadata={
                            "type": type_name,
                            "date": run_date.isoformat(),
                            "strategy": row.generation_strategy,
                        },
                        request_id=None,
                        ip=None,
                    )
                    generated_count += 1
                else:
                    skipped_count += 1
                child_session.commit()
            except Exception as exc:  # noqa: BLE001
                child_session.rollback()
                add_audit_log(
                    child_session,
                    user_id=int(user_id),
                    actor_type="system",
                    actor_id="practice.daily.generate",
                    action="daily.generate_failed",
                    target_type="user_v2",
                    target_id=int(user_id),
                    metadata={
                        "type": type_name,
                        "date": run_date.isoformat(),
                        "error": _serialize_error(exc),
                    },
                    request_id=None,
                    ip=None,
                )
                child_session.commit()
                failure_count += 1
            finally:
                child_session.close()

    return DailyPracticeCronResult(
        generated_count=generated_count,
        skipped_count=skipped_count,
        failure_count=failure_count,
    )


def _serialize_error(exc: Exception) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": type(exc).__name__,
        "message": str(exc),
    }
    if isinstance(exc, ServiceError):
        payload["code"] = exc.code
    return payload
