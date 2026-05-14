"""Tests for the fenbi batch import flow (adapter → import → manifest)."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from sikao_api.db.models import Paper, PaperRevision
from sikao_api.scripts.import_fenbi_batch import run_batch
from tests.test_fenbi_adapter import _build_minimal_fenbi


def _seed_mirror(mirror_root: Path, papers: list[tuple[str, dict]]) -> None:
    """Seed a mirror layout: <mirror_root>/papers/<id_name>/{paper.json, assets/}."""
    papers_root = mirror_root / "papers"
    papers_root.mkdir(parents=True, exist_ok=True)
    for dir_name, fenbi_dict in papers:
        paper_dir = papers_root / dir_name
        paper_dir.mkdir(parents=True, exist_ok=True)
        (paper_dir / "paper.json").write_text(json.dumps(fenbi_dict, ensure_ascii=False), encoding="utf-8")
        # Materialize asset files referenced by asset_map
        assets_dir = paper_dir / "assets"
        assets_dir.mkdir(exist_ok=True)
        for asset_path in fenbi_dict.get("asset_map", {}).values():
            target = paper_dir / asset_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b"fake-png-bytes")


def test_batch_imports_all_new(tmp_path: Path) -> None:
    mirror = tmp_path / "mirror"
    staging = tmp_path / "staging"
    db_file = tmp_path / "exam.db"

    fenbi_a = _build_minimal_fenbi(with_material=True)
    fenbi_a["paper"]["id"] = 100001
    fenbi_b = _build_minimal_fenbi(with_material=False)
    fenbi_b["paper"]["id"] = 100002

    _seed_mirror(mirror, [("100001_paperA", fenbi_a), ("100002_paperB", fenbi_b)])

    manifest = run_batch(
        mirror_root=mirror,
        staging_root=staging,
        db_url=f"sqlite:///{db_file}",
    )

    assert manifest["total_count"] == 2
    assert manifest["new_count"] == 2
    assert manifest["skipped_count"] == 0
    assert manifest["failed_count"] == 0
    paper_codes = sorted(p["paperCode"] for p in manifest["new_papers"])
    assert paper_codes == ["FENBI-100001", "FENBI-100002"]

    # Verify import-manifest.json on disk
    on_disk = json.loads((staging / "import-manifest.json").read_text(encoding="utf-8"))
    assert on_disk["new_count"] == 2

    # Verify staging dirs created
    assert (staging / "FENBI-100001" / "paper.standard.json").is_file()
    assert (staging / "FENBI-100002" / "paper.standard.json").is_file()

    # Verify DB rows
    engine = create_engine(f"sqlite:///{db_file}", future=True)
    with Session(engine) as s:
        revisions = s.scalars(select(PaperRevision)).all()
        assert len(revisions) == 2


def test_batch_second_run_skips_hash_match(tmp_path: Path) -> None:
    """Idempotent re-run: second pass detects source_hash match → all skipped."""
    mirror = tmp_path / "mirror"
    staging = tmp_path / "staging"
    db_file = tmp_path / "exam.db"

    fenbi = _build_minimal_fenbi(with_material=True)
    fenbi["paper"]["id"] = 200001
    _seed_mirror(mirror, [("200001_paper", fenbi)])

    db_url = f"sqlite:///{db_file}"

    # 1st run
    first = run_batch(mirror_root=mirror, staging_root=staging, db_url=db_url)
    assert first["new_count"] == 1
    assert first["skipped_count"] == 0

    # 2nd run — same mirror, same DB → source_hash hit → skipped
    second = run_batch(mirror_root=mirror, staging_root=staging, db_url=db_url)
    assert second["new_count"] == 0
    assert second["skipped_count"] == 1
    assert second["failed_count"] == 0

    # DB still has exactly 1 revision
    engine = create_engine(db_url, future=True)
    with Session(engine) as s:
        revisions = s.scalars(select(PaperRevision)).all()
        assert len(revisions) == 1


def test_batch_one_failure_does_not_block_others(tmp_path: Path) -> None:
    """单 paper 整体失败（非单题级 skip）不能阻塞其他 paper 入库 —— 对齐 §12 选择 C
    每套独立事务。失败源 = 后端 service 拒绝（这里用 sections 空触发）。"""
    mirror = tmp_path / "mirror"
    staging = tmp_path / "staging"
    db_file = tmp_path / "exam.db"

    good = _build_minimal_fenbi(with_material=False)
    good["paper"]["id"] = 300001

    # Bad paper: chapters 空 → adapter 出 sections=[] → backend ValidationError
    bad = _build_minimal_fenbi(with_material=False)
    bad["paper"]["id"] = 300002
    bad["sheet"]["chapters"] = []
    bad["questions"] = []

    _seed_mirror(mirror, [("300001_good", good), ("300002_bad", bad)])

    manifest = run_batch(
        mirror_root=mirror,
        staging_root=staging,
        db_url=f"sqlite:///{db_file}",
    )

    assert manifest["total_count"] == 2
    assert manifest["new_count"] == 1
    assert manifest["failed_count"] == 1
    assert manifest["new_papers"][0]["paperCode"] == "FENBI-300001"
    assert "300002" in manifest["failed"][0]["paper"]
    # service-internal failure 走 item.status=failed 路径，error_message 应被透传
    assert "sections must be a non-empty array" in manifest["failed"][0]["error"]

    engine = create_engine(f"sqlite:///{db_file}", future=True)
    with Session(engine) as s:
        revisions = s.scalars(select(PaperRevision)).all()
        assert len(revisions) == 1
        assert revisions[0].paper.paper_code == "FENBI-300001"


def test_batch_skips_bad_question_keeps_rest_of_paper(tmp_path: Path) -> None:
    """skip_bad_questions=True 路径 —— paper 内 1 题 invalid（choice 越界）不应丢
    整套，剩余题目正常入库。这是 §12 fail-fast 的显式开关边界。"""
    mirror = tmp_path / "mirror"
    staging = tmp_path / "staging"
    db_file = tmp_path / "exam.db"

    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["paper"]["id"] = 500001
    # 加 2 道好题
    for i in range(2):
        good_q = {
            "question_id": 5000 + i,
            "type": 1,
            "chapter": fenbi["questions"][0]["chapter"],
            "material_indexes": [],
            "stem_html": f"<p>good q{i}</p>",
            "stem_text": f"good q{i}",
            "options": [
                {"label": k, "html": f"{k}", "text": k, "images": []} for k in ["A", "B", "C", "D"]
            ],
            "answer": {"choice": str(i), "raw": {"choice": str(i), "type": 201}},
            "analysis_html": "",
            "analysis_text": "",
            "images": [],
        }
        fenbi["questions"].append(good_q)
    fenbi["sheet"]["chapters"][0]["questionCount"] = len(fenbi["questions"])
    # 第 0 题（_build_minimal_fenbi 默认那道）改成 invalid choice
    fenbi["questions"][0]["answer"]["choice"] = "9"

    _seed_mirror(mirror, [("500001_partial", fenbi)])
    manifest = run_batch(
        mirror_root=mirror,
        staging_root=staging,
        db_url=f"sqlite:///{db_file}",
    )

    assert manifest["new_count"] == 1, manifest
    entry = manifest["new_papers"][0]
    # 3 题中 1 题被 skip，paper 入库剩 2 题
    assert entry["questionCount"] == 2


def test_batch_manifest_reports_missing_assets_without_failing_import(tmp_path: Path) -> None:
    mirror = tmp_path / "mirror"
    staging = tmp_path / "staging"
    db_file = tmp_path / "exam.db"

    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["paper"]["id"] = 800001
    _seed_mirror(mirror, [("800001_missing_asset", fenbi)])
    missing_asset = mirror / "papers" / "800001_missing_asset" / "assets" / "0001_abc.png"
    missing_asset.unlink()

    manifest = run_batch(
        mirror_root=mirror,
        staging_root=staging,
        db_url=f"sqlite:///{db_file}",
    )

    assert manifest["new_count"] == 1
    assert manifest["failed_count"] == 0
    assert manifest["asset_issue_count"] == 1
    entry = manifest["new_papers"][0]
    assert entry["paperCode"] == "FENBI-800001"
    assert entry["assetIssues"] == [
        {
            "kind": "question_data_missing",
            "path": "assets/0001_abc.png",
            "sourceUuid": "fenbi-1001",
        }
    ]
    assert entry["questionCount"] == 1

    on_disk = json.loads((staging / "import-manifest.json").read_text(encoding="utf-8"))
    assert on_disk["asset_issue_count"] == 1

    engine = create_engine(f"sqlite:///{db_file}", future=True)
    with Session(engine) as session:
        revision = session.scalars(select(PaperRevision)).one()
        question = revision.questions[0]
        assert question.stem_text == "<p>此题数据缺失</p>"
        assert question.is_gradable is False


def test_adapter_uuid_occurrence_for_split_material_groups(tmp_path: Path) -> None:
    """同 chapter 内两段非连续问题引用同一 material_indexes —— occurrence 后缀
    保证 sourceGroupUuid 在 paper revision 内唯一（DB UNIQUE 约束兜底）。"""
    mirror = tmp_path / "mirror"
    staging = tmp_path / "staging"
    db_file = tmp_path / "exam.db"

    fenbi = _build_minimal_fenbi(with_material=True)  # 已有 q1（独立）+ q2,q3（mat[0]）
    fenbi["paper"]["id"] = 600001
    chapter = fenbi["questions"][0]["chapter"]
    # 在材料题之后再插一道独立题，再插一道又引用 mat[0]，制造非连续
    fenbi["questions"].append({
        "question_id": 6000,
        "type": 1,
        "chapter": chapter,
        "material_indexes": [],
        "stem_html": "<p>solo</p>",
        "stem_text": "solo",
        "options": [{"label": k, "html": k, "text": k, "images": []} for k in "ABCD"],
        "answer": {"choice": "0", "raw": {"choice": "0", "type": 201}},
        "analysis_html": "",
        "analysis_text": "",
        "images": [],
    })
    fenbi["questions"].append({
        "question_id": 6001,
        "type": 1,
        "chapter": chapter,
        "material_indexes": [0],  # 重新引用 mat[0]
        "stem_html": "<p>mat-again</p>",
        "stem_text": "mat-again",
        "options": [{"label": k, "html": k, "text": k, "images": []} for k in "ABCD"],
        "answer": {"choice": "1", "raw": {"choice": "1", "type": 201}},
        "analysis_html": "",
        "analysis_text": "",
        "images": [],
    })

    _seed_mirror(mirror, [("600001_split", fenbi)])
    manifest = run_batch(
        mirror_root=mirror,
        staging_root=staging,
        db_url=f"sqlite:///{db_file}",
    )
    assert manifest["new_count"] == 1, manifest
    # 检查输出的 standard JSON 里两个 material_group 块的 sourceGroupUuid 不同
    standard = json.loads((staging / "FENBI-600001" / "paper.standard.json").read_text(encoding="utf-8"))
    section = standard["sections"][0]
    mg_blocks = [b for b in section["blocks"] if b["type"] == "material_group"]
    assert len(mg_blocks) == 2
    uuids = {mg["sourceGroupUuid"] for mg in mg_blocks}
    assert len(uuids) == 2  # 唯一
    assert any("-occ2" in u for u in uuids)


def test_batch_auto_publishes_new_paper(tmp_path: Path) -> None:
    """新 import 的 paper 必须自动 published —— 否则 /api/v2/papers (which filters
    on visible_in_public + published) 列表会返回空，前端看不到。这是上版 batch
    脚本的已知 bug，每次都得手动 publish 才能测试。"""
    mirror = tmp_path / "mirror"
    staging = tmp_path / "staging"
    db_file = tmp_path / "exam.db"

    fenbi = _build_minimal_fenbi(with_material=False)
    fenbi["paper"]["id"] = 700001
    _seed_mirror(mirror, [("700001_paper", fenbi)])

    manifest = run_batch(
        mirror_root=mirror,
        staging_root=staging,
        db_url=f"sqlite:///{db_file}",
    )
    assert manifest["new_count"] == 1

    engine = create_engine(f"sqlite:///{db_file}", future=True)
    with Session(engine) as s:
        paper = s.scalars(select(Paper).where(Paper.paper_code == "FENBI-700001")).one()
        revision = s.scalars(
            select(PaperRevision).where(PaperRevision.paper_id == paper.id)
        ).one()
        assert revision.is_published is True
        assert revision.visible_in_public is True
        assert paper.current_revision_id == revision.id


def test_batch_limit_arg_caps_processed_count(tmp_path: Path) -> None:
    mirror = tmp_path / "mirror"
    staging = tmp_path / "staging"
    db_file = tmp_path / "exam.db"

    papers = []
    for i in range(5):
        fenbi = _build_minimal_fenbi(with_material=False)
        fenbi["paper"]["id"] = 400000 + i
        papers.append((f"40000{i}_p{i}", fenbi))
    _seed_mirror(mirror, papers)

    manifest = run_batch(
        mirror_root=mirror,
        staging_root=staging,
        db_url=f"sqlite:///{db_file}",
        limit=2,
    )
    assert manifest["total_count"] == 2  # 不是 5，被 limit 截了
    assert manifest["new_count"] == 2
