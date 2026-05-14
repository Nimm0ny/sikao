"""Adapter: convert a Fenbi-scraped paper directory to standard JSON.

Input layout (from `fenbi_scraper/fenbi_output/papers/<id_name>/`):
    paper.json    — Fenbi 抓取产物（paper / sheet / materials / questions / asset_map）
    assets/       — 题面 / 选项 / 材料中引用的图片，文件名形如 `0001_<hash>.png|bin`

Output layout:
    <out_dir>/paper.standard.json
    <out_dir>/assets/<original-filename>          — 从 input 复制（默认）

Standard JSON schema 见 services/api/src/sikao_api/modules/question_bank/application/exam_papers.py::_import_single_payload。

调用入口:
    python -m scripts.import.fenbi_to_standard --input <fenbi_paper_dir> --output <out_dir>
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Fenbi answer.choice "0/1/2/3" → A/B/C/D（看 fenbi sample 里 choice="1" + 解析"故正确答案为B" 实证）
# A-Z 26 字母覆盖联考 paper (412/420/421/422/423/425) 8 选项题型 (xingce import
# 命中 4 道 index 6/7 越界), 防 fenbi 上游再加新形式 N 选 N 直接踩坑.
_CHOICE_LETTERS = [chr(ord("A") + i) for i in range(26)]

# Fenbi 6 个 chapter 名 → canonicalTopType（行测 5 大模块 + 政治理论）
_CHAPTER_CANONICAL_TOP = {
    "政治理论": "政治理论",
    "常识判断": "常识判断",
    "言语理解与表达": "言语理解",
    "数量关系": "数量关系",
    "判断推理": "判断推理",
    "资料分析": "资料分析",
}

# Fenbi 章节 → standard groupKind（资料分析的材料是 "data_analysis"，其他阅读类是 "passage_reading"）
_CHAPTER_GROUP_KIND = {
    "资料分析": "data_analysis",
}
_DEFAULT_GROUP_KIND = "passage_reading"
_DATA_MISSING_STEM_HTML = "<p>此题数据缺失</p>"


def convert_paper(
    input_dir: Path,
    output_dir: Path,
    *,
    paper_code_prefix: str = "FENBI-",
    copy_assets: bool = True,
    skip_bad_questions: bool = False,
) -> Path:
    """Convert one Fenbi paper directory to standard JSON.

    Returns the path to the generated `paper.standard.json`.

    skip_bad_questions: 若 True，遇到单题数据异常（缺 answer / 选项越界 / 非 type=1
    单选）时 logger.warning + 跳过该题，不影响整套。默认 False（fail-fast）。

    hash 稳定性依赖 fenbi paper.json 内字段顺序：dict 保序 + ensure_ascii=False +
    indent=2 三者保证同输入产出同 bytes。fenbi 上游若调题序，hash 会变（这正是
    我们要的 — 内容变就触发新 revision）。
    """
    input_dir = input_dir.resolve()
    output_dir = output_dir.resolve()
    if not (input_dir / "paper.json").is_file():
        raise FileNotFoundError(f"missing paper.json under {input_dir}")

    raw = json.loads((input_dir / "paper.json").read_text(encoding="utf-8"))
    standard = _assemble_standard(
        raw,
        paper_code_prefix=paper_code_prefix,
        skip_bad_questions=skip_bad_questions,
        existing_asset_paths=_collect_existing_asset_paths(input_dir),
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    out_json = output_dir / "paper.standard.json"
    out_json.write_text(json.dumps(standard, ensure_ascii=False, indent=2), encoding="utf-8")

    if copy_assets:
        _copy_assets(input_dir / "assets", output_dir / "assets")

    return out_json


def _assemble_standard(
    raw: dict[str, Any],
    *,
    paper_code_prefix: str,
    skip_bad_questions: bool,
    existing_asset_paths: set[str],
) -> dict[str, Any]:
    paper_meta = raw["paper"]
    paper_name = str(paper_meta["name"]).strip()
    exam_year = _extract_year(paper_name) or _extract_year(paper_meta.get("date"))
    sections = _build_sections(
        chapters=raw["sheet"].get("chapters") or [],
        questions=raw["questions"],
        materials=raw.get("materials") or [],
        rewrite_map=_build_rewrite_map(raw.get("asset_map") or {}),
        skip_bad_questions=skip_bad_questions,
        existing_asset_paths=existing_asset_paths,
    )
    return {
        "paperCode": f"{paper_code_prefix}{paper_meta['id']}".upper(),
        "paperName": paper_name,
        "examYear": exam_year,
        "sourceProvider": "fenbi",
        "sourceKind": _infer_source_kind(paper_name),
        "sortOrder": exam_year * 100 if exam_year else 0,
        "visibleInPublic": True,
        "sections": sections,
    }


def _copy_assets(src_dir: Path, dst_dir: Path) -> None:
    if not src_dir.is_dir():
        return
    dst_dir.mkdir(parents=True, exist_ok=True)
    for src in src_dir.iterdir():
        if src.is_file():
            shutil.copy2(src, dst_dir / src.name)


def _collect_existing_asset_paths(input_dir: Path) -> set[str]:
    assets_root = input_dir / "assets"
    if not assets_root.is_dir():
        return set()
    return {
        path.relative_to(input_dir).as_posix()
        for path in assets_root.rglob("*")
        if path.is_file()
    }


def _build_rewrite_map(asset_map: dict[str, str]) -> dict[str, str]:
    """Fenbi asset_map keys 是绝对 URL，但 stem/option HTML 里 src 可能是 protocol-relative
    (`//fb...`)。把所有变体都加进去，方便 _rewrite_html 一次查找。"""
    rewrite: dict[str, str] = {}
    for url, local_path in asset_map.items():
        rewrite[url] = local_path
        # protocol-relative variant
        if url.startswith("https://"):
            rewrite["//" + url[len("https://") :]] = local_path
        elif url.startswith("http://"):
            rewrite["//" + url[len("http://") :]] = local_path
    return rewrite


_IMG_SRC_RE = re.compile(r'(<img[^>]*\bsrc=")([^"]+)(")', re.IGNORECASE)


def _rewrite_html(html: str, rewrite_map: dict[str, str]) -> str:
    """重写 HTML 里 <img src="..."> 为本地相对路径（adapter 输出目录里的 assets/xxx）。"""
    if not html:
        return html

    def _replace(match: re.Match[str]) -> str:
        prefix, src, suffix = match.group(1), match.group(2), match.group(3)
        local = rewrite_map.get(src)
        return f"{prefix}{local}{suffix}" if local else match.group(0)

    return _IMG_SRC_RE.sub(_replace, html)


def _resolve_assets(image_urls: list[str], rewrite_map: dict[str, str], role: str) -> list[dict[str, str]]:
    """Fenbi `images` 列表 → standard `assets[]`（去重，保留出现顺序）。"""
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for url in image_urls or []:
        local = rewrite_map.get(url)
        if local and local not in seen:
            seen.add(local)
            out.append({"path": local, "role": role})
    return out


def _build_sections(
    *,
    chapters: list[dict[str, Any]],
    questions: list[dict[str, Any]],
    materials: list[dict[str, Any]],
    rewrite_map: dict[str, str],
    existing_asset_paths: set[str],
    skip_bad_questions: bool = False,
) -> list[dict[str, Any]]:
    """按 chapter.name 分组 questions（fenbi questions 顺序与 chapter 顺序一致），
    在每个 section 内按出现顺序合并连续共享同 material 的题为 material_group block。"""
    # chapter name → chapter meta
    chapter_meta_by_name: dict[str, dict[str, Any]] = {ch["name"]: ch for ch in chapters}
    # 维持 chapter 出现顺序
    chapter_order = [ch["name"] for ch in chapters]
    # 按章节分桶
    questions_by_chapter: dict[str, list[dict[str, Any]]] = {name: [] for name in chapter_order}
    for q in questions:
        ch_name = (q.get("chapter") or {}).get("name")
        if ch_name not in questions_by_chapter:
            # 章节不在 sheet.chapters 里 —— 数据异常，跳过整题
            logger.warning("question %s has unknown chapter %r, skipped", q.get("question_id"), ch_name)
            continue
        questions_by_chapter[ch_name].append(q)

    sections: list[dict[str, Any]] = []
    for index, name in enumerate(chapter_order, start=1):
        meta = chapter_meta_by_name[name]
        ch_questions = questions_by_chapter.get(name) or []
        if not ch_questions:
            continue
        blocks = _build_blocks(
            ch_questions=ch_questions,
            chapter_name=name,
            materials=materials,
            rewrite_map=rewrite_map,
            skip_bad_questions=skip_bad_questions,
            existing_asset_paths=existing_asset_paths,
        )
        if not blocks:
            # 整章题目全部 skip → 跳过本 section（后端要求 blocks 非空）
            continue
        sections.append(
            {
                "key": f"chapter-{index}",
                "title": name,
                "instructionText": str(meta.get("desc") or "").strip(),
                "blocks": blocks,
            }
        )
    return sections


def _build_blocks(
    *,
    ch_questions: list[dict[str, Any]],
    chapter_name: str,
    materials: list[dict[str, Any]],
    rewrite_map: dict[str, str],
    existing_asset_paths: set[str],
    skip_bad_questions: bool = False,
) -> list[dict[str, Any]]:
    """同 chapter 内合并 material_group：连续共享同一组 material_indexes 的题归入一个 block。

    skip_bad_questions=True 时遇到单题数据异常（缺 answer / 选项越界）跳过 + warning。
    """
    blocks: list[dict[str, Any]] = []
    state = _BlockBuildState()

    for q in ch_questions:
        try:
            payload = _build_question_payload(q, rewrite_map, existing_asset_paths)
        except ValueError as exc:
            if skip_bad_questions:
                logger.warning("skip bad question %s: %s", q.get("question_id"), exc)
                continue
            raise
        _attach_payload_to_blocks(
            payload=payload,
            mat_indexes=tuple(q.get("material_indexes") or []),
            blocks=blocks,
            state=state,
            materials=materials,
            chapter_name=chapter_name,
            rewrite_map=rewrite_map,
        )

    # material_group 在 skip 后可能只剩空 questions[]，后端要求非空 → 删
    return [b for b in blocks if b["type"] == "question" or b.get("questions")]


@dataclass
class _BlockBuildState:
    """Mutable accumulator for _attach_payload_to_blocks across one chapter."""

    current_group: dict[str, Any] | None = None
    current_group_key: tuple[int, ...] | None = None
    # 同 chapter 内同一 material_indexes 可能被非连续位置的题引用（fenbi 数据偶
    # 有此情况）—— 每次新建 material_group 递增 occurrence，配合 _build_material_group_block
    # 让 sourceGroupUuid 在 revision 内唯一（DB 有 UNIQUE(revision_id, source_group_uuid)）。
    material_occurrence: dict[tuple[int, ...], int] = field(default_factory=dict)


def _attach_payload_to_blocks(
    *,
    payload: dict[str, Any],
    mat_indexes: tuple[int, ...],
    blocks: list[dict[str, Any]],
    state: _BlockBuildState,
    materials: list[dict[str, Any]],
    chapter_name: str,
    rewrite_map: dict[str, str],
) -> None:
    if not mat_indexes:
        state.current_group = None
        state.current_group_key = None
        blocks.append({"type": "question", **payload})
        return

    if mat_indexes == state.current_group_key and state.current_group is not None:
        state.current_group["questions"].append(payload)
        return

    state.current_group_key = mat_indexes
    occurrence = state.material_occurrence.get(mat_indexes, 0) + 1
    state.material_occurrence[mat_indexes] = occurrence
    new_group = _build_material_group_block(
        mat_indexes=mat_indexes,
        materials=materials,
        chapter_name=chapter_name,
        rewrite_map=rewrite_map,
        occurrence=occurrence,
    )
    new_group["questions"].append(payload)
    state.current_group = new_group
    blocks.append(new_group)


# Fenbi type → (kind / rendererKey) 映射. 数据实测：
#   type=1: 单选 (12,200+ 题)
#   type=2: 多选 (~9 题, answer.choice 形如 "1,3" 逗号分隔 indices)
#   type=3: 不定项 (~45 题, 题面允许多选, answer.choice 可能是 "1" 或 "1,3")
#         → UI 同多选, 只是单选时 user 也只选 1 个 (运营时长按钮可强制多选?)
#   type=5: 填空/数字 (~13 题, options=0, answer.choice 是数字字符串)
#         → FillBlankRenderer (text input + 文本判分)
#   type=4/6+: 未见, raise
_FENBI_TYPE_TO_KIND: dict[int, tuple[str, str]] = {
    1: ("single_choice", "single_choice"),
    2: ("multiple_choice", "multiple_choice"),
    3: ("multiple_choice", "multiple_choice"),  # 不定项 UI 跟多选一致
    5: ("fill_blank", "fill_blank"),
}


def _decode_answer_indices(raw_choice: object, qid: object) -> list[int]:
    """Parse fenbi answer.choice into a sorted list of 0-based option indices.

    Supports:
      - "1"          → [1]
      - "1,3"        → [1, 3]
      - "0"          → [0]   (会下游验证是否真在 options 范围内)
    Raises ValueError on:
      - empty / whitespace
      - non-numeric piece
      - duplicate index
    """
    if raw_choice is None:
        raise ValueError(f"question {qid} has missing answer.choice")
    text = str(raw_choice).strip()
    if not text:
        raise ValueError(f"question {qid} has empty answer.choice")
    parts = [p.strip() for p in text.split(",")]
    indices: list[int] = []
    seen: set[int] = set()
    for p in parts:
        if not p.isdigit():
            raise ValueError(f"question {qid} has non-numeric answer.choice piece {p!r} (raw={raw_choice!r})")
        i = int(p)
        if i in seen:
            raise ValueError(f"question {qid} has duplicate index {i} in answer.choice={raw_choice!r}")
        seen.add(i)
        indices.append(i)
    return sorted(indices)


def _build_question_payload(
    q: dict[str, Any],
    rewrite_map: dict[str, str],
    existing_asset_paths: set[str],
) -> dict[str, Any]:
    # P1 review fix Phase A.1: 拆 _extract_answer_keys / _build_canonical_taxonomy
    # SRP helper. 主函数只做 type lookup + assemble.
    # v0.2 Phase 6.3b — 支持 type=1/2/3（单选 / 多选 / 不定项）.
    # Phase 6.5 — 加 type=5 (填空/数字, options=0, answer 是文本) 走 fill_blank.
    # type=4/6+ 仍 raise.
    qtype = q.get("type")
    if not isinstance(qtype, int):
        raise ValueError(f"question {q.get('question_id')} has invalid fenbi type={qtype!r}")
    kind_renderer = _FENBI_TYPE_TO_KIND.get(qtype)
    if kind_renderer is None:
        raise ValueError(f"question {q.get('question_id')} has unsupported fenbi type={qtype}")
    question_kind, renderer_key = kind_renderer

    chapter_name = (q.get("chapter") or {}).get("name") or ""
    options_payload, option_assets = _build_options(q.get("options") or [], rewrite_map)
    raw_answer = (q.get("answer") or {}).get("choice")
    answer_keys = _extract_answer_keys(qtype, raw_answer, options_payload, q.get("question_id"))
    missing_asset_paths = _missing_question_asset_paths(q, rewrite_map, existing_asset_paths)

    stem_html = _rewrite_html(str(q.get("stem_html") or ""), rewrite_map)
    explanation_html = _rewrite_html(str(q.get("analysis_html") or ""), rewrite_map)
    stem_assets = _resolve_assets(q.get("images") or [], rewrite_map, role="stem")

    payload: dict[str, Any] = {
        "sourceUuid": f"fenbi-{q['question_id']}",
        "questionKind": question_kind,
        "subtypeName": chapter_name or question_kind,
        "stemText": stem_html,
        "options": options_payload,
        "answerKeys": answer_keys,
        "explanationText": explanation_html,
        "difficultyCode": "unknown",
        "rendererKey": renderer_key,
        "canonicalTaxonomy": _build_canonical_taxonomy(chapter_name, qtype),
        "tags": [],
    }
    if missing_asset_paths:
        return _mark_question_data_missing(payload, missing_asset_paths)
    if stem_assets or option_assets:
        # option assets 已经写入 options[].assets，不在 question.assets 里重复
        payload["assets"] = stem_assets
    return payload


def _missing_question_asset_paths(
    q: dict[str, Any],
    rewrite_map: dict[str, str],
    existing_asset_paths: set[str],
) -> list[str]:
    paths: list[str] = []
    seen: set[str] = set()
    for url in _iter_question_image_urls(q):
        local_path = rewrite_map.get(url)
        if local_path and local_path not in existing_asset_paths and local_path not in seen:
            seen.add(local_path)
            paths.append(local_path)
    return paths


def _iter_question_image_urls(q: dict[str, Any]) -> list[str]:
    urls = [str(url) for url in q.get("images") or [] if str(url).strip()]
    for option in q.get("options") or []:
        if isinstance(option, dict):
            urls.extend(str(url) for url in option.get("images") or [] if str(url).strip())
    return urls


def _mark_question_data_missing(
    payload: dict[str, Any],
    missing_asset_paths: list[str],
) -> dict[str, Any]:
    payload["stemText"] = _DATA_MISSING_STEM_HTML
    payload["explanationText"] = ""
    payload["isGradable"] = False
    payload["specialPayload"] = {
        "dataMissing": True,
        "missingAssetPaths": missing_asset_paths,
    }
    payload["tags"] = ["data-missing"]
    payload.pop("assets", None)
    for option in payload["options"]:
        if isinstance(option, dict):
            option.pop("assets", None)
    return payload


def _extract_answer_keys(
    qtype: int | None,
    raw_answer: Any,
    options_payload: list[dict[str, Any]],
    qid: int | None,
) -> list[str]:
    """从 fenbi answer.choice 抽出 standard answerKeys (字母 list 或填空文本 list).

    P1 review fix Phase A.1: 从 `_build_question_payload` 提取的 type-branch SRP.
    Pure function, 测试容易.
    """
    if qtype == 5:
        # 填空 / 数字答案 — answer.choice 是答案文本; FillBlankRenderer 用 normalize
        # 后严格相等判分 (见 services.exam_support.is_answer_correct).
        if raw_answer is None:
            raise ValueError(f"question {qid} type=5 missing answer.choice")
        answer_text = str(raw_answer).strip()
        if not answer_text:
            raise ValueError(f"question {qid} type=5 has empty answer.choice")
        return [answer_text]

    if not options_payload:
        # type=2/3 但没 options → 数据异常 (上游 fenbi 抓取漏了选项).
        raise ValueError(f"question {qid} type={qtype} has no options")
    indices = _decode_answer_indices(raw_answer, qid)
    if not indices:
        raise ValueError(f"question {qid} has empty answer indices")
    for i in indices:
        if i >= len(options_payload):
            raise ValueError(
                f"question {qid} answer index {i} out of range ({len(options_payload)} options)"
            )
    answer_keys = [_CHOICE_LETTERS[i] for i in indices]
    if qtype == 1 and len(answer_keys) != 1:
        raise ValueError(f"question {qid} type=1 (single) has multi answer {answer_keys}")
    return answer_keys


def _build_canonical_taxonomy(chapter_name: str, qtype: int | None) -> dict[str, Any]:
    """fenbi chapter → canonical taxonomy mapping. Pure function."""
    return {
        "canonicalTopType": _CHAPTER_CANONICAL_TOP.get(chapter_name, chapter_name),
        "canonicalSubtype": chapter_name,
        "rawRenderType": f"fenbi-type-{qtype}",
        "mappingSource": "fenbi",
    }


def _build_options(
    options_raw: list[dict[str, Any]], rewrite_map: dict[str, str]
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    out: list[dict[str, Any]] = []
    all_option_assets: list[dict[str, str]] = []
    for opt in options_raw:
        key = str(opt.get("label") or "").strip().upper()
        text_html = _rewrite_html(str(opt.get("html") or opt.get("text") or "").strip(), rewrite_map)
        opt_assets = _resolve_assets(opt.get("images") or [], rewrite_map, role=f"option:{key}")
        entry: dict[str, Any] = {"key": key, "text": text_html}
        if opt_assets:
            entry["assets"] = opt_assets
            all_option_assets.extend(opt_assets)
        out.append(entry)
    return out, all_option_assets


def _parse_answer_index(answer: dict[str, Any]) -> int | None:
    """Fenbi answer.choice 是 0-indexed 字符串 ("0"=A, "1"=B, "2"=C, "3"=D)。"""
    raw = answer.get("choice")
    if raw is None or raw == "":
        return None
    try:
        return int(str(raw).strip())
    except ValueError:
        return None


def _build_material_group_block(
    *,
    mat_indexes: tuple[int, ...],
    materials: list[dict[str, Any]],
    chapter_name: str,
    rewrite_map: dict[str, str],
    occurrence: int = 1,
) -> dict[str, Any]:
    referenced = [materials[i] for i in mat_indexes if 0 <= i < len(materials)]
    material_id_str = "-".join(str(m.get("id") or i) for i, m in zip(mat_indexes, referenced, strict=False))
    # occurrence 后缀：同一 material 被 chapter 内多个非连续 block 引用时确保 uuid 唯一
    if occurrence > 1:
        material_id_str = f"{material_id_str}-occ{occurrence}"
    # 多个材料合并为同一段（粉笔多材料的情况罕见，sample paper 都是 1:1）
    material_html = "\n".join(_rewrite_html(str(m.get("html") or ""), rewrite_map) for m in referenced)
    material_text = "\n".join(str(m.get("text") or "") for m in referenced)
    material_assets: list[dict[str, str]] = []
    for m in referenced:
        material_assets.extend(_resolve_assets(m.get("images") or [], rewrite_map, role="material"))

    group_kind = _CHAPTER_GROUP_KIND.get(chapter_name, _DEFAULT_GROUP_KIND)
    block: dict[str, Any] = {
        "type": "material_group",
        "groupKind": group_kind,
        "sourceGroupUuid": f"fenbi-material-{material_id_str}",
        "title": f"{chapter_name}·材料",
        "materialText": material_text,
        "instructionText": "",
        "payload": {"materialHtml": material_html},
        "questions": [],
    }
    if material_assets:
        block["assets"] = material_assets
    return block


_YEAR_TIYU_RE = re.compile(r"(20\d{2})年[^\d]*?(?:真题|试题|题)")


def _extract_year(value: Any) -> int | None:
    if not value:
        return None
    text = str(value)
    # 优先匹配"YYYY年...真题/试题/题"，避免 paper.name "2026年大纲（含2025真题）" 取到 2026
    match = _YEAR_TIYU_RE.search(text)
    if match:
        return int(match.group(1))
    fallback = re.search(r"(20\d{2})", text)
    return int(fallback.group(1)) if fallback else None


def _infer_source_kind(paper_name: str) -> str:
    if "网友回忆版" in paper_name:
        return "网友回忆版"
    if "真题" in paper_name:
        return "真题"
    if "模拟" in paper_name:
        return "模拟"
    return "未知"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Convert Fenbi paper directory to standard JSON")
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Fenbi paper directory (containing paper.json + assets/)",
    )
    parser.add_argument("--output", required=True, type=Path, help="Output directory for standard JSON + assets")
    parser.add_argument(
        "--no-copy-assets",
        action="store_true",
        help="Skip copying assets/ (assume caller will set base_dir to input dir)",
    )
    parser.add_argument("--paper-code-prefix", default="FENBI-")
    args = parser.parse_args(argv)

    out = convert_paper(
        args.input,
        args.output,
        paper_code_prefix=args.paper_code_prefix,
        copy_assets=not args.no_copy_assets,
    )
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
