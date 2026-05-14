from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# === Modular route imports (sikao module layout) ===
# 每个 module 内 interface/<file>.py 提供 `router` (与 admin/public 变体).
from sikao_api.modules.admin.interface import note_reports as admin_note_reports_v2
from sikao_api.modules.admin.interface import routes as admin_v2
from sikao_api.modules.analytics.interface import xingce_specialty as xingce_specialty_v2
from sikao_api.modules.answer_session.interface import routes as practice_v2
from sikao_api.modules.auth.interface import routes as auth_v2
from sikao_api.modules.essay.interface import routes as essay_v2
from sikao_api.modules.essay.interface import specialty as essay_specialty_v2
from sikao_api.modules.exam_events.interface import routes as exam_events_v2
from sikao_api.modules.llm.interface import conversations as llm_conversations_v2
from sikao_api.modules.llm.interface import routes as llm_v2
from sikao_api.modules.notes.interface import notebook as notebook_v2
from sikao_api.modules.notes.interface import routes as notes_v2
from sikao_api.modules.notes.interface import social as note_social_v2
from sikao_api.modules.question_bank.interface import routes as papers_v2
from sikao_api.modules.study_record.interface import routes as study_plan_v2
from sikao_api.modules.system.interface import ops
from sikao_api.modules.system.interface import routes as system_v2
from sikao_api.modules.user.interface import exams as user_exams_v2
from sikao_api.modules.analytics.interface import progress as progress_v2
from sikao_api.modules.user.interface import routes as me_v2

from sikao_api.core.config import Settings, get_settings
from sikao_api.db.session import DatabaseManager
from sikao_api.modules.system.application.errors import ServiceError
from sikao_api.modules.study_record.application.study_plans import (
    FallbackPaperMissingError,
    assert_fallback_paper_loadable,
)

_logger = logging.getLogger(__name__)


def create_app(*, settings: Settings | None = None, initialize_schema: bool | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    db = DatabaseManager(app_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        from sikao_api.core.limiter import close_limiter, init_limiter

        app.state.settings = app_settings
        app.state.db = db
        _logger.info("backend startup: database_url=%s", app_settings.database_url)
        if initialize_schema is True or (initialize_schema is None and app_settings.is_sqlite):
            db.create_all()
        await init_limiter(app_settings.redis_url)
        try:
            with db.session_factory() as session:
                assert_fallback_paper_loadable(session)
        except FallbackPaperMissingError as exc:
            if app_settings.app_env == "prod":
                raise
            _logger.error(
                "study_plan.fallback_paper_missing (non-prod allows boot) — "
                "fix before serving traffic: %s\n"
                "  TO FIX: import paper FENBI-7274732 with required sourceUuids "
                "enabled.\n"
                "    `python -m sikao_api.scripts.import_fenbi_batch "
                "--mirror .claude/fenbi-mirror` (see CLAUDE.md §12)",
                exc,
            )
        try:
            yield
        finally:
            await close_limiter()

    app = FastAPI(title=app_settings.app_name, version=app_settings.app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(app_settings.cors_allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
            content={"detail": exc.message, "code": exc.code, "requestId": getattr(request.state, "request_id", None)},
        )

    # Router prefixes 都嵌在各自 router 对象内（沿用旧约定）。
    app.include_router(ops.router)
    app.include_router(auth_v2.router)
    app.include_router(system_v2.router)
    app.include_router(papers_v2.router)
    app.include_router(practice_v2.router)
    app.include_router(admin_v2.router)
    app.include_router(exam_events_v2.public_router)
    app.include_router(exam_events_v2.admin_router)
    app.include_router(llm_v2.router)
    app.include_router(llm_v2.admin_router)
    app.include_router(llm_conversations_v2.router)
    app.include_router(essay_v2.router)
    app.include_router(essay_specialty_v2.router)
    app.include_router(xingce_specialty_v2.router)
    app.include_router(study_plan_v2.router)
    app.include_router(me_v2.router)
    app.include_router(notes_v2.router)
    app.include_router(notebook_v2.router)
    app.include_router(note_social_v2.router)
    app.include_router(admin_note_reports_v2.router)
    app.include_router(user_exams_v2.router)
    app.include_router(progress_v2.router)
    return app


app = create_app()
