from __future__ import annotations

import os
import threading
import time
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionAnswerV2, QuestionFlagV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import PracticeAnswerPayloadV2
from sikao_api.modules.session.application.answer_flag_ops import set_answer_flag
from sikao_api.modules.session.application.service import SessionServiceV2
from sikao_api.modules.system.application.errors import ConflictError


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_session_answer_ops_closed_book_and_submit_promotion(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-PG-OPS",
            title="PG Answer Ops",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        session_response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-PG-OPS", "practiceMode": "full_set"},
        )
        assert session_response.status_code == 200, session_response.text
        payload = session_response.json()
        session_id = payload["id"]
        answer_id = int(payload["items"][0]["id"])
        question_id = int(payload["items"][0]["questionKey"])

        blocked_submit = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert blocked_submit.status_code == 409, blocked_submit.text
        assert blocked_submit.json()["code"] == "INVALID_TRANSITION"

        answered = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": str(question_id), "answer": {"selected": ["A"]}}]},
        )
        assert answered.status_code == 200, answered.text

        blocked = client.post(f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/view-solution")
        assert blocked.status_code == 403, blocked.text

        flagged = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/flag",
            json={"flagged": True},
        )
        assert flagged.status_code == 200, flagged.text
        submit = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submit.status_code == 200, submit.text

        blocked_flag_after_submit = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/flag",
            json={"flagged": False},
        )
        assert blocked_flag_after_submit.status_code == 409, blocked_flag_after_submit.text
        assert blocked_flag_after_submit.json()["code"] == "practice_session_submitted"

        persistent = client.post(
            f"/api/v2/practice/sessions/{session_id}/persistent-flag",
            json={"questionId": question_id, "reason": "needs_review"},
        )
        assert persistent.status_code == 200, persistent.text
        assert persistent.json()["hasPersistentFlag"] is True
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            flag = session.query(QuestionFlagV2).filter_by(question_id=question_id).one()
            assert flag.reason == "needs_review"
            assert flag.source_session_id == session_id
            submit_audit = (
                session.query(AuditLogV2)
                .filter_by(target_type="practice_session_v2", target_id=session_id, action="session.user_submit")
                .one()
            )
            assert submit_audit.metadata_json["trigger"] == "user_submit"


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_session_detail_returns_normalized_answer_snapshot(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="snapshot@example.com", display_name="Snapshot User")
        seed_paper(
            client,
            paper_code="XC-PG-SNAPSHOT",
            title="PG Snapshot Choice",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Choice question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "options": ["A", "B"],
                },
            ],
        )
        seed_paper(
            client,
            paper_code="ES-PG-SNAPSHOT",
            title="PG Snapshot Essay",
            subject_kind="essay",
            questions=[
                {
                    "prompt": "Essay question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "essay",
                    "category_l2": "argumentation",
                    "answer_kind": "essay",
                },
            ],
        )

        choice_session = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-PG-SNAPSHOT", "practiceMode": "full_set"},
        )
        assert choice_session.status_code == 200, choice_session.text
        choice_payload = choice_session.json()
        choice_session_id = choice_payload["id"]
        choice_question_key = str(choice_payload["items"][0]["questionKey"])

        choice_save = client.post(
            f"/api/v2/practice/sessions/{choice_session_id}/answers",
            json={"answers": [{"questionKey": choice_question_key, "answer": {"selectedAnswerKeys": ["B"]}}]},
        )
        assert choice_save.status_code == 200, choice_save.text

        choice_detail = client.get(f"/api/v2/practice/sessions/{choice_session_id}")
        assert choice_detail.status_code == 200, choice_detail.text
        choice_item = choice_detail.json()["items"][0]
        assert choice_item["selectedAnswerKeys"] == ["B"]
        assert choice_item["answerText"] is None
        assert choice_item["status"] == "answered"

        essay_session = client.post(
            "/api/v2/practice/sessions",
            json={"track": "essay", "entryKind": "paper", "paperCode": "ES-PG-SNAPSHOT", "practiceMode": "full_set"},
        )
        assert essay_session.status_code == 200, essay_session.text
        essay_payload = essay_session.json()
        essay_session_id = essay_payload["id"]
        essay_question_key = str(essay_payload["items"][0]["questionKey"])

        essay_save = client.post(
            f"/api/v2/practice/sessions/{essay_session_id}/answers",
            json={"answers": [{"questionKey": essay_question_key, "answer": {"text": "Draft essay body"}}]},
        )
        assert essay_save.status_code == 200, essay_save.text

        essay_content_save = client.post(
            f"/api/v2/practice/sessions/{essay_session_id}/answers",
            json={"answers": [{"questionKey": essay_question_key, "answer": {"content": "Draft essay from content"}}]},
        )
        assert essay_content_save.status_code == 200, essay_content_save.text

        essay_detail = client.get(f"/api/v2/practice/sessions/{essay_session_id}")
        assert essay_detail.status_code == 200, essay_detail.text
        essay_item = essay_detail.json()["items"][0]
        assert essay_item["selectedAnswerKeys"] == []
        assert essay_item["answerText"] == "Draft essay from content"
        assert essay_item["status"] == "answered"


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_answer_flag_rejects_stale_terminal_transition(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="race@example.com", display_name="Race User")
        seed_paper(
            client,
            paper_code="XC-PG-OPS-RACE",
            title="PG Answer Ops Race",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        session_response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-PG-OPS-RACE", "practiceMode": "full_set"},
        )
        payload = session_response.json()
        session_id = payload["id"]
        answer_id = int(payload["items"][0]["id"])
        question_id = int(payload["items"][0]["questionKey"])
        answered = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": str(question_id), "answer": {"selected": ["A"]}}]},
        )
        assert answered.status_code == 200, answered.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as request_session:
            user = request_session.get(UserV2, user_id)
            assert user is not None
            practice_session = request_session.get(PracticeSessionV2, session_id)
            assert practice_session is not None

            with factory() as rival_session:
                rival = rival_session.get(PracticeSessionV2, session_id)
                assert rival is not None
                rival.status = "submitted"
                rival_session.add(rival)
                rival_session.commit()

            with pytest.raises(ConflictError) as exc_info:
                set_answer_flag(
                    request_session,
                    user=user,
                    session_id=session_id,
                    answer_id=answer_id,
                    flagged=False,
                )
            assert exc_info.value.code == "practice_session_submitted"



@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_save_answers_reloads_terminal_state_before_write(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="save-race@example.com", display_name="Save Race")
        seed_paper(
            client,
            paper_code="XC-PG-OPS-SAVE-RACE",
            title="PG Save Race",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        session_response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-PG-OPS-SAVE-RACE", "practiceMode": "full_set"},
        )
        payload = session_response.json()
        session_id = payload["id"]
        question_key = payload["items"][0]["questionKey"]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as request_session:
            user = request_session.get(UserV2, user_id)
            practice_session = request_session.get(PracticeSessionV2, session_id)
            assert user is not None
            assert practice_session is not None

            with factory() as rival_session:
                rival = rival_session.get(PracticeSessionV2, session_id)
                assert rival is not None
                rival.status = "submitted"
                rival_session.add(rival)
                rival_session.commit()

            service = SessionServiceV2(request_session)
            with pytest.raises(ConflictError) as exc_info:
                service.save_answers(
                    practice_session=practice_session,
                    answers=[
                        PracticeAnswerPayloadV2(
                            question_key=str(question_key),
                            answer={"selected": ["A"]},
                        )
                    ],
                )
            assert exc_info.value.code == "practice_session_submitted"


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_submit_waits_for_inflight_save_before_deriving_results(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="submit-race@example.com", display_name="Submit Race")
        seed_paper(
            client,
            paper_code="XC-PG-OPS-SUBMIT-RACE",
            title="PG Submit Race",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "A",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "correct_answer": "B",
                    "options": ["A", "B"],
                },
            ],
        )
        session_response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-PG-OPS-SUBMIT-RACE", "practiceMode": "full_set"},
        )
        assert session_response.status_code == 200, session_response.text
        payload = session_response.json()
        session_id = payload["id"]
        question_key = str(payload["items"][0]["questionKey"])

        first_answer = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": question_key, "answer": {"selected": ["A"]}}]},
        )
        assert first_answer.status_code == 200, first_answer.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        save_started = threading.Event()
        allow_save_commit = threading.Event()
        submit_finished = threading.Event()
        failures: list[BaseException] = []

        def worker_save() -> None:
            try:
                with factory() as request_session:
                    practice_session = request_session.get(PracticeSessionV2, session_id)
                    assert practice_session is not None
                    service = SessionServiceV2(request_session)
                    service.save_answers(
                        practice_session=practice_session,
                        answers=[
                            PracticeAnswerPayloadV2(
                                question_key=question_key,
                                answer={"selected": ["B"]},
                            )
                        ],
                    )
                    save_started.set()
                    allow_save_commit.wait(5)
                    request_session.commit()
            except BaseException as exc:  # pragma: no cover - surfaced by assertion below
                failures.append(exc)
                save_started.set()
                submit_finished.set()

        def worker_submit() -> None:
            save_started.wait(5)
            try:
                with factory() as request_session:
                    practice_session = request_session.get(PracticeSessionV2, session_id)
                    assert practice_session is not None
                    service = SessionServiceV2(request_session)
                    service.submit(practice_session=practice_session)
                    request_session.commit()
                    submit_finished.set()
            except BaseException as exc:  # pragma: no cover - surfaced by assertion below
                failures.append(exc)
                submit_finished.set()

        save_thread = threading.Thread(target=worker_save)
        submit_thread = threading.Thread(target=worker_submit)
        save_thread.start()
        assert save_started.wait(5) is True
        submit_thread.start()
        time.sleep(0.5)
        assert submit_finished.is_set() is False
        allow_save_commit.set()
        save_thread.join(timeout=5)
        submit_thread.join(timeout=5)
        assert save_thread.is_alive() is False
        assert submit_thread.is_alive() is False
        assert failures == []

        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            answer = session.query(PracticeSessionAnswerV2).filter_by(session_id=session_id).one()
            assert practice_session.status == "submitted"
            assert answer.response_json == {"selected": ["B"]}
            assert answer.is_correct is True
