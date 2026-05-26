from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, NoteImageV2, NoteV2
from sikao_api.modules.notes_v2.application.orphan_image_cleanup import (
    _load_locked_orphan_row_for_cleanup,
)
from sikao_api.modules.system.application.home_runtime import HomeRuntimeOrchestrator


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_orphan_image_cleanup_cron_removes_old_rows_and_files_idempotently(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(
            client,
            email="notes-orphan-cleanup@example.com",
            display_name="Notes Orphan Cleanup",
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory

        old_relative = Path("notes") / str(user_id) / "old-orphan.png"
        old_absolute = app.state.settings.upload_dir / old_relative
        old_absolute.parent.mkdir(parents=True, exist_ok=True)
        old_absolute.write_bytes(b"old-orphan")

        fresh_relative = Path("notes") / str(user_id) / "fresh-orphan.png"
        fresh_absolute = app.state.settings.upload_dir / fresh_relative
        fresh_absolute.write_bytes(b"fresh-orphan")

        missing_relative = Path("notes") / str(user_id) / "missing-orphan.png"
        escape_path = "../../spec/openapi.json"

        with factory() as session:
            session.add_all(
                [
                    NoteImageV2(
                        note_id=None,
                        user_id=user_id,
                        file_path=f"/uploads/{old_relative.as_posix()}",
                        file_name="old-orphan.png",
                        file_size=10,
                        mime_type="image/png",
                        width=1,
                        height=1,
                        created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=30),
                    ),
                    NoteImageV2(
                        note_id=None,
                        user_id=user_id,
                        file_path=f"/uploads/{fresh_relative.as_posix()}",
                        file_name="fresh-orphan.png",
                        file_size=12,
                        mime_type="image/png",
                        width=1,
                        height=1,
                        created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=2),
                    ),
                    NoteImageV2(
                        note_id=None,
                        user_id=user_id,
                        file_path=f"/uploads/{missing_relative.as_posix()}",
                        file_name="missing-orphan.png",
                        file_size=14,
                        mime_type="image/png",
                        width=1,
                        height=1,
                        created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=28),
                    ),
                    NoteImageV2(
                        note_id=None,
                        user_id=user_id,
                        file_path=escape_path,
                        file_name="escape.txt",
                        file_size=16,
                        mime_type="text/plain",
                        width=None,
                        height=None,
                        created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=28),
                    ),
                ]
            )
            session.commit()

        orchestrator = HomeRuntimeOrchestrator(app.state.db, app.state.settings)
        deleted = orchestrator._run_notes_orphan_image_cleanup_sync()
        assert deleted == 3

        assert not old_absolute.exists()
        assert fresh_absolute.exists()
        spec_file = Path(__file__).resolve().parents[1] / "spec" / "openapi.json"
        assert spec_file.exists()

        with factory() as session:
            remaining = list(session.scalars(select(NoteImageV2).order_by(NoteImageV2.id.asc())))
            assert len(remaining) == 1
            assert remaining[0].file_name == "fresh-orphan.png"
            audits = list(
                session.query(AuditLogV2)
                .filter(AuditLogV2.action == "notes.image.orphan_cleanup")
                .order_by(AuditLogV2.id.asc())
            )
            assert len(audits) == 3
            assert {audit.metadata_json["fileExisted"] for audit in audits} == {True, False}
            assert any(audit.metadata_json["safePath"] is False for audit in audits)
            assert any(audit.metadata_json["fileDeleted"] is True for audit in audits)

        rerun_deleted = orchestrator._run_notes_orphan_image_cleanup_sync()
        assert rerun_deleted == 0

        with factory() as session:
            remaining = list(session.scalars(select(NoteImageV2).order_by(NoteImageV2.id.asc())))
            assert len(remaining) == 1
            audits = list(
                session.query(AuditLogV2)
                .filter(AuditLogV2.action == "notes.image.orphan_cleanup")
                .order_by(AuditLogV2.id.asc())
            )
            assert len(audits) == 3


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_orphan_cleanup_guard_skips_rows_rebound_after_candidate_selection(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(
            client,
            email="notes-orphan-guard@example.com",
            display_name="Notes Orphan Guard",
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory

        old_relative = Path("notes") / str(user_id) / "late-bound-orphan.png"
        old_absolute = app.state.settings.upload_dir / old_relative
        old_absolute.parent.mkdir(parents=True, exist_ok=True)
        old_absolute.write_bytes(b"late-bound")

        with factory() as session:
            note = NoteV2(
                user_id=user_id,
                title="Late bound note",
                body="late bound body",
                status="active",
                linked_question_id=None,
                visibility="private",
                type="free",
                body_json={"type": "doc", "content": []},
                body_text="late bound body",
                word_count=3,
                content_hash="late-bound-hash",
                reaction_count=0,
                comment_count=0,
                bookmark_count=0,
                is_featured=False,
            )
            session.add(note)
            session.flush()
            image = NoteImageV2(
                note_id=None,
                user_id=user_id,
                file_path=f"/uploads/{old_relative.as_posix()}",
                file_name="late-bound-orphan.png",
                file_size=16,
                mime_type="image/png",
                width=1,
                height=1,
                created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=30),
            )
            session.add(image)
            session.commit()
            note_id = note.id
            image_id = image.id

        with factory() as stale_session:
            candidate_ids = list(
                stale_session.scalars(
                    select(NoteImageV2.id)
                    .where(
                        NoteImageV2.note_id.is_(None),
                        NoteImageV2.created_at
                        <= datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=24),
                    )
                )
            )
            assert candidate_ids == [image_id]

            with factory() as bind_session:
                rebound = bind_session.get(NoteImageV2, image_id)
                assert rebound is not None
                rebound.note_id = note_id
                bind_session.add(rebound)
                bind_session.commit()

            guarded = _load_locked_orphan_row_for_cleanup(
                stale_session,
                image_id=image_id,
            )
            assert guarded is None
