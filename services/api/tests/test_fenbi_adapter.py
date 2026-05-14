"""Unit + integration tests for fenbi → standard JSON adapter.

- 单元层：用 in-memory minimal fenbi-format dict 跑 adapter，验证字段映射。
- 集成层：跑 adapter → 喂给 ExamPaperService.import_standard_json_files，验证 DB 行数对得上。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.db.base import Base
from sikao_api.db.models import (
    MaterialGroup,
    PaperBlock,
    PaperRevision,
    PaperSection,
    Question,
    QuestionAsset,
)
from sikao_api.scripts.fenbi_to_standard import convert_paper
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService


def _build_minimal_fenbi(*, with_material: bool = True) -> dict[str, Any]:
    """Hand-crafted minimal fenbi-format dict: 1 chapter "言语理解与表达" with 1 单题 + 1 材料群 (2 题)."""
    asset_url = "https://fb.fbstatic.cn/api/tarzan/images/abc.png?width=700"
    asset_local = "assets/0001_abc.png"
    questions: list[dict[str, Any]] = [
        {
            "question_id": 1001,
            "index": 1,
            "type": 1,
            "chapter": {"name": "言语理解与表达", "desc": "选择最恰当的答案"},
            "material_indexes": [],
            "stem_html": f"<p>题 1：<img src=\"{asset_url}\" /></p>",
            "stem_text": "题 1",
            "options": [
                {"label": "A", "html": "A 项", "text": "A 项", "images": []},
                {"label": "B", "html": "B 项", "text": "B 项", "images": []},
                {"label": "C", "html": "C 项", "text": "C 项", "images": []},
                {"label": "D", "html": "D 项", "text": "D 项", "images": []},
            ],
            "answer": {"choice": "1", "raw": {"choice": "1", "type": 201}},  # B
            "analysis_html": "<p>解析 1</p>",
            "analysis_text": "解析 1",
            "images": [asset_url],
        },
    ]
    materials: list[dict[str, Any]] = []
    if with_material:
        materials.append(
            {
                "index": 0,
                "id": 9001,
                "html": "<p>材料正文</p>",
                "text": "材料正文",
                "images": [],
            }
        )
        for i, ans_choice in enumerate(("0", "2"), start=2):  # A, C
            questions.append(
                {
                    "question_id": 1000 + i,
                    "index": i,
                    "type": 1,
                    "chapter": {"name": "言语理解与表达", "desc": "选择最恰当的答案"},
                    "material_indexes": [0],
                    "stem_html": f"<p>题 {i}（基于材料）</p>",
                    "stem_text": f"题 {i}",
                    "options": [
                        {"label": k, "html": f"{k} 项", "text": f"{k} 项", "images": []}
                        for k in ["A", "B", "C", "D"]
                    ],
                    "answer": {"choice": ans_choice, "raw": {"choice": ans_choice, "type": 201}},
                    "analysis_html": f"<p>解析 {i}</p>",
                    "analysis_text": f"解析 {i}",
                    "images": [],
                }
            )

    return {
        "paper": {
            "id": 9999999,
            "name": "2024年某省公务员录用考试《行测》题（A类）（网友回忆版）",
            "date": "2024-12-08",
            "combineKey": "x_x_xxx",
            "labels": [{"id": 99, "name": "测试"}],
        },
        "sheet": {
            "id": 1,
            "name": "test",
            "questionCount": len(questions),
            "time": 7200,
            "chapters": [
                {
                    "name": "言语理解与表达",
                    "desc": "选择最恰当的答案",
                    "time": 1500,
                    "questionCount": len(questions),
                    "answerCount": 0,
                    "presetScore": 30.0,
                }
            ],
            "questionIds": [q["question_id"] for q in questions],
        },
        "materials": materials,
        "questions": questions,
        "asset_map": {asset_url: asset_local},
        "source": {"scraped_at": "2026-04-26"},
    }


def _write_fenbi_input(tmp_path: Path, fenbi_dict: dict[str, Any]) -> Path:
    """Write fenbi paper dict + a fake assets dir to tmp_path/fenbi-input/."""
    input_dir = tmp_path / "fenbi-input"
    input_dir.mkdir()
    (input_dir / "paper.json").write_text(json.dumps(fenbi_dict, ensure_ascii=False), encoding="utf-8")
    assets_dir = input_dir / "assets"
    assets_dir.mkdir()
    # Create a tiny placeholder file for each asset path
    for path in fenbi_dict.get("asset_map", {}).values():
        target = input_dir / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"fake-png-bytes")
    return input_dir


def test_adapter_basic_field_mapping(tmp_path: Path) -> None:
    fenbi = _build_minimal_fenbi(with_material=True)
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"

    out_path = convert_paper(input_dir, output_dir)

    standard = json.loads(out_path.read_text(encoding="utf-8"))

    # paper-level
    assert standard["paperCode"] == "FENBI-9999999"
    assert standard["paperName"] == fenbi["paper"]["name"]
    assert standard["examYear"] == 2024  # 解析 paper.name 优先
    assert standard["sourceProvider"] == "fenbi"
    assert standard["sourceKind"] == "网友回忆版"

    # 1 section, 2 blocks (1 单题 + 1 材料群)
    assert len(standard["sections"]) == 1
    section = standard["sections"][0]
    assert section["title"] == "言语理解与表达"
    assert section["key"] == "chapter-1"
    assert len(section["blocks"]) == 2

    # block 0: question
    q_block = section["blocks"][0]
    assert q_block["type"] == "question"
    assert q_block["sourceUuid"] == "fenbi-1001"
    assert q_block["answerKeys"] == ["B"]  # choice="1" → B
    assert q_block["rendererKey"] == "single_choice"
    assert q_block["canonicalTaxonomy"]["canonicalTopType"] == "言语理解"
    # stem 里的 fenbi URL 已被重写为本地 assets/ 路径
    assert "assets/0001_abc.png" in q_block["stemText"]
    assert "fb.fbstatic.cn" not in q_block["stemText"]
    # assets 数组也指向本地路径
    assert any(a["path"] == "assets/0001_abc.png" and a["role"] == "stem" for a in q_block.get("assets", []))

    # block 1: material_group with 2 questions
    mg = section["blocks"][1]
    assert mg["type"] == "material_group"
    assert mg["groupKind"] == "passage_reading"  # 言语理解 default
    assert mg["sourceGroupUuid"] == "fenbi-material-9001"
    assert len(mg["questions"]) == 2
    assert mg["questions"][0]["sourceUuid"] == "fenbi-1002"
    assert mg["questions"][0]["answerKeys"] == ["A"]  # choice="0" → A
    assert mg["questions"][1]["answerKeys"] == ["C"]  # choice="2" → C


def test_adapter_data_analysis_uses_data_analysis_group_kind(tmp_path: Path) -> None:
    fenbi = _build_minimal_fenbi(with_material=True)
    # 把章节改成资料分析
    fenbi["sheet"]["chapters"][0]["name"] = "资料分析"
    for q in fenbi["questions"]:
        q["chapter"]["name"] = "资料分析"
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    out = convert_paper(input_dir, output_dir)
    data = json.loads(out.read_text(encoding="utf-8"))
    section = data["sections"][0]
    mg = next(b for b in section["blocks"] if b["type"] == "material_group")
    assert mg["groupKind"] == "data_analysis"


def test_adapter_rejects_unsupported_type(tmp_path: Path) -> None:
    """fenbi type=4/6+ 未见, 仍 raise.

    Phase 6.5 — type=5 (填空) 现已支持走 fill_blank; 但 type=4/6+ 没观察到,
    保留 raise 兜底.
    """
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 7  # 未观察到的类型
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    with pytest.raises(ValueError, match="unsupported fenbi type"):
        convert_paper(input_dir, output_dir, skip_bad_questions=False)


def test_adapter_type_4_raises_with_type_number_in_message(tmp_path: Path) -> None:
    """P1 review fix Phase 4.4 — type=4 (fenbi 阅读理解类候选) 必须 raise,
    错误信息含 type=4 关键字方便 ops 定位.
    """
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 4
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    with pytest.raises(ValueError, match=r"unsupported fenbi type=4"):
        convert_paper(input_dir, output_dir, skip_bad_questions=False)


def test_adapter_type_99_raises_with_type_number_in_message(tmp_path: Path) -> None:
    """P1 review fix Phase 4.4 — 远超已知范围 type=99 也 raise (defense in depth).
    若上游 fenbi 加新题型, 这里立刻爆而不是默默 fallback.
    """
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 99
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    with pytest.raises(ValueError, match=r"unsupported fenbi type=99"):
        convert_paper(input_dir, output_dir, skip_bad_questions=False)


def test_adapter_type5_fill_blank_keeps_answer_text(tmp_path: Path) -> None:
    """Phase 6.5 — type=5 填空: options=0, answer.choice 是答案文本 (e.g. "100"),
    adapter 输出 questionKind=fill_blank, answerKeys=[answer_text].
    """
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 5
    fenbi["questions"][0]["options"] = []  # 填空无 options
    fenbi["questions"][0]["answer"] = {"choice": "100"}
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    out_json = convert_paper(input_dir, output_dir, skip_bad_questions=False)
    standard = json.loads(out_json.read_text(encoding="utf-8"))
    q = standard["sections"][0]["blocks"][0]
    assert q["questionKind"] == "fill_blank"
    assert q["rendererKey"] == "fill_blank"
    assert q["answerKeys"] == ["100"]
    assert q["options"] == []
    assert q["canonicalTaxonomy"]["rawRenderType"] == "fenbi-type-5"


def test_adapter_type5_empty_answer_raises(tmp_path: Path) -> None:
    """type=5 但 answer.choice 缺 / 空 → raise (上游数据异常)."""
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 5
    fenbi["questions"][0]["options"] = []
    fenbi["questions"][0]["answer"] = {"choice": ""}
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    with pytest.raises(ValueError, match="empty answer.choice|missing answer.choice"):
        convert_paper(input_dir, output_dir, skip_bad_questions=False)


def test_adapter_rejects_type1_with_multi_answer(tmp_path: Path) -> None:
    """type=1 (单选) 但 answer.choice 含多个 indices → raise.

    保险检查 — fenbi 上游约定 type=1 应为单字符 answer.choice; 真出现 "1,2"
    意味着数据异常 / type 标错, 应该 fail-fast 而不是 silently 当多选解码.
    """
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 1
    fenbi["questions"][0]["answer"]["choice"] = "1,2"  # 单选不应该有 2 个 answer
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    with pytest.raises(ValueError, match="single.*multi answer|type=1"):
        convert_paper(input_dir, output_dir, skip_bad_questions=False)


def test_adapter_type2_multi_select_decodes_comma_separated_indices(tmp_path: Path) -> None:
    """type=2 (多选) answer.choice="1,3" → questionKind=multiple_choice, answerKeys=[B,D]."""
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 2
    fenbi["questions"][0]["answer"]["choice"] = "1,3"
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    out_json = convert_paper(input_dir, output_dir, skip_bad_questions=False)
    standard = json.loads(out_json.read_text(encoding="utf-8"))
    q = standard["sections"][0]["blocks"][0]
    assert q["questionKind"] == "multiple_choice"
    assert q["rendererKey"] == "multiple_choice"
    assert q["answerKeys"] == ["B", "D"]
    assert q["canonicalTaxonomy"]["rawRenderType"] == "fenbi-type-2"


def test_adapter_type3_uncertain_select_treated_as_multi(tmp_path: Path) -> None:
    """type=3 (不定项) → multiple_choice renderer 即使 answer 只选 1 项."""
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 3
    fenbi["questions"][0]["answer"]["choice"] = "2"  # 不定项实际只选 C
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    out_json = convert_paper(input_dir, output_dir, skip_bad_questions=False)
    standard = json.loads(out_json.read_text(encoding="utf-8"))
    q = standard["sections"][0]["blocks"][0]
    assert q["questionKind"] == "multiple_choice"
    assert q["rendererKey"] == "multiple_choice"
    assert q["answerKeys"] == ["C"]
    assert q["canonicalTaxonomy"]["rawRenderType"] == "fenbi-type-3"


def test_adapter_type2_index_out_of_range_raises(tmp_path: Path) -> None:
    """type=2 answer.choice="1,99" 超出 4-option 范围 → raise out of range."""
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 2
    fenbi["questions"][0]["answer"]["choice"] = "1,99"
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    with pytest.raises(ValueError, match="out of range"):
        convert_paper(input_dir, output_dir, skip_bad_questions=False)


def test_adapter_type2_duplicate_index_raises(tmp_path: Path) -> None:
    """answer.choice="1,1" 重复 index → raise duplicate."""
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["questions"][0]["type"] = 2
    fenbi["questions"][0]["answer"]["choice"] = "1,1"
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    with pytest.raises(ValueError, match="duplicate index"):
        convert_paper(input_dir, output_dir, skip_bad_questions=False)


def test_adapter_extract_year_prefers_year_with_question_suffix(tmp_path: Path) -> None:
    """paper.name 含多个 'YYYY年' 时优先匹配 'YYYY年...真题/试题/题'。"""
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["paper"]["name"] = "2026年大纲解析（含2025年真题）"
    fenbi["paper"]["date"] = "2026-01-01"
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    out = convert_paper(input_dir, output_dir)
    standard = json.loads(out.read_text(encoding="utf-8"))
    assert standard["examYear"] == 2025  # 取后面那个含"真题"的


def test_adapter_multi_chapter_split(tmp_path: Path) -> None:
    """多 chapter paper：每 chapter 一个 section，questions 按 chapter.name 分桶。"""
    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["sheet"]["chapters"] = [
        {
            "name": "言语理解与表达",
            "desc": "选择题",
            "time": 1500,
            "questionCount": 2,
            "answerCount": 0,
            "presetScore": 14.0,
        },
        {"name": "数量关系", "desc": "数学", "time": 1200, "questionCount": 1, "answerCount": 0, "presetScore": 7.0},
    ]
    base_q = fenbi["questions"][0]
    fenbi["questions"] = [
        {**base_q, "question_id": 7001, "chapter": fenbi["sheet"]["chapters"][0]},
        {**base_q, "question_id": 7002, "chapter": fenbi["sheet"]["chapters"][0]},
        {**base_q, "question_id": 7003, "chapter": fenbi["sheet"]["chapters"][1]},
    ]
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    out = convert_paper(input_dir, output_dir)
    standard = json.loads(out.read_text(encoding="utf-8"))

    assert len(standard["sections"]) == 2
    titles = [s["title"] for s in standard["sections"]]
    assert titles == ["言语理解与表达", "数量关系"]
    assert standard["sections"][0]["key"] == "chapter-1"
    assert standard["sections"][1]["key"] == "chapter-2"
    # 第一章 2 题，第二章 1 题
    assert sum(1 for b in standard["sections"][0]["blocks"]) == 2
    assert sum(1 for b in standard["sections"][1]["blocks"]) == 1
    # canonicalTopType 按 _CHAPTER_CANONICAL_TOP 映射
    q3 = standard["sections"][1]["blocks"][0]
    assert q3["canonicalTaxonomy"]["canonicalTopType"] == "数量关系"


def test_adapter_assets_copied(tmp_path: Path) -> None:
    fenbi = _build_minimal_fenbi(with_material=False)
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    convert_paper(input_dir, output_dir, copy_assets=True)
    assert (output_dir / "assets" / "0001_abc.png").is_file()
    assert (output_dir / "assets" / "0001_abc.png").read_bytes() == b"fake-png-bytes"


def test_adapter_marks_missing_asset_question_as_data_missing(tmp_path: Path) -> None:
    fenbi = _build_minimal_fenbi(with_material=False)
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    (input_dir / "assets" / "0001_abc.png").unlink()
    output_dir = tmp_path / "out"

    out_json = convert_paper(input_dir, output_dir, copy_assets=True)
    standard = json.loads(out_json.read_text(encoding="utf-8"))
    question = standard["sections"][0]["blocks"][0]

    assert question["sourceUuid"] == "fenbi-1001"
    assert question["stemText"] == "<p>此题数据缺失</p>"
    assert question["isGradable"] is False
    assert question["specialPayload"] == {
        "dataMissing": True,
        "missingAssetPaths": ["assets/0001_abc.png"],
    }
    assert question["tags"] == ["data-missing"]
    assert "assets" not in question


@pytest.fixture
def db_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    return SessionLocal()


def test_adapter_output_imports_into_db(tmp_path: Path, db_session: Session) -> None:
    """End-to-end: fenbi paper → adapter → ExamPaperService.import_standard_json_files → DB rows."""
    fenbi = _build_minimal_fenbi(with_material=True)
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    out_json = convert_paper(input_dir, output_dir, copy_assets=True)

    service = ExamPaperService(db_session)
    summary = service.import_standard_json_files(
        files=[(out_json.name, out_json.read_bytes())],
        base_dir=output_dir,
        created_by="test-user",
    )

    assert summary.status == "completed"
    assert summary.imported_papers == 1
    assert summary.imported_questions == 3  # 1 单题 + 2 材料题

    # Verify the persisted revision tree
    revision = db_session.scalars(select(PaperRevision)).one()
    assert revision.question_count == 3
    assert revision.paper.paper_code == "FENBI-9999999"

    sections = db_session.scalars(select(PaperSection).where(PaperSection.paper_revision_id == revision.id)).all()
    assert len(sections) == 1
    assert sections[0].section_key == "chapter-1"
    assert sections[0].title == "言语理解与表达"
    assert sections[0].question_count == 3

    blocks = db_session.scalars(select(PaperBlock).where(PaperBlock.paper_revision_id == revision.id)).all()
    assert len(blocks) == 2
    types = sorted(b.block_type for b in blocks)
    assert types == ["material_group", "question"]

    material_groups = db_session.scalars(
        select(MaterialGroup).where(MaterialGroup.paper_revision_id == revision.id)
    ).all()
    assert len(material_groups) == 1
    assert material_groups[0].group_kind == "passage_reading"

    questions = db_session.scalars(select(Question).where(Question.paper_revision_id == revision.id)).all()
    assert len(questions) == 3
    # Position order matches input order
    by_pos = sorted(questions, key=lambda q: q.position)
    assert by_pos[0].source_uuid == "fenbi-1001"
    assert by_pos[1].source_uuid == "fenbi-1002"
    assert by_pos[2].source_uuid == "fenbi-1003"
    assert by_pos[0].canonical_top_type == "言语理解"

    # First question 应该有 stem asset（从 fenbi 重写的 assets/0001_abc.png）
    q1_assets = db_session.scalars(
        select(QuestionAsset).where(QuestionAsset.question_id == by_pos[0].id)
    ).all()
    assert any(a.file_path.endswith("assets/0001_abc.png") for a in q1_assets)


def test_standard_import_rejects_missing_asset_file(tmp_path: Path, db_session: Session) -> None:
    fenbi = _build_minimal_fenbi(with_material=False)
    input_dir = _write_fenbi_input(tmp_path, fenbi)
    output_dir = tmp_path / "out"
    out_json = convert_paper(input_dir, output_dir, copy_assets=True)
    missing_asset = output_dir / "assets" / "0001_abc.png"
    missing_asset.unlink()

    service = ExamPaperService(db_session)
    summary = service.import_standard_json_files(
        files=[(out_json.name, out_json.read_bytes())],
        base_dir=output_dir,
        created_by="test-user",
    )

    assert summary.status == "failed"
    assert summary.imported_papers == 0
    assert summary.imported_questions == 0
    assert "asset file not found" in summary.items[0].error_message
    assert db_session.scalars(select(Question)).all() == []
    assert db_session.scalars(select(QuestionAsset)).all() == []
