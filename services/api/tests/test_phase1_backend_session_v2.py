from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import PracticeAnswerPayloadV2
from sikao_api.main import create_app
from sikao_api.modules.session.application.service import SessionServiceV2
from sikao_api.modules.system.application.errors import ConflictError, ValidationError


@contextmanager
def build_client(tmp_path: Path) -> Iterator[TestClient]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'session-v2.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="session-v2-test-secret",
        app_version="session-v2-test",
        git_sha="session-v2-sha",
        image_tag="session-v2-tag",
        build_time="2026-05-20T00:00:00Z",
        schema_version="session-v2-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client


def _register_and_seed_auth(client: TestClient, *, email: str = "alice@example.com") -> None:
    response = client.post(
        "/api/v2/auth/register/email",
        json={
            "email": email,
            "password": "secret123",
            "displayName": "Alice",
        },
    )
    assert response.status_code == 200, response.text
    csrf = response.cookies.get("csrf_token_v2")
    assert csrf is not None
    client.headers["X-CSRF-Token"] = csrf


def _seed_paper_with_questions(client: TestClient, *, paper_code: str, question_count: int = 2) -> list[int]:
    factory = client.app.state.db.session_factory
    db = factory()
    try:
        paper = PaperV2(
            paper_code=paper_code,
            title=f"Paper {paper_code}",
            subject_kind="xingce",
        )
        db.add(paper)
        db.flush()
        revision = PaperRevisionV2(
            paper_id=paper.id,
            revision_number=1,
            status="published",
        )
        db.add(revision)
        db.flush()
        question_ids: list[int] = []
        for item_no in range(1, question_count + 1):
            question = QuestionV2(
                revision_id=revision.id,
                item_no=item_no,
                subject_kind="xingce",
                prompt=f"Question {item_no}",
                answer_kind="single_choice",
                status="published",
                content_json={"stem": f"Question {item_no}"},
            )
            db.add(question)
            db.flush()
            question_ids.append(question.id)
        db.commit()
        return question_ids
    finally:
        db.close()


def _load_user(db: object) -> UserV2:
    user = db.scalar(select(UserV2).limit(1))
    assert user is not None
    return user


def test_create_session_persists_paper_binding_and_question_rows(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-001", question_count=2)
        entry_kind = "study-plan-selection-entry-kind-marker-v2"

        response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": entry_kind,
                "paperCode": "XINGCE-001",
                "questionIds": question_ids,
                "payload": {"source": "study-plan"},
            },
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["entryKind"] == entry_kind
        assert body["status"] == "draft"
        assert [item["questionKey"] for item in body["items"]] == [str(question_id) for question_id in question_ids]

        factory = client.app.state.db.session_factory
        db = factory()
        try:
            practice_session = db.get(PracticeSessionV2, body["id"])
            assert practice_session is not None
            assert practice_session.entry_kind == entry_kind
            assert practice_session.paper_id is not None
            assert practice_session.revision_id is not None
            assert practice_session.payload_json == {"source": "study-plan"}

            answer_rows = list(
                db.scalars(
                    select(PracticeSessionAnswerV2)
                    .where(PracticeSessionAnswerV2.session_id == practice_session.id)
                    .order_by(PracticeSessionAnswerV2.display_order.asc())
                )
            )
            assert [row.question_id for row in answer_rows] == question_ids
            assert [row.question_key for row in answer_rows] == [str(question_id) for question_id in question_ids]
        finally:
            db.close()


def test_create_session_binds_latest_published_revision_not_newer_draft(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)

        factory = client.app.state.db.session_factory
        db = factory()
        try:
            paper = PaperV2(
                paper_code="XINGCE-010",
                title="Paper XINGCE-010",
                subject_kind="xingce",
            )
            db.add(paper)
            db.flush()

            published_revision = PaperRevisionV2(
                paper_id=paper.id,
                revision_number=1,
                status="published",
            )
            db.add(published_revision)
            db.flush()

            published_question = QuestionV2(
                revision_id=published_revision.id,
                item_no=1,
                subject_kind="xingce",
                prompt="Published question",
                answer_kind="single_choice",
                status="published",
                content_json={"stem": "Published question"},
            )
            db.add(published_question)
            db.flush()

            draft_revision = PaperRevisionV2(
                paper_id=paper.id,
                revision_number=2,
                status="draft",
            )
            db.add(draft_revision)
            db.flush()

            draft_question = QuestionV2(
                revision_id=draft_revision.id,
                item_no=1,
                subject_kind="xingce",
                prompt="Draft question",
                answer_kind="single_choice",
                status="draft",
                content_json={"stem": "Draft question"},
            )
            db.add(draft_question)
            paper_id = paper.id
            published_revision_id = published_revision.id
            published_question_id = published_question.id
            db.commit()
        finally:
            db.close()

        response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XINGCE-010",
                "questionIds": [published_question_id],
                "payload": {},
            },
        )

        assert response.status_code == 200, response.text
        session_id = response.json()["id"]

        verify_db = factory()
        try:
            practice_session = verify_db.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.paper_id == paper_id
            assert practice_session.revision_id == published_revision_id

            answer_rows = list(
                verify_db.scalars(
                    select(PracticeSessionAnswerV2)
                    .where(PracticeSessionAnswerV2.session_id == session_id)
                    .order_by(PracticeSessionAnswerV2.display_order.asc())
                )
            )
            assert [row.question_id for row in answer_rows] == [published_question_id]
        finally:
            verify_db.close()


def test_open_session_create_rejects_question_ids_without_paper_code(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-009", question_count=2)

        response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "essay",
                "entryKind": "custom-selection",
                "questionIds": question_ids,
                "payload": {"mode": "manual"},
            },
        )

        assert response.status_code == 422, response.text
        assert response.json()["code"] == "practice_session_question_ids_require_paper_code"

        factory = client.app.state.db.session_factory
        db = factory()
        try:
            practice_sessions = list(db.scalars(select(PracticeSessionV2)))
            assert practice_sessions == []
        finally:
            db.close()


def test_create_session_rejects_duplicate_question_ids(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-011", question_count=1)

        response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XINGCE-011",
                "questionIds": [question_ids[0], question_ids[0]],
                "payload": {},
            },
        )

        assert response.status_code == 422, response.text
        assert response.json()["code"] == "practice_session_duplicate_question_id"

        factory = client.app.state.db.session_factory
        db = factory()
        try:
            practice_sessions = list(db.scalars(select(PracticeSessionV2)))
            assert practice_sessions == []
        finally:
            db.close()


def test_save_answers_upserts_same_question_key_in_place(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "essay",
                "entryKind": "custom-selection",
                "questionIds": [],
                "payload": {"mode": "manual"},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]

        first_save = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": "Q-1", "answer": {"text": "first"}, "durationSeconds": 12}
                ]
            },
        )
        assert first_save.status_code == 200, first_save.text

        second_save = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": "Q-1", "answer": {"text": "second"}, "durationSeconds": 18}
                ]
            },
        )
        assert second_save.status_code == 200, second_save.text

        factory = client.app.state.db.session_factory
        db = factory()
        try:
            answer_rows = list(
                db.scalars(
                    select(PracticeSessionAnswerV2).where(
                        PracticeSessionAnswerV2.session_id == session_id
                    )
                )
            )
            assert len(answer_rows) == 1
            assert answer_rows[0].question_key == "Q-1"
            assert answer_rows[0].response_json == {"text": "second"}
            assert answer_rows[0].duration_seconds == 18
        finally:
            db.close()


def test_seeded_session_rejects_question_keys_outside_initialized_scope(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-003", question_count=2)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XINGCE-003",
                "questionIds": [question_ids[0]],
                "payload": {},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]

        invalid_numeric = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": str(question_ids[1]), "answer": {"selected": ["A"]}}
                ]
            },
        )
        assert invalid_numeric.status_code == 422, invalid_numeric.text
        assert invalid_numeric.json()["code"] == "practice_session_question_key_not_allowed"

        invalid_custom = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": "custom-key", "answer": {"text": "manual"}}
                ]
            },
        )
        assert invalid_custom.status_code == 422, invalid_custom.text
        assert invalid_custom.json()["code"] == "practice_session_question_key_not_allowed"


def test_open_session_first_save_defines_question_scope_and_keeps_custom_key_non_null(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "essay",
                "entryKind": "custom-selection",
                "questionIds": [],
                "payload": {"mode": "manual"},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]

        first_save = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": "Q-1", "answer": {"text": "draft"}}
                ]
            },
        )
        assert first_save.status_code == 200, first_save.text

        second_save = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": "Q-2", "answer": {"text": "another"}}
                ]
            },
        )
        assert second_save.status_code == 422, second_save.text
        assert second_save.json()["code"] == "practice_session_question_key_not_allowed"

        factory = client.app.state.db.session_factory
        db = factory()
        try:
            answer_rows = list(
                db.scalars(
                    select(PracticeSessionAnswerV2).where(
                        PracticeSessionAnswerV2.session_id == session_id
                    )
                )
            )
            assert len(answer_rows) == 1
            assert answer_rows[0].question_key == "Q-1"
            assert answer_rows[0].question_id is None
        finally:
            db.close()


def test_open_session_rejects_numeric_question_key_without_revision_scope(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-007", question_count=1)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "essay",
                "entryKind": "custom-selection",
                "questionIds": [],
                "payload": {"mode": "manual"},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]

        save_response = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": str(question_ids[0]), "answer": {"selected": ["A"]}}
                ]
            },
        )
        assert save_response.status_code == 422, save_response.text
        assert save_response.json()["code"] == "practice_session_question_key_not_allowed"


def test_revision_bound_unseeded_session_only_accepts_same_revision_numeric_key(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-005", question_count=1)
        other_question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-006", question_count=1)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XINGCE-005",
                "questionIds": [],
                "payload": {},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]

        invalid_custom = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": "Q-1", "answer": {"selected": ["A"]}}
                ]
            },
        )
        assert invalid_custom.status_code == 422, invalid_custom.text
        assert invalid_custom.json()["code"] == "practice_session_question_key_not_allowed"

        invalid_other_revision = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": str(other_question_ids[0]), "answer": {"selected": ["A"]}}
                ]
            },
        )
        assert invalid_other_revision.status_code == 422, invalid_other_revision.text
        assert invalid_other_revision.json()["code"] == "practice_session_question_key_not_allowed"

        valid_same_revision = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": str(question_ids[0]), "answer": {"selected": ["A"]}}
                ]
            },
        )
        assert valid_same_revision.status_code == 200, valid_same_revision.text


def test_semantic_empty_answers_stay_pending_and_not_counted(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-004", question_count=2)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XINGCE-004",
                "questionIds": question_ids,
                "payload": {},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]

        save_response = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": str(question_ids[0]), "answer": {"selected": []}},
                    {"questionKey": str(question_ids[1]), "answer": {"text": ""}},
                ]
            },
        )
        assert save_response.status_code == 200, save_response.text

        session_response = client.get(f"/api/v2/practice/sessions/{session_id}")
        assert session_response.status_code == 200, session_response.text
        assert [item["status"] for item in session_response.json()["items"]] == ["pending", "pending"]

        submit_response = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submit_response.status_code == 200, submit_response.text

        result_response = client.get(f"/api/v2/practice/sessions/{session_id}/result")
        assert result_response.status_code == 200, result_response.text
        answered_metric = next(
            item for item in result_response.json()["summary"] if item["key"] == "answered"
        )
        assert answered_metric["value"] == "0"


def test_submit_makes_session_terminal_for_answer_writes(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-002", question_count=1)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XINGCE-002",
                "questionIds": question_ids,
                "payload": {},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]
        question_key = str(question_ids[0])

        save_response = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": question_key, "answer": {"selected": ["A"]}, "durationSeconds": 10}
                ]
            },
        )
        assert save_response.status_code == 200, save_response.text

        submit_response = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submit_response.status_code == 200, submit_response.text

        forbidden_save = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": question_key, "answer": {"selected": ["B"]}, "durationSeconds": 20}
                ]
            },
        )
        assert forbidden_save.status_code == 409, forbidden_save.text
        assert forbidden_save.json()["code"] == "practice_session_submitted"

        factory = client.app.state.db.session_factory
        db = factory()
        try:
            practice_session = db.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.status == "submitted"
            assert practice_session.submitted_at is not None

            answer_row = db.scalar(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == session_id,
                    PracticeSessionAnswerV2.question_key == question_key,
                )
            )
            assert answer_row is not None
            assert answer_row.response_json == {"selected": ["A"]}
            assert answer_row.duration_seconds == 10
        finally:
            db.close()


def test_stale_loaded_session_cannot_save_after_other_transaction_submits(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)
        question_ids = _seed_paper_with_questions(client, paper_code="XINGCE-008", question_count=1)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XINGCE-008",
                "questionIds": question_ids,
                "payload": {},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]
        question_key = str(question_ids[0])

        factory = client.app.state.db.session_factory
        stale_db = factory()
        submit_db = factory()
        try:
            stale_service = SessionServiceV2(stale_db)
            submit_service = SessionServiceV2(submit_db)
            stale_session = stale_service.get_session(
                user=_load_user(stale_db),
                session_id=session_id,
            )
            submitted_session = submit_service.get_session(
                user=_load_user(submit_db),
                session_id=session_id,
            )

            submit_service.submit(practice_session=submitted_session)
            submit_db.commit()

            with pytest.raises(ConflictError) as exc_info:
                stale_service.save_answers(
                    practice_session=stale_session,
                    answers=[
                        PracticeAnswerPayloadV2(
                            question_key=question_key,
                            answer={"selected": ["B"]},
                            duration_seconds=20,
                        )
                    ],
                )
            assert exc_info.value.status_code == 409
            assert exc_info.value.code == "practice_session_submitted"
            assert exc_info.value.message == "practice session already submitted"
            stale_db.rollback()
        finally:
            stale_db.close()
            submit_db.close()

        verify_db = factory()
        try:
            practice_session = verify_db.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.status == "submitted"

            answer_row = verify_db.scalar(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == session_id,
                    PracticeSessionAnswerV2.question_key == question_key,
                )
            )
            assert answer_row is not None
            assert answer_row.response_json == {}
            assert answer_row.duration_seconds is None
        finally:
            verify_db.close()


def test_stale_loaded_empty_session_cannot_expand_scope_after_other_transaction_first_save(
    tmp_path: Path,
) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)

        create_response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "essay",
                "entryKind": "custom-selection",
                "questionIds": [],
                "payload": {"mode": "manual"},
            },
        )
        assert create_response.status_code == 200, create_response.text
        session_id = create_response.json()["id"]

        factory = client.app.state.db.session_factory
        stale_db = factory()
        first_save_db = factory()
        try:
            stale_service = SessionServiceV2(stale_db)
            first_save_service = SessionServiceV2(first_save_db)
            stale_session = stale_service.get_session(
                user=_load_user(stale_db),
                session_id=session_id,
            )
            first_session = first_save_service.get_session(
                user=_load_user(first_save_db),
                session_id=session_id,
            )

            first_save_service.save_answers(
                practice_session=first_session,
                answers=[
                    PracticeAnswerPayloadV2(
                        question_key="Q-1",
                        answer={"text": "first"},
                        duration_seconds=12,
                    )
                ],
            )
            first_save_db.commit()

            with pytest.raises(ValidationError) as exc_info:
                stale_service.save_answers(
                    practice_session=stale_session,
                    answers=[
                        PracticeAnswerPayloadV2(
                            question_key="Q-2",
                            answer={"text": "second"},
                            duration_seconds=18,
                        )
                    ],
                )
            assert exc_info.value.status_code == 422
            assert exc_info.value.code == "practice_session_question_key_not_allowed"
            assert exc_info.value.message == "question key is outside this session scope"
            stale_db.rollback()
        finally:
            stale_db.close()
            first_save_db.close()

        verify_db = factory()
        try:
            answer_rows = list(
                verify_db.scalars(
                    select(PracticeSessionAnswerV2)
                    .where(PracticeSessionAnswerV2.session_id == session_id)
                    .order_by(PracticeSessionAnswerV2.display_order.asc())
                )
            )
            assert [row.question_key for row in answer_rows] == ["Q-1"]
        finally:
            verify_db.close()


def test_migration_matches_entry_kind_length_and_question_key_uniqueness(tmp_path: Path) -> None:
    database_path = tmp_path / "session-v2-migration.db"
    database_url = f"sqlite:///{database_path.resolve().as_posix()}"
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "database"
        / "migrations"
        / "alembic"
        / "versions"
        / "1003_session_and_grading_v2_tables.py"
    )
    engine = create_engine(database_url)
    try:
        spec = importlib.util.spec_from_file_location("migration_1003", migration_path)
        assert spec is not None
        assert spec.loader is not None
        migration_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration_module)

        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE users_v2 (id INTEGER PRIMARY KEY)"))
            connection.execute(text("CREATE TABLE papers_v2 (id INTEGER PRIMARY KEY)"))
            connection.execute(
                text(
                    "CREATE TABLE paper_revisions_v2 ("
                    "id INTEGER PRIMARY KEY, "
                    "paper_id INTEGER NOT NULL REFERENCES papers_v2(id)"
                    ")"
                )
            )
            connection.execute(text("CREATE TABLE questions_v2 (id INTEGER PRIMARY KEY)"))
            context = MigrationContext.configure(connection)
            operation = Operations(context)
            original_op = migration_module.op
            migration_module.op = operation
            try:
                migration_module.upgrade()
            finally:
                migration_module.op = original_op

        inspector = inspect(engine)
        practice_session_columns = {
            column["name"]: column for column in inspector.get_columns("practice_sessions_v2")
        }
        practice_session_answer_columns = {
            column["name"]: column for column in inspector.get_columns("practice_session_answers_v2")
        }
        unique_constraints = inspector.get_unique_constraints("practice_session_answers_v2")
    finally:
        engine.dispose()

    assert practice_session_columns["entry_kind"]["type"].length == 64
    assert practice_session_answer_columns["question_key"]["nullable"] is False
    assert any(
        constraint["name"] == "uq_practice_session_answers_v2_session_question_key"
        and constraint["column_names"] == ["session_id", "question_key"]
        for constraint in unique_constraints
    )
