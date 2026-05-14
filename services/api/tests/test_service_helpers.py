"""Helper-level unit tests for SRP refactor (P1 review fix Phase A.1).

8 functions in services/exam_papers.py + scripts/fenbi_to_standard.py were split
into helpers. Existing integration tests cover the public methods; these tests
add helper-level precision so a future refactor regression in any single helper
fails an isolated test instead of an opaque HTTP integration failure.

Only pure helpers tested here (no db dependency). DB-dependent helpers
(_query_total_accuracy / _compute_streak / _count_mastery_buckets /
_fetch_user_answers / _serialize_recent_sessions) remain covered transitively
by test_exam_api.py's integration suite.
"""
from __future__ import annotations

from collections import OrderedDict
from unittest.mock import MagicMock

import pytest

from sikao_api.scripts.fenbi_to_standard import (
    _build_canonical_taxonomy,
    _extract_answer_keys,
)

# ──────────────────────────────────────────────────────────────────────────────
# fenbi_to_standard._extract_answer_keys
# ──────────────────────────────────────────────────────────────────────────────


def test_extract_answer_keys_type_1_single_choice() -> None:
    keys = _extract_answer_keys(
        qtype=1,
        raw_answer="2",  # index 2 → "C"
        options_payload=[{"k": "A"}, {"k": "B"}, {"k": "C"}, {"k": "D"}],
        qid=1,
    )
    assert keys == ["C"]


def test_extract_answer_keys_type_2_multiple() -> None:
    keys = _extract_answer_keys(
        qtype=2,
        raw_answer="1,3",  # indices 1,3 → B, D
        options_payload=[{"k": "A"}, {"k": "B"}, {"k": "C"}, {"k": "D"}],
        qid=2,
    )
    assert keys == ["B", "D"]


def test_extract_answer_keys_type_5_fill_blank_text() -> None:
    keys = _extract_answer_keys(qtype=5, raw_answer="100", options_payload=[], qid=3)
    assert keys == ["100"]


def test_extract_answer_keys_type_5_empty_raises() -> None:
    with pytest.raises(ValueError, match="empty answer"):
        _extract_answer_keys(qtype=5, raw_answer="  ", options_payload=[], qid=4)


def test_extract_answer_keys_type_5_missing_raises() -> None:
    with pytest.raises(ValueError, match="missing answer"):
        _extract_answer_keys(qtype=5, raw_answer=None, options_payload=[], qid=5)


def test_extract_answer_keys_type_1_multi_answer_raises() -> None:
    with pytest.raises(ValueError, match=r"type=1 \(single\) has multi answer"):
        _extract_answer_keys(
            qtype=1,
            raw_answer="1,2",
            options_payload=[{"k": "A"}, {"k": "B"}, {"k": "C"}, {"k": "D"}],
            qid=6,
        )


def test_extract_answer_keys_index_out_of_range_raises() -> None:
    with pytest.raises(ValueError, match=r"out of range"):
        _extract_answer_keys(
            qtype=1,
            raw_answer="9",
            options_payload=[{"k": "A"}, {"k": "B"}],
            qid=7,
        )


def test_extract_answer_keys_type_2_no_options_raises() -> None:
    with pytest.raises(ValueError, match="has no options"):
        _extract_answer_keys(qtype=2, raw_answer="1", options_payload=[], qid=8)


# ──────────────────────────────────────────────────────────────────────────────
# fenbi_to_standard._build_canonical_taxonomy
# ──────────────────────────────────────────────────────────────────────────────


def test_build_canonical_taxonomy_known_chapter() -> None:
    out = _build_canonical_taxonomy("言语理解", qtype=1)
    assert out["canonicalTopType"] == "言语理解"  # in _CHAPTER_CANONICAL_TOP
    assert out["canonicalSubtype"] == "言语理解"
    assert out["rawRenderType"] == "fenbi-type-1"
    assert out["mappingSource"] == "fenbi"


def test_build_canonical_taxonomy_unknown_chapter_passthrough() -> None:
    out = _build_canonical_taxonomy("从未见过的题型", qtype=2)
    # 未在 _CHAPTER_CANONICAL_TOP 的 chapter, fallback chapter 自身
    assert out["canonicalTopType"] == "从未见过的题型"
    assert out["canonicalSubtype"] == "从未见过的题型"
    assert out["rawRenderType"] == "fenbi-type-2"


# ──────────────────────────────────────────────────────────────────────────────
# exam_papers._build_question_content
# ──────────────────────────────────────────────────────────────────────────────


def test_build_question_content_with_options() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _build_question_content

    class FakeOption:
        def __init__(self, oid: int, key: str) -> None:
            self.id = oid
            self.option_key = key

    options = [FakeOption(1, "A"), FakeOption(2, "B")]
    rewritten = {1: "alpha", 2: "beta"}
    content = _build_question_content("stem-html", options, rewritten, "explain")
    assert content["stem"] == "stem-html"
    assert content["explanation"] == "explain"
    assert content["options"] == [
        {"key": "A", "text": "alpha"},
        {"key": "B", "text": "beta"},
    ]


def test_build_question_content_empty_options() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _build_question_content

    content = _build_question_content("stem", [], {}, "explain")
    assert content["options"] == []
    # Slice 2a: 非 essay 题型 essayMetadata 字段必须缺省, 不能误塞 None.
    assert "essayMetadata" not in content


# ──────────────────────────────────────────────────────────────────────────────
# Slice 2a · essay path helpers
# ──────────────────────────────────────────────────────────────────────────────


def test_build_question_content_with_essay_metadata() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _build_question_content

    metadata = {
        "materialTexts": ["材料一: ...", "材料二: ..."],
        "wordLimitMin": 800,
        "wordLimitMax": 1000,
        "suggestedMinutes": 60,
        "fullScore": 40,
    }
    content = _build_question_content(
        "申论 stem", [], {}, "", essay_metadata=metadata
    )
    assert content["options"] == []
    assert content["essayMetadata"] == metadata


def test_extract_essay_metadata_filters_to_whitelist() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _extract_essay_metadata

    type_payload = {
        "materialTexts": ["m1"],
        "wordLimitMax": 1000,
        # 故意夹杂 - 非白名单字段不能被泄给前端 content.essayMetadata
        "internalDebugFlag": True,
        "fenbiRaw": {"x": 1},
    }
    out = _extract_essay_metadata(type_payload)
    assert out == {"materialTexts": ["m1"], "wordLimitMax": 1000}


def test_extract_essay_metadata_empty_returns_none() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _extract_essay_metadata

    assert _extract_essay_metadata({}) is None
    assert _extract_essay_metadata({"unrelated": 1}) is None


def test_validate_question_options_essay_empty_ok() -> None:
    svc = _make_service()
    payload = {"options": []}
    svc._validate_question_options(
        payload, "Q1", is_fill_blank=False, is_essay=True
    )  # no raise


def test_validate_question_options_essay_missing_ok() -> None:
    svc = _make_service()
    # 申论 payload 完全可以不含 options key.
    payload: dict[str, object] = {}
    svc._validate_question_options(
        payload, "Q1", is_fill_blank=False, is_essay=True
    )  # no raise


def test_validate_question_answer_keys_essay_returns_empty() -> None:
    svc = _make_service()
    # 申论无 expected answer; 即使 payload 给了 answerKeys 也忽略 (LLM 异步评分).
    payload = {"answerKeys": ["whatever"]}
    keys = svc._validate_question_answer_keys(
        payload, "Q1", option_keys=[], is_fill_blank=False, is_essay=True
    )
    assert keys == []


# ──────────────────────────────────────────────────────────────────────────────
# exam_papers._aggregate_wrong_groups + _serialize_recent_attempts
# ──────────────────────────────────────────────────────────────────────────────


class _FakeQuestion:
    def __init__(self, qid: int, stem: str = "stem") -> None:
        self.id = qid
        self.stem_text = stem
        self.assets: list[object] = []


class _FakeAnswer:
    def __init__(
        self,
        *,
        aid: int,
        qid: int,
        is_correct: bool,
        selected: str = "[\"A\"]",
        correct: str = "[\"A\"]",
        session_id: int = 1,
    ) -> None:
        self.id = aid
        self.session_id = session_id
        self.question_id = qid
        self.is_correct = is_correct
        self.selected_answer = selected
        self.correct_answer_snapshot = correct
        self.question = _FakeQuestion(qid)
        from datetime import datetime
        self.answered_at = datetime(2026, 4, 28, 10, 0, 0)


def test_aggregate_wrong_groups_skip_correct_answers() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _aggregate_wrong_groups

    answers = [
        _FakeAnswer(aid=1, qid=10, is_correct=True),
        _FakeAnswer(aid=2, qid=10, is_correct=True),
    ]
    out = _aggregate_wrong_groups(answers)
    assert isinstance(out, OrderedDict)
    assert len(out) == 0


def test_aggregate_wrong_groups_counts_repeats() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _aggregate_wrong_groups

    answers = [
        _FakeAnswer(aid=1, qid=10, is_correct=False),
        _FakeAnswer(aid=2, qid=11, is_correct=False),
        _FakeAnswer(aid=3, qid=10, is_correct=False),  # 第二次错 q10
    ]
    out = _aggregate_wrong_groups(answers)
    assert len(out) == 2
    assert out[10].wrong_count == 2
    assert out[11].wrong_count == 1


def test_serialize_recent_attempts_respects_limit() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _serialize_recent_attempts

    answers = [_FakeAnswer(aid=i, qid=100 + i, is_correct=i % 2 == 0) for i in range(10)]
    out = _serialize_recent_attempts(answers, limit=3)
    assert len(out) == 3
    assert out[0].id == 0
    assert out[2].id == 2


def test_serialize_recent_attempts_empty_input_empty_output() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _serialize_recent_attempts

    assert _serialize_recent_attempts([], limit=5) == []


# ──────────────────────────────────────────────────────────────────────────────
# Phase A.3 _create_question_from_payload + _import_single_payload pure helpers
# ──────────────────────────────────────────────────────────────────────────────


def _make_service():
    from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService

    return ExamPaperService(MagicMock())


def test_validate_question_options_single_choice_min_two() -> None:
    svc = _make_service()
    payload = {"options": [{"key": "A"}]}
    with pytest.raises(Exception, match="must contain at least two"):
        svc._validate_question_options(payload, "Q1", is_fill_blank=False)


def test_validate_question_options_single_choice_two_ok() -> None:
    svc = _make_service()
    payload = {"options": [{"key": "A"}, {"key": "B"}]}
    svc._validate_question_options(payload, "Q1", is_fill_blank=False)  # no raise


def test_validate_question_options_fill_blank_empty_ok() -> None:
    svc = _make_service()
    payload = {"options": []}
    svc._validate_question_options(payload, "Q1", is_fill_blank=True)  # no raise


def test_validate_question_options_fill_blank_non_list_raises() -> None:
    svc = _make_service()
    payload = {"options": "not-a-list"}
    with pytest.raises(Exception, match="must be a list"):
        svc._validate_question_options(payload, "Q1", is_fill_blank=True)


def test_validate_question_answer_keys_invalid_key_raises() -> None:
    svc = _make_service()
    payload = {"answerKeys": ["X"]}  # X not in [A, B]
    with pytest.raises(Exception, match="invalid options"):
        svc._validate_question_answer_keys(
            payload, "Q1", option_keys=["A", "B"], is_fill_blank=False
        )


def test_validate_question_answer_keys_fill_blank_text_ok() -> None:
    svc = _make_service()
    payload = {"answerKeys": ["100"]}
    keys = svc._validate_question_answer_keys(
        payload, "Q1", option_keys=[], is_fill_blank=True
    )
    assert keys == ["100"]


def test_validate_question_answer_keys_empty_raises() -> None:
    svc = _make_service()
    payload = {"answerKeys": []}
    with pytest.raises(Exception, match="missing answerKeys"):
        svc._validate_question_answer_keys(
            payload, "Q1", option_keys=["A", "B"], is_fill_blank=False
        )


def test_validate_question_metadata_non_dict_raises() -> None:
    svc = _make_service()
    payload = {"specialPayload": "not-dict"}
    with pytest.raises(Exception, match="specialPayload must be"):
        svc._validate_question_metadata(payload, "Q1")


def test_validate_question_metadata_happy() -> None:
    svc = _make_service()
    payload = {"specialPayload": {"a": 1}, "typePayload": {"b": 2}, "canonicalTaxonomy": {"c": 3}}
    s, t, c = svc._validate_question_metadata(payload, "Q1")
    assert s == {"a": 1}
    assert t == {"b": 2}
    assert c == {"c": 3}


def test_parse_paper_payload_bad_json_raises() -> None:
    svc = _make_service()
    with pytest.raises(Exception, match="invalid json"):
        svc._parse_paper_payload(b"not json {")


def test_parse_paper_payload_non_dict_raises() -> None:
    svc = _make_service()
    with pytest.raises(Exception, match="must be a JSON object"):
        svc._parse_paper_payload(b"[1, 2, 3]")


def test_parse_paper_payload_missing_sections_raises() -> None:
    svc = _make_service()
    with pytest.raises(Exception, match="sections must be a non-empty"):
        svc._parse_paper_payload(b'{"paperCode": "X"}')


def test_parse_paper_payload_empty_sections_raises() -> None:
    svc = _make_service()
    with pytest.raises(Exception, match="sections must be a non-empty"):
        svc._parse_paper_payload(b'{"paperCode": "X", "sections": []}')


def test_parse_paper_payload_happy_returns_triple() -> None:
    svc = _make_service()
    content = b'{"paperCode": "X", "sections": [{"key": "s1"}]}'
    payload, source_hash, sections = svc._parse_paper_payload(content)
    assert payload == {"paperCode": "X", "sections": [{"key": "s1"}]}
    assert len(source_hash) == 64  # sha256 hex
    assert sections == [{"key": "s1"}]


def test_import_counters_dataclass_defaults() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _ImportCounters

    c = _ImportCounters()
    assert c.question_position == 1
    assert c.block_order == 1
    assert c.group_order == 1
    assert c.question_count == 0
    c.question_position += 5
    c.question_count += 3
    assert c.question_position == 6
    assert c.question_count == 3


# ──────────────────────────────────────────────────────────────────────────────
# Phase D pure helpers (Phase C subagent-found pre-existing over-cap fns)
# ──────────────────────────────────────────────────────────────────────────────


def test_collect_wrong_chip_facets_dedupe_and_skip_null() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _collect_wrong_chip_facets

    class _Q:
        def __init__(self, subject: str | None, subtype: str | None) -> None:
            self.subject = subject
            self.canonical_subtype = subtype

    class _Mastery:
        def __init__(self, subject: str | None, subtype: str | None) -> None:
            self.question = _Q(subject, subtype)

    records = [
        _Mastery("常识", "政治"),
        _Mastery("常识", "经济"),
        _Mastery(None, None),  # null skipped
        _Mastery("数量", None),
        _Mastery("常识", "政治"),  # dedup
    ]
    subjects, subtypes = _collect_wrong_chip_facets(records)
    assert subjects == {"常识", "数量"}
    assert subtypes == {"政治", "经济"}


def test_extract_canonical_fields_strip_and_null() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _extract_canonical_fields

    payload = {
        "canonicalTopType": "  数量关系  ",  # strip
        "canonicalSubtype": "数列推理",
        "canonicalSecondSubtype": "",  # empty → None
        "rawRenderType": None,  # None → None
        "mappingSource": "fenbi",
    }
    out = _extract_canonical_fields(payload)
    assert out["canonical_top_type"] == "数量关系"
    assert out["canonical_subtype"] == "数列推理"
    assert out["canonical_second_subtype"] is None
    assert out["raw_render_type"] is None
    assert out["canonical_mapping_source"] == "fenbi"


def test_extract_canonical_fields_empty_payload_all_none() -> None:
    from sikao_api.modules.question_bank.application.exam_papers import _extract_canonical_fields

    out = _extract_canonical_fields({})
    assert all(v is None for v in out.values())
    assert set(out.keys()) == {
        "canonical_top_type",
        "canonical_subtype",
        "canonical_second_subtype",
        "raw_render_type",
        "canonical_mapping_source",
    }


def test_build_question_json_payloads_merges_section_meta() -> None:
    """alembic 0012: helper 改名 _serialize → _build, 返 dict 而非 json str.
    JSONB 一刀切后应用层永远拿 dict, 无 json.dumps 中间层."""
    from sikao_api.modules.question_bank.application.exam_papers import _build_question_json_payloads

    class _Section:
        section_key = "sec1"
        title = "区块一"
        instruction_text = "instructions"

    qpayload = {"foo": "bar", "__internal": "skip"}
    type_dict, special_dict, source_dict = _build_question_json_payloads(
        qpayload, special_payload={"baseline": True}, type_payload={"k": 1},
        section=_Section(), filename="paper.json",
    )
    assert type_dict == {"k": 1}
    assert special_dict["baseline"] is True
    assert special_dict["sectionKey"] == "sec1"
    assert special_dict["sectionTitle"] == "区块一"
    assert source_dict["foo"] == "bar"
    assert source_dict["sourceFilename"] == "paper.json"
    assert "__internal" not in source_dict  # `__`-prefixed keys excluded
