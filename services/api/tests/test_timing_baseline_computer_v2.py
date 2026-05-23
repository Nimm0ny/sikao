from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, PaperRevisionV2, PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionTimingBaselineV2, QuestionV2
from sikao_api.modules.timing.application.baseline_computer import recompute_question_timing_baseline


def _seed_timing_samples(
    client: TestClient,
    *,
    user_id: int,
    paper_code: str,
    samples: list[int],
    submitted_at: datetime,
    question_index: int = 0,
) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        paper = session.query(PaperV2).filter_by(paper_code=paper_code).one()
        revision = (
            session.query(PaperRevisionV2)
            .filter_by(paper_id=paper.id, status="published")
            .order_by(PaperRevisionV2.revision_number.desc())
            .one()
        )
        questions = list(
            session.query(QuestionV2)
            .filter_by(revision_id=revision.id)
            .order_by(QuestionV2.item_no.asc())
        )
        question = questions[question_index]
        for offset, sample in enumerate(samples):
            practice_session = PracticeSessionV2(
                user_id=user_id,
                track="xingce",
                entry_kind="paper",
                status="submitted",
                paper_id=paper.id,
                revision_id=revision.id,
                payload_json={},
                started_at=submitted_at - timedelta(minutes=5, seconds=offset),
                submitted_at=submitted_at - timedelta(seconds=offset),
                practice_mode="full_set",
                source_mode="paper",
            )
            session.add(practice_session)
            session.flush()
            session.add(
                PracticeSessionAnswerV2(
                    session_id=practice_session.id,
                    question_id=question.id,
                    question_key=str(question.id),
                    display_order=1,
                    response_json={"selected": ["A"]},
                    is_correct=True,
                    answered_at=submitted_at - timedelta(seconds=offset),
                    time_spent_ms=sample,
                )
            )
        session.commit()


def test_recompute_question_timing_baseline_filters_dirty_and_old_samples(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-BASE-001",
            title="Timing Baseline",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        now = datetime.now(UTC).replace(tzinfo=None)
        valid_samples = [1000 * (index + 1) for index in range(41)]
        _seed_timing_samples(client, user_id=user_id, paper_code="XC-TIMING-BASE-001", samples=valid_samples, submitted_at=now)
        _seed_timing_samples(client, user_id=user_id, paper_code="XC-TIMING-BASE-001", samples=[0, 700000], submitted_at=now)
        _seed_timing_samples(client, user_id=user_id, paper_code="XC-TIMING-BASE-001", samples=[50000], submitted_at=now - timedelta(days=91))
        _seed_timing_samples(client, user_id=user_id, paper_code="XC-TIMING-BASE-001", samples=[2000] * 29, submitted_at=now, question_index=1)

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            updated = recompute_question_timing_baseline(session, now=now)
            session.commit()
            baselines = list(
                session.query(QuestionTimingBaselineV2)
                .order_by(QuestionTimingBaselineV2.question_id.asc())
            )
            audits = list(session.query(AuditLogV2).filter_by(action="timing.baseline_recomputed"))
            assert updated == 1
            assert len(baselines) == 1
            baseline = baselines[0]
            assert baseline.sample_size == 41
            assert baseline.p50_ms == 21000
            assert baseline.p90_ms == 37000
            assert baseline.p95_ms == 39000
            assert baseline.mean_ms == 21000
            assert len(audits) == 1
            assert audits[0].metadata_json["updated_count"] == 1
            assert audits[0].metadata_json["candidate_count"] == 2
            assert audits[0].metadata_json["skipped_insufficient_count"] == 1
            assert audits[0].metadata_json["cleared_stale_count"] == 0


def test_recompute_question_timing_baseline_clears_stale_rows_on_rerun(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-BASE-002",
            title="Timing Baseline Rerun",
            subject_kind="xingce",
            questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        now = datetime.now(UTC).replace(tzinfo=None)
        _seed_timing_samples(client, user_id=user_id, paper_code="XC-TIMING-BASE-002", samples=[20000] * 31, submitted_at=now)

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            updated = recompute_question_timing_baseline(session, now=now)
            session.commit()
            assert updated == 1
            sessions = list(session.query(PracticeSessionV2).all())
            for practice_session in sessions:
                practice_session.submitted_at = now - timedelta(days=91)
                session.add(practice_session)
            session.commit()

        with factory() as session:
            updated = recompute_question_timing_baseline(session, now=now)
            session.commit()
            assert updated == 0
            assert session.query(QuestionTimingBaselineV2).count() == 0
            audit = (
                session.query(AuditLogV2)
                .filter_by(action="timing.baseline_recomputed")
                .order_by(AuditLogV2.id.desc())
                .first()
            )
            assert audit is not None
            assert audit.metadata_json["candidate_count"] == 1
            assert audit.metadata_json["skipped_insufficient_count"] == 1
            assert audit.metadata_json["cleared_stale_count"] == 1
