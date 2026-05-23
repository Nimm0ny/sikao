from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Protocol

from sqlalchemy.orm import Session

from sikao_api.modules.session.application.submit_hooks import run_progress_submit_hooks

logger = logging.getLogger(__name__)


class SubmitHookScheduler(Protocol):
    def enqueue_submit_progress_refresh(
        self,
        *,
        user_id: int,
        session_id: int | None,
        request_id: str | None,
    ) -> bool: ...

    def enqueue_submit_recommender_refresh(
        self,
        *,
        user_id: int,
        session_id: int,
        request_id: str | None,
    ) -> bool: ...


def on_session_submit(
    *,
    session_factory: Callable[[], Session],
    user_id: int,
    session_id: int,
    request_id: str | None,
    home_scheduler: SubmitHookScheduler | None,
) -> None:
    progress_enqueued = False
    if home_scheduler is not None:
        try:
            progress_enqueued = home_scheduler.enqueue_submit_progress_refresh(
                user_id=user_id,
                session_id=session_id,
                request_id=request_id,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "submit_progress_enqueue_failed user_id=%s session_id=%s",
                user_id,
                session_id,
            )
    if not progress_enqueued:
        run_progress_submit_hooks_isolated(
            session_factory=session_factory,
            user_id=user_id,
            session_id=session_id,
        )

    if home_scheduler is None:
        return
    try:
        recommender_enqueued = home_scheduler.enqueue_submit_recommender_refresh(
            user_id=user_id,
            session_id=session_id,
            request_id=request_id,
        )
        if not recommender_enqueued:
            logger.warning(
                "submit_recommender_enqueue_skipped user_id=%s session_id=%s",
                user_id,
                session_id,
            )
    except Exception:  # noqa: BLE001
        logger.exception(
            "submit_recommender_enqueue_failed user_id=%s session_id=%s",
            user_id,
            session_id,
        )


def run_progress_submit_hooks_isolated(
    *,
    session_factory: Callable[[], Session],
    user_id: int,
    session_id: int | None,
) -> bool:
    session = session_factory()
    try:
        run_progress_submit_hooks(session, user_id=user_id, session_id=session_id)
        session.commit()
        return True
    except Exception:  # noqa: BLE001
        session.rollback()
        logger.exception(
            "submit_progress_fallback_failed user_id=%s session_id=%s",
            user_id,
            session_id,
        )
        return False
    finally:
        session.close()
