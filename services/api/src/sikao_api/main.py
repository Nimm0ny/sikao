from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sikao_api.core.config import Settings, get_settings
from sikao_api.db.session import DatabaseManager
from sikao_api.modules.content.interface import routes as content_v2
from sikao_api.modules.daily_practice.interface import routes as daily_practice_v2
from sikao_api.modules.essay_grading.interface import routes as essay_grading_v2
from sikao_api.modules.favorites.interface import routes as favorites_v2
from sikao_api.modules.identity.interface import routes as identity_v2
from sikao_api.modules.ai_questions.interface import routes as ai_questions_v2
from sikao_api.modules.notes_v2.interface import ai_routes as notes_v2_ai
from sikao_api.modules.notes_v2.interface import routes as notes_v2_skeleton
from sikao_api.modules.planning.interface import routes as planning_v2
from sikao_api.modules.plans.interface import routes as plans_v2
from sikao_api.modules.profile_v2.interface import routes as profile_v2
from sikao_api.modules.progress.interface import routes as progress_v2_skeleton
from sikao_api.modules.practice_stats.interface import routes as practice_stats_v2
from sikao_api.modules.question_flags.interface import routes as question_flags_v2
from sikao_api.modules.question_reports.interface import admin_routes as question_reports_admin_v2
from sikao_api.modules.question_reports.interface import routes as question_reports_v2
from sikao_api.modules.recommendations.interface import routes as recommendations_v2
from sikao_api.modules.review.interface import routes as review_v2
from sikao_api.modules.mock_exam.interface import routes as mock_exam_v2
from sikao_api.modules.notes_v2.infrastructure.meilisearch_client import (
    NotesSearchUnavailable,
    build_notes_search_client,
)
from sikao_api.modules.practice_preferences.interface import routes as practice_preferences_v2
from sikao_api.modules.session.interface import routes as session_v2
from sikao_api.modules.session_lifecycle.interface import routes as session_lifecycle_v2
from sikao_api.modules.timing.interface import routes as timing_v2
from sikao_api.modules.system.application.errors import ServiceError
from sikao_api.modules.system.interface import ops
from sikao_api.modules.system.interface import routes as system_v2

_logger = logging.getLogger(__name__)


def create_app(*, settings: Settings | None = None, initialize_schema: bool | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    if settings is not None:
        app_settings.ensure_runtime_dirs()
        app_settings.validate_runtime()
    db = DatabaseManager(app_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        from sikao_api.core.limiter import close_limiter, init_limiter
        from sikao_api.core.home_scheduler import build_home_scheduler
        from sikao_api.core.scheduler import build_deletion_sweep_scheduler

        app.state.settings = app_settings
        app.state.db = db
        _logger.info("backend startup: database_url=%s", app_settings.database_url)
        notes_search_client = build_notes_search_client(app_settings)
        app.state.notes_search_client = notes_search_client
        # SQLite test/dev convenience only; all non-SQLite environments must use Alembic.
        if initialize_schema is True or (initialize_schema is None and app_settings.is_sqlite):
            db.create_all()
        await init_limiter(app_settings.redis_url)

        # Phase-Profile PR-P6: hard-delete sweep scheduler (D-P11 / Del-5).
        # build_* 内部检查 enabled flag, 默认 None → lifespan 不启动 sweep,
        # pytest / dev 默认无开销.
        deletion_scheduler = build_deletion_sweep_scheduler(
            db,
            enabled=app_settings.deletion_sweep_enabled,
            interval_seconds=app_settings.deletion_sweep_interval_seconds,
            initial_delay_seconds=app_settings.deletion_sweep_initial_delay_seconds,
            run_on_startup=app_settings.deletion_sweep_run_on_startup,
        )
        app.state.deletion_scheduler = deletion_scheduler
        if deletion_scheduler is not None:
            await deletion_scheduler.start()

        home_scheduler = build_home_scheduler(
            db,
            settings=app_settings,
        )
        app.state.home_scheduler = home_scheduler
        if home_scheduler is not None:
            await home_scheduler.start()
        if notes_search_client.is_enabled:
            try:
                await asyncio.to_thread(notes_search_client.init_index)
            # FAIL-FAST EXCEPTION (lhr authorized 2026-05-26): Notes search init must not block API boot.
            # Registered: docs/engineering/fail-fast-exceptions.md#notes-search-startup-init-degrade
            except NotesSearchUnavailable:
                _logger.exception("notes.search.init_failed")
        try:
            yield
        finally:
            if home_scheduler is not None:
                await home_scheduler.stop()
            # Stop scheduler before limiter — 让后台 sweep 优雅退出, 之后再断 redis.
            if deletion_scheduler is not None:
                await deletion_scheduler.stop()
            notes_search_client.close()
            await close_limiter()

    app = FastAPI(title=app_settings.app_name, version=app_settings.app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(app_settings.cors_allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-CSRF-Token",
            "Idempotency-Key",
            "X-Release-Execution-Id",
        ],
        expose_headers=["X-Request-Id", "X-Trace-Id", "X-App-Version"],
    )

    @app.middleware("http")
    async def add_request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("X-Request-Id") or uuid4().hex
        trace_id = request.headers.get("X-Trace-Id") or request_id
        request.state.request_id = request_id
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Trace-Id"] = trace_id
        response.headers["X-App-Version"] = app_settings.app_version
        return response

    @app.exception_handler(ServiceError)
    async def handle_service_error(request: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.message,
                "code": exc.code,
                "requestId": getattr(request.state, "request_id", None),
            },
        )

    app.include_router(ops.router)
    app.include_router(system_v2.router)
    app.include_router(identity_v2.router)
    app.include_router(planning_v2.router)
    app.include_router(plans_v2.router)
    app.include_router(progress_v2_skeleton.router)
    app.include_router(recommendations_v2.router)
    app.include_router(content_v2.router)
    app.include_router(daily_practice_v2.router)
    app.include_router(essay_grading_v2.router)
    app.include_router(favorites_v2.router)
    app.include_router(question_flags_v2.router)
    app.include_router(practice_stats_v2.router)
    app.include_router(ai_questions_v2.router)
    app.include_router(mock_exam_v2.router)
    app.include_router(practice_preferences_v2.router)
    app.include_router(question_reports_v2.router)
    app.include_router(question_reports_admin_v2.router)
    app.include_router(session_lifecycle_v2.router)
    app.include_router(timing_v2.router)
    app.include_router(session_v2.router)
    app.include_router(review_v2.router)
    app.include_router(review_v2.admin_router)
    app.include_router(notes_v2_ai.router)
    app.include_router(notes_v2_skeleton.router)
    app.include_router(profile_v2.router)
    app.include_router(profile_v2.me_router)
    return app


app = create_app()
