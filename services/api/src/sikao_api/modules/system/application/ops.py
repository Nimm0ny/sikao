from __future__ import annotations

from typing import Literal

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db import schemas
from sikao_api.db.models import Paper, PaperRevision


class OpsService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    def healthz(self) -> schemas.HealthResponse:
        return schemas.HealthResponse(status="ok")

    def readyz(self) -> schemas.ReadyzResponse:
        dependencies: list[schemas.ReadyzDependency] = []
        status: Literal["ok", "error"] = "ok"

        try:
            self.session.execute(text("SELECT 1"))
            dependencies.append(
                schemas.ReadyzDependency(name="database", status="ok", detail="database reachable")
            )
        except Exception as exc:
            dependencies.append(schemas.ReadyzDependency(name="database", status="error", detail=str(exc)))
            status = "error"

        if self.settings.redis_url:
            dependencies.append(
                schemas.ReadyzDependency(
                    name="redis",
                    status="skipped",
                    detail="configured but not enabled in PoC runtime",
                )
            )
        else:
            dependencies.append(schemas.ReadyzDependency(name="redis", status="skipped", detail="not configured"))

        if self.settings.storage_healthcheck_url:
            dependencies.append(
                schemas.ReadyzDependency(
                    name="objectStorage",
                    status="skipped",
                    detail="configured but not enabled in PoC runtime",
                )
            )
        else:
            dependencies.append(
                schemas.ReadyzDependency(
                    name="objectStorage",
                    status="skipped",
                    detail="not configured",
                )
            )

        return schemas.ReadyzResponse(status=status, dependencies=dependencies)

    def version(self) -> schemas.VersionResponse:
        try:
            schema_version = str(self.session.execute(text("SELECT version_num FROM alembic_version")).scalar_one())
        except Exception:
            schema_version = self.settings.schema_version
        return schemas.VersionResponse(
            app_name=self.settings.app_name,
            app_version=self.settings.app_version,
            git_sha=self.settings.git_sha,
            image_tag=self.settings.image_tag,
            build_time=self.settings.build_time,
            schema_version=schema_version,
            env=self.settings.app_env,
        )

    def bootstrap(self) -> schemas.BootstrapResponseV2:
        published_paper_count = int(
            self.session.scalar(
                select(func.count()).select_from(Paper).where(Paper.current_revision_id.is_not(None))
            )
            or 0
        )
        default_revision = self.session.scalar(
            select(PaperRevision)
            .where(PaperRevision.is_published.is_(True))
            .order_by(PaperRevision.sort_order.asc(), PaperRevision.id.asc())
        )
        default_paper_code = default_revision.paper.paper_code if default_revision is not None else None
        can_start_practice = published_paper_count > 0
        return schemas.BootstrapResponseV2(
            app_name=self.settings.app_name,
            env=self.settings.app_env,
            published_paper_count=published_paper_count,
            can_start_practice=can_start_practice,
            default_paper_code=default_paper_code,
        )
