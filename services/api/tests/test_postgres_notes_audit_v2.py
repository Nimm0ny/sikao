from __future__ import annotations

from io import BytesIO
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from PIL import Image
import pytest

from _helpers.llm_stubs import StubLlmProvider
from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_completed_session,
    seed_paper,
)
from _home_phase_m4_support import parse_sse_frames
from sikao_api.db.models_v2 import AuditLogV2, ReviewAttemptV2, ReviewItemV2
from sikao_api.modules.review.application.queue_items import reason_compat_for_source


def _body_json(text: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }


def _png_bytes() -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", (4, 3), color=(255, 0, 0))
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _weekly_markdown() -> str:
    return (
        "## 本周成果\n"
        "- 完成 3 次复盘并沉淀出新的答题模式。\n\n"
        "## 薄弱环节\n"
        "- 资料分析的表格题仍然需要更稳定的节奏控制。\n\n"
        "## 下周建议\n"
        "- 先做 2 组资料分析，再回看本周错题。\n\n"
        "## 本周知识沉淀\n"
        "- 遇到相邻约束优先尝试捆绑法。\n"
    )


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_mutation_routes_write_audit_rows(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(
            client,
            email="notes-audit-owner@example.com",
            display_name="Notes Audit Owner",
        )

        created = client.post(
            "/api/v2/notes",
            json={
                "title": "Audit Note",
                "bodyJson": _body_json("创建时的审计正文内容。" * 4),
                "tags": ["audit"],
            },
        )
        assert created.status_code == 200, created.text
        note_id = created.json()["id"]

        updated = client.put(
            f"/api/v2/notes/{note_id}",
            json={"title": "Audit Note Updated", "bodyJson": _body_json("更新后的审计正文内容。" * 4)},
        )
        assert updated.status_code == 200, updated.text

        uploaded = client.post(
            "/api/v2/notes/images",
            files={"image": ("audit.png", _png_bytes(), "image/png")},
            data={"note_id": str(note_id)},
        )
        assert uploaded.status_code == 200, uploaded.text

        deleted = client.delete(f"/api/v2/notes/{note_id}")
        assert deleted.status_code == 204, deleted.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            rows = (
                session.query(AuditLogV2)
                .filter(AuditLogV2.user_id == user_id)
                .order_by(AuditLogV2.id.asc())
                .all()
            )
            actions = [row.action for row in rows if row.action.startswith("notes.")]
            assert "notes.created" in actions
            assert "notes.updated" in actions
            assert "notes.image.uploaded" in actions
            assert "notes.soft_deleted" in actions

            create_row = next(row for row in rows if row.action == "notes.created")
            assert create_row.target_id == note_id
            assert create_row.after["title"] == "Audit Note"
            assert create_row.request_id is not None

            update_row = next(row for row in rows if row.action == "notes.updated")
            assert update_row.before["title"] == "Audit Note"
            assert update_row.after["title"] == "Audit Note Updated"

            image_row = next(row for row in rows if row.action == "notes.image.uploaded")
            assert image_row.metadata_json["noteId"] == note_id
            assert image_row.target_type == "note_image_v2"

            delete_row = next(row for row in rows if row.action == "notes.soft_deleted")
            assert delete_row.before["deletedAt"] is None
            assert delete_row.after["deletedAt"] is not None


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_ai_summary_confirm_writes_audit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_build_provider(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        del settings, db, user_id, timeout_seconds_override
        return (
            StubLlmProvider('{"cards":[{"text":"捆绑法适用于相邻约束"},{"text":"插空法适用于不相邻约束"}]}'),
            "mock",
        )

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.ai_summary_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        user_id = register_user(
            client,
            email="notes-ai-audit@example.com",
            display_name="Notes AI Audit",
        )
        note = client.post(
            "/api/v2/notes",
            json={
                "title": "AI Audit Note",
                "bodyJson": _body_json("AI 审计正文内容足够长，用于生成复盘卡片。" * 3),
                "tags": ["summary"],
            },
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        preview = client.post(f"/api/v2/notes/{note_id}/ai-summary")
        assert preview.status_code == 200, preview.text

        confirm = client.post(
            f"/api/v2/notes/{note_id}/ai-summary/confirm",
            json={"cards": preview.json()["cards"]},
        )
        assert confirm.status_code == 200, confirm.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = (
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.user_id == user_id,
                    AuditLogV2.action == "notes.ai_summary.confirmed",
                    AuditLogV2.target_id == note_id,
                )
                .order_by(AuditLogV2.id.desc())
                .one()
            )
            assert row.metadata_json["noteId"] == note_id
            assert row.metadata_json["promptVersion"] == "note_summary_cards@v1"
            assert len(row.metadata_json["reviewItemIds"]) == 2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_weekly_review_generation_writes_audit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class StubWeeklyProvider:
        async def chat_completion_stream(self, **kwargs):  # type: ignore[no-untyped-def]
            del kwargs
            yield type(
                "Chunk",
                (),
                {
                    "content_delta": _weekly_markdown(),
                    "is_final": False,
                    "prompt_tokens": None,
                    "completion_tokens": None,
                },
            )()
            yield type(
                "Chunk",
                (),
                {
                    "content_delta": "",
                    "is_final": True,
                    "prompt_tokens": 120,
                    "completion_tokens": 180,
                },
            )()

    def _fake_build_provider(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        del settings, db, user_id, timeout_seconds_override
        return StubWeeklyProvider(), "mock"

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.weekly_review_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        user_id = register_user(
            client,
            email="notes-weekly-audit@example.com",
            display_name="Notes Weekly Audit",
        )
        question_ids = seed_paper(
            client,
            paper_code="XC-NOTES-WEEKLY-AUDIT",
            title="Notes Weekly Audit",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Weekly audit Q1",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-NOTES-WEEKLY-AUDIT",
            answer_outcomes=[False],
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            item = ReviewItemV2(
                user_id=user_id,
                source_kind="manual_add",
                source_id=question_ids[0],
                title="Weekly audit review item",
                status="pending",
                question_id=question_ids[0],
                metadata_json={},
                reason=reason_compat_for_source("manual_add"),
            )
            session.add(item)
            session.flush()
            session.add(
                ReviewAttemptV2(
                    review_item_id=item.id,
                    outcome="correct",
                    notes_json={"effectiveConfidence": "certain"},
                    attempted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=2),
                )
            )
            session.commit()

        response = client.post(
            "/api/v2/notes/weekly-review/generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-4266141749aa"},
            json={},
        )
        assert response.status_code == 200, response.text
        done = next(frame for frame in parse_sse_frames(response.text) if frame["type"] == "done")
        assert isinstance(done["note_id"], int)
        note_id = done["note_id"]

        with factory() as session:
            row = (
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.user_id == user_id,
                    AuditLogV2.action == "notes.weekly_review.generated",
                    AuditLogV2.target_id == note_id,
                )
                .order_by(AuditLogV2.id.desc())
                .one()
            )
            assert row.metadata_json["noteId"] == note_id
            assert row.metadata_json["llmCallId"] is not None
