from __future__ import annotations

from typing import Any

from sikao_api.modules.session.application import hooks as submit_hooks_module


class _SchedulerStub:
    def __init__(
        self,
        *,
        progress_result: bool = True,
        recommender_result: bool = True,
        raise_progress: bool = False,
        raise_recommender: bool = False,
    ) -> None:
        self.progress_result = progress_result
        self.recommender_result = recommender_result
        self.raise_progress = raise_progress
        self.raise_recommender = raise_recommender
        self.progress_calls: list[tuple[int, int | None, str | None]] = []
        self.recommender_calls: list[tuple[int, int, str | None]] = []

    def enqueue_submit_progress_refresh(
        self,
        *,
        user_id: int,
        session_id: int | None,
        request_id: str | None,
    ) -> bool:
        self.progress_calls.append((user_id, session_id, request_id))
        if self.raise_progress:
            raise RuntimeError("progress enqueue boom")
        return self.progress_result

    def enqueue_submit_recommender_refresh(
        self,
        *,
        user_id: int,
        session_id: int,
        request_id: str | None,
    ) -> bool:
        self.recommender_calls.append((user_id, session_id, request_id))
        if self.raise_recommender:
            raise RuntimeError("recommender enqueue boom")
        return self.recommender_result


def test_on_session_submit_progress_enqueue_false_uses_fallback(monkeypatch) -> None:
    fallback_calls: list[tuple[int, int | None]] = []

    def _fallback(*, session_factory: Any, user_id: int, session_id: int | None) -> bool:
        del session_factory
        fallback_calls.append((user_id, session_id))
        return True

    scheduler = _SchedulerStub(progress_result=False, recommender_result=True)
    monkeypatch.setattr(
        submit_hooks_module,
        "run_progress_submit_hooks_isolated",
        _fallback,
    )

    submit_hooks_module.on_session_submit(
        session_factory=lambda: None,
        user_id=7,
        session_id=11,
        request_id="req-1",
        home_scheduler=scheduler,
    )

    assert scheduler.progress_calls == [(7, 11, "req-1")]
    assert scheduler.recommender_calls == [(7, 11, "req-1")]
    assert fallback_calls == [(7, 11)]


def test_on_session_submit_progress_enqueue_exception_uses_fallback(monkeypatch) -> None:
    fallback_calls: list[tuple[int, int | None]] = []

    def _fallback(*, session_factory: Any, user_id: int, session_id: int | None) -> bool:
        del session_factory
        fallback_calls.append((user_id, session_id))
        return True

    scheduler = _SchedulerStub(
        progress_result=True,
        recommender_result=True,
        raise_progress=True,
    )
    monkeypatch.setattr(
        submit_hooks_module,
        "run_progress_submit_hooks_isolated",
        _fallback,
    )

    submit_hooks_module.on_session_submit(
        session_factory=lambda: None,
        user_id=8,
        session_id=12,
        request_id="req-2",
        home_scheduler=scheduler,
    )

    assert scheduler.progress_calls == [(8, 12, "req-2")]
    assert scheduler.recommender_calls == [(8, 12, "req-2")]
    assert fallback_calls == [(8, 12)]


def test_on_session_submit_recommender_enqueue_failures_do_not_raise(monkeypatch) -> None:
    fallback_calls: list[tuple[int, int | None]] = []

    def _fallback(*, session_factory: Any, user_id: int, session_id: int | None) -> bool:
        del session_factory
        fallback_calls.append((user_id, session_id))
        return True

    scheduler = _SchedulerStub(
        progress_result=False,
        recommender_result=False,
        raise_recommender=True,
    )
    monkeypatch.setattr(
        submit_hooks_module,
        "run_progress_submit_hooks_isolated",
        _fallback,
    )

    submit_hooks_module.on_session_submit(
        session_factory=lambda: None,
        user_id=9,
        session_id=13,
        request_id="req-3",
        home_scheduler=scheduler,
    )

    assert fallback_calls == [(9, 13)]
    assert scheduler.recommender_calls == [(9, 13, "req-3")]
