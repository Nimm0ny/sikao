"""Convert Fenbi Shenlun raw JSON into standard import JSON.

The source layout is the local Fenbi Shenlun crawl:

    manifest.csv
    raw_json/papers/<paperId>/paper.json
    raw_json/papers/<paperId>/questions.json

The adapter writes one standard JSON paper per unique Fenbi paperId and a
classification manifest preserving every region-paper row from Fenbi.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

DEFAULT_SOURCE_ROOT = Path(r"C:\Users\clown\Downloads\data")
DEFAULT_OUTPUT_ROOT = Path("data/import/fenbi_shenlun_2013_2026")
DEFAULT_YEAR_START = 2013
DEFAULT_YEAR_END = 2026

_RE_YEAR = re.compile(r"(20[1-2]\d)")
_RE_VARIANT = re.compile(r"[\uFF08(]([^\uFF09)]+)[\uFF09)]")
_RE_SPACES = re.compile(r"[ \t]+")
_RE_BLANK_LINES = re.compile(r"\n{3,}")
_RE_SCORE = re.compile(r"(\d+(?:\.\d+)?)\s*\u5206")
_RE_WORD_RANGE = re.compile(r"(\d{2,4})\s*[-\u2014~\uFF5E\u81F3\u5230]\s*(\d{2,4})\s*\u5B57")
_RE_MAX_WORDS = re.compile(
    r"(?:\u4E0D\u8D85\u8FC7|\u4E0D\u591A\u4E8E|\u4E0D\u5F97\u8D85\u8FC7|\u63A7\u5236\u5728|"
    r"\u9650)\s*(\d{2,4})\s*\u5B57"
)
_RE_MIN_WORDS = re.compile(r"(?:\u4E0D\u5C11\u4E8E|\u4E0D\u4F4E\u4E8E)\s*(\d{2,4})\s*\u5B57")
_RE_REQUIREMENT_SPLIT = re.compile(r"\u8981\u6C42[:\uFF1A]")
_RE_COUNTERMEASURE = re.compile(
    r"(?:\u63D0\u51FA|\u62DF\u51FA|\u5217\u51FA|\u8BBE\u8BA1|\u5236\u5B9A).{0,35}"
    r"(?:\u5EFA\u8BAE|\u5BF9\u7B56|\u63AA\u65BD|\u601D\u8DEF|\u529E\u6CD5|\u89E3\u51B3\u4E4B\u9053|"
    r"\u5DE5\u4F5C\u91CD\u70B9)"
)
_RE_COUNTERMEASURE_CONTEXT = re.compile(
    r"(?:\u9488\u5BF9|反映|存在|面临).{0,50}(?:\u95EE\u9898|\u56F0\u96BE|\u56F0\u5883|"
    r"\u4E71\u8C61).{0,50}(?:\u5EFA\u8BAE|\u5BF9\u7B56|\u63AA\u65BD|\u5E94\u6709\u4F55\u4F5C\u4E3A)"
)

_ARTICLE_KEYWORDS = (
    "\u6587\u7AE0",
    "\u8BAE\u8BBA\u6587",
    "\u5927\u4F5C\u6587",
    "\u81EA\u62DF\u9898\u76EE",
    "\u81EA\u9009\u89D2\u5EA6",
)
_DOCUMENT_KEYWORDS = (
    "\u7B80\u62A5",
    "\u8BB2\u8BDD\u7A3F",
    "\u53D1\u8A00\u7A3F",
    "\u5021\u8BAE\u4E66",
    "\u516C\u5F00\u4FE1",
    "\u5BA3\u4F20\u7A3F",
    "\u5BA3\u4F20\u6750\u6599",
    "\u77ED\u8BC4",
    "\u8BC4\u8BBA",
    "\u62A5\u9053",
    "\u8C03\u7814\u62A5\u544A",
    "\u5EFA\u8BAE\u4E66",
    "\u5DE5\u4F5C\u65B9\u6848",
    "\u63D0\u7EB2",
    "\u5BFC\u8A00",
    "\u7F16\u8005\u6309",
    "\u901A\u544A",
    "\u901A\u77E5",
    "\u56DE\u5E94",
    "\u6307\u5357",
    "\u5E7F\u64AD\u7A3F",
    "\u611F\u8C22\u4FE1",
    "\u9080\u8BF7\u4FE1",
    "\u63D0\u6848",
    "\u63D0\u6848\u6848\u7531",
    "\u653F\u52A1\u4FE1\u606F",
    "\u8003\u5BDF\u62A5\u544A",
    "\u8C03\u7814\u65B9\u6848",
    "\u5185\u5BB9\u7EB2\u8981",
    "\u62A5\u544A\u7684\u5185\u5BB9\u8981\u70B9",
    "\u8BB2\u89E3\u7A3F",
    "\u793A\u8303\u6027\u7684\u8BB2\u89E3\u7A3F",
    "\u60C5\u51B5\u4ECB\u7ECD",
    "\u6848\u4F8B\u6458\u8981",
    "\u8206\u60C5\u6458\u8981",
    "\u7B80\u77ED\u7684\u53D1\u8A00",
    "\u4F60\u4F1A\u8BF4\u4E9B\u4EC0\u4E48",
    "\u8BF4\u4E9B\u4EC0\u4E48",
    "\u5199\u4E0B\u6765",
    "\u7B80\u8BAF",
    "\u901A\u62A5",
    "\u77ED\u6587",
    "\u7EA6\u7A3F",
    "\u5DE5\u4F5C\u53C2\u8003\u5EFA\u8BAE",
    "\u6574\u6539\u610F\u89C1",
    "\u6587\u7A3F",
    "\u7A3F",
    "\u56DE\u4FE1",
    "\u4E3B\u6301\u8BCD",
    "\u65B0\u95FB\u7A3F",
    "\u6848\u4F8B\u4ECB\u7ECD\u6750\u6599",
    "\u4ECB\u7ECD\u6750\u6599",
    "\u5BA3\u4F20\u5355",
    "\u6D88\u8D39\u7EF4\u6743\u60C5\u51B5\u53CD\u6620",
    "\u60C5\u51B5\u53CD\u6620",
    "\u5DE5\u4F5C\u4FE1\u606F",
    "\u6574\u6539\u65B9\u6848",
    "\u5DE5\u4F5C\u8981\u70B9",
    "\u6C47\u62A5\u6750\u6599",
    "\u62DB\u8058\u542F\u4E8B",
    "\u5F81\u96C6\u542F\u4E8B",
    "\u544A\u77E5\u4E66",
    "\u60C5\u51B5\u62A5\u544A",
    "\u60C5\u51B5\u6C47\u62A5",
    "\u5DE5\u4F5C\u60C5\u51B5\u6C47\u62A5",
    "\u63A8\u8350\u6750\u6599",
    "\u7533\u62A5\u6750\u6599",
    "\u53C2\u8BC4\u6750\u6599",
    "\u63A8\u4ECB\u7A3F",
    "\u4E00\u5C01\u4FE1",
    "\u81F4\u5168\u7403\u6295\u8D44\u8005",
    "\u5EFA\u8BBE\u6D41\u7A0B",
    "\u62DF\u5B9A\u4E00\u4EFD",
    "\u62DF\u5199\u4E00\u4EFD",
    "\u8349\u62DF\u4E00\u4EFD",
    "\u64B0\u5199\u4E00\u4EFD",
    "\u8D77\u8349\u4E00\u4EFD",
)
_COUNTERMEASURE_KEYWORDS = (
    "\u63D0\u51FA\u5EFA\u8BAE",
    "\u63D0\u51FA\u5BF9\u7B56",
    "\u5DE5\u4F5C\u5EFA\u8BAE",
    "\u89E3\u51B3\u63AA\u65BD",
    "\u89E3\u51B3\u529E\u6CD5",
    "\u6539\u8FDB\u63AA\u65BD",
    "\u5177\u4F53\u63AA\u65BD",
    "\u6276\u6301\u63AA\u65BD",
    "\u6574\u6CBB",
    "\u89E3\u51B3\u5EFA\u8BAE",
    "\u521D\u6B65\u5EFA\u8BAE",
    "\u610F\u89C1\u5EFA\u8BAE",
    "\u5BF9\u7B56\u5EFA\u8BAE",
    "\u76F8\u5E94\u7684\u5EFA\u8BAE",
    "\u63D0\u51FA\u4F60\u7684\u5EFA\u8BAE",
    "\u63D0\u51FA\u4F60\u7684\u5BF9\u7B56",
    "\u63A8\u8FDB",
    "\u4E3B\u8981\u601D\u8DEF",
    "\u5DE5\u4F5C\u601D\u8DEF",
    "\u63D0\u5347",
    "\u6539\u8FDB\u5DE5\u4F5C",
    "\u4E3B\u8981\u4EFB\u52A1\u53CA\u63AA\u65BD",
    "\u4EFB\u52A1\u53CA\u63AA\u65BD",
    "\u63D0\u6848\u6848\u7531",
    "\u63D0\u6848",
    "\u732E\u7B56",
    "\u5E94\u6709\u4F55\u4F5C\u4E3A",
)
_ANALYSIS_KEYWORDS = (
    "\u8C08\u8C08\u7406\u89E3",
    "\u4F60\u7684\u7406\u89E3",
    "\u5982\u4F55\u7406\u89E3",
    "\u7406\u89E3",
    "\u5206\u6790",
    "\u8BC4\u4EF7",
    "\u542F\u793A",
    "\u8BA4\u8BC6",
    "\u770B\u6CD5",
    "\u4E3A\u4EC0\u4E48",
    "\u539F\u56E0",
    "\u610F\u4E49",
    "\u89E3\u91CA",
    "\u5168\u9762\u89E3\u91CA",
    "\u542F\u53D1",
    "\u5256\u6790",
    "\u76EE\u7684",
    "\u5FC5\u8981\u6027",
    "\u4E3A\u4F55",
    "\u4E3A\u4EC0\u4E48",
    "\u89C2\u70B9\u548C\u7406\u7531",
    "\u7406\u7531",
    "\u8BBA\u636E",
    "\u8BBA\u8FF0",
    "\u4E2A\u6027\u7279\u5F81\u548C\u5171\u6027\u7279\u5F81",
    "\u7279\u5F81\u548C\u5171\u6027\u7279\u5F81",
    "\u4EF7\u503C\u529F\u80FD",
    "\u542B\u4E49",
    "\u610F\u601D",
    "\u805A\u7126\u70B9",
    "\u8BC4\u6790",
    "\u52A0\u4EE5\u8BC4\u6790",
    "\u8FDB\u884C\u8BC4\u6790",
    "\u89C1\u89E3",
    "\u8BF7\u56DE\u7B54",
    "\u56DE\u7B54\u4E0B\u5217\u95EE\u9898",
    "\u8FD9\u4E24\u79CD\u65B9\u5F0F\u5206\u522B\u662F\u4EC0\u4E48",
    "\u5206\u522B\u662F\u4EC0\u4E48",
    "\u805A\u96C6\u70B9",
    "\u4F55\u4E3A",
    "\u4E8C\u8005\u662F\u4F55\u5173\u7CFB",
    "\u662F\u4F55\u5173\u7CFB",
    "\u4E4B\u95F4\u7684\u5173\u7CFB",
    "\u4EC0\u4E48\u8BA9",
    "\u5B66\u5230\u4EC0\u4E48",
    "\u80CC\u540E\u7684\u903B\u8F91",
)
_SUMMARY_KEYWORDS = (
    "\u6982\u62EC",
    "\u5F52\u7EB3",
    "\u603B\u7ED3",
    "\u68B3\u7406",
    "\u4E3B\u8981\u5185\u5BB9",
    "\u4E3B\u8981\u95EE\u9898",
    "\u4E3B\u8981\u505A\u6CD5",
    "\u5177\u4F53\u5E94\u7528",
    "\u4E3E\u63AA",
    "\u4F5C\u7528",
    "\u7ECF\u9A8C",
    "\u7279\u70B9",
    "\u63D0\u70BC",
    "\u5185\u6DB5",
    "\u6982\u8FF0",
    "\u53D8\u5316",
    "\u4EAE\u70B9",
    "\u5BC6\u7801",
    "\u7B80\u8981\u4ECB\u7ECD",
    "\u8FDB\u884C\u7B80\u8981\u4ECB\u7ECD",
    "\u505A\u6CD5\u548C\u63A8\u8350\u7406\u7531",
    "\u201C\u559C\u201D\u548C\u201C\u76FC\u201D",
    "\u201C\u559C\u201D\u548C\u201C\u76FC\u201D",
    "\u559C\u548C\u76FC",
    "\u5206\u522B\u8C08\u8C08",
    "\u7B80\u8FF0",
    "\u7B80\u8981\u56DE\u7B54",
    "\u6807\u9898",
    "\u5C0F\u6807\u9898",
    "\u62DF\u6807\u9898",
    "\u586B\u5165",
    "\u9898\u76EE\u548C",
    "\u95EE\u9898\u6E05\u5355",
    "\u5B58\u5728\u7684\u95EE\u9898",
    "\u5E94\u5F53\u6CE8\u610F\u7684\u95EE\u9898",
    "\u9700\u91CD\u70B9\u5173\u6CE8\u7684\u95EE\u9898",
    "\u57FA\u672C\u6D41\u7A0B",
    "\u57FA\u672C\u6D41\u7A0B\u548C\u8981\u6C42",
    "\u5171\u540C\u70B9",
    "\u4FA7\u91CD\u70B9",
    "\u51A0\u540D",
    "\u505A\u6CD5",
    "\u80CC\u666F",
    "\u7279\u5F81",
    "\u4E3B\u8981\u7279\u5F81",
    "\u79EF\u6781\u5F71\u54CD",
    "\u524D\u671F\u51C6\u5907\u5DE5\u4F5C",
    "\u5DE5\u4F5C\u91CD\u70B9",
    "\u91CD\u70B9\u5DE5\u4F5C",
    "\u9632\u53F0\u98CE\u5DE5\u4F5C\u7684\u91CD\u70B9",
    "\u5404\u586B\u4E00\u53E5\u8BDD",
    "\u7ED3\u8BBA\u8BED\u4E49\u8FDE\u8D2F\u5B8C\u6574",
    "\u54EA\u51E0\u65B9\u9762\u7684\u5185\u5BB9",
    "\u54EA\u4E9B",
    "\u5982\u4F55",
    "\u600E\u6837",
    "\u600E\u4E48",
)

_REGION_SLUGS = {
    "\u56FD\u8003": "GK",
    "\u5317\u4EAC": "BJ",
    "\u5929\u6D25": "TJ",
    "\u4E0A\u6D77": "SH",
    "\u91CD\u5E86": "CQ",
    "\u6CB3\u5317": "HEB",
    "\u5C71\u897F": "SX",
    "\u5185\u8499\u53E4": "NMG",
    "\u8FBD\u5B81": "LN",
    "\u5409\u6797": "JL",
    "\u9ED1\u9F99\u6C5F": "HLJ",
    "\u6C5F\u82CF": "JS",
    "\u6D59\u6C5F": "ZJ",
    "\u5B89\u5FBD": "AH",
    "\u798F\u5EFA": "FJ",
    "\u6C5F\u897F": "JX",
    "\u5C71\u4E1C": "SD",
    "\u6CB3\u5357": "HEN",
    "\u6E56\u5317": "HUB",
    "\u6E56\u5357": "HUN",
    "\u5E7F\u4E1C": "GD",
    "\u5E7F\u897F": "GX",
    "\u6D77\u5357": "HAIN",
    "\u56DB\u5DDD": "SC",
    "\u8D35\u5DDE": "GZ",
    "\u4E91\u5357": "YN",
    "\u9655\u897F": "SNX",
    "\u7518\u8083": "GS",
    "\u9752\u6D77": "QH",
    "\u5B81\u590F": "NX",
    "\u65B0\u7586": "XJ",
    "\u65B0\u7586\u5175\u56E2": "XJBT",
    "\u5E7F\u5DDE": "GZC",
    "\u6DF1\u5733": "SZ",
}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"p", "br", "div", "li", "tr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"p", "div", "li", "tr"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        value = html.unescape("".join(self.parts))
        value = value.replace("\u00A0", " ")
        value = _RE_SPACES.sub(" ", value)
        value = "\n".join(line.strip() for line in value.splitlines() if line.strip())
        value = _RE_BLANK_LINES.sub("\n\n", value).strip()
        return value


@dataclass(frozen=True)
class FenbiRow:
    label_id: str
    label_name: str
    paper_id: str
    combine_key: str
    name: str
    year: int
    date: str
    topic: str
    url: str


@dataclass(frozen=True)
class ConversionSummary:
    total_manifest_rows: int
    unique_papers: int
    converted_papers: int
    failed_papers: int
    output_root: Path


def html_to_text(raw_html: str | None) -> str:
    parser = _TextExtractor()
    parser.feed(raw_html or "")
    parser.close()
    return parser.text()


def find_fenbi_source_root(root: Path = DEFAULT_SOURCE_ROOT) -> Path:
    if (root / "manifest.csv").is_file() and (root / "raw_json").is_dir():
        return root
    candidates = sorted(root.glob("fenbi_shenlun_*"))
    for candidate in candidates:
        if (candidate / "manifest.csv").is_file() and (candidate / "raw_json").is_dir():
            return candidate
    raise FileNotFoundError(f"Fenbi Shenlun source root not found under {root}")


def load_manifest_rows(source_root: Path, *, year_start: int, year_end: int) -> list[FenbiRow]:
    rows: list[FenbiRow] = []
    with (source_root / "manifest.csv").open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            year = _to_int(row.get("year"))
            if year is None or year < year_start or year > year_end:
                continue
            rows.append(
                FenbiRow(
                    label_id=str(row.get("labelId") or "").strip(),
                    label_name=str(row.get("labelName") or "").strip(),
                    paper_id=str(row.get("paperId") or "").strip(),
                    combine_key=str(row.get("combineKey") or "").strip(),
                    name=str(row.get("name") or "").strip(),
                    year=year,
                    date=str(row.get("date") or "").strip(),
                    topic=str(row.get("topic") or "").strip(),
                    url=str(row.get("url") or "").strip(),
                )
            )
    return [row for row in rows if row.paper_id]


def convert_source_tree(
    *,
    source_root: Path,
    output_root: Path,
    year_start: int = DEFAULT_YEAR_START,
    year_end: int = DEFAULT_YEAR_END,
    limit: int | None = None,
) -> ConversionSummary:
    rows = load_manifest_rows(source_root, year_start=year_start, year_end=year_end)
    grouped = _group_by_paper_id(rows)
    paper_ids = sorted(grouped, key=lambda pid: (_primary_row(grouped[pid]).year, _primary_row(grouped[pid]).name, pid))
    if limit is not None:
        paper_ids = paper_ids[:limit]

    standard_dir = output_root / "standard_json"
    standard_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    for index, paper_id in enumerate(paper_ids, start=1):
        paper_rows = grouped[paper_id]
        try:
            payload, record = convert_paper_id(
                source_root=source_root,
                paper_id=paper_id,
                rows=paper_rows,
                sort_index=index,
            )
        except Exception as exc:
            failures.append({"paperId": paper_id, "error": str(exc)})
            continue
        output_path = standard_dir / f"{payload['paperCode']}.standard.json"
        _write_json_atomic(output_path, payload)
        record["standardJson"] = str(output_path.relative_to(output_root).as_posix())
        records.append(record)

    _write_manifest_files(
        output_root=output_root,
        source_root=source_root,
        rows=rows,
        records=records,
        failures=failures,
        year_start=year_start,
        year_end=year_end,
    )
    return ConversionSummary(
        total_manifest_rows=len(rows),
        unique_papers=len(grouped),
        converted_papers=len(records),
        failed_papers=len(failures),
        output_root=output_root,
    )


def convert_paper_id(
    *,
    source_root: Path,
    paper_id: str,
    rows: list[FenbiRow],
    sort_index: int = 1,
) -> tuple[dict[str, Any], dict[str, Any]]:
    raw_dir = source_root / "raw_json" / "papers" / paper_id
    paper_meta = _read_json(raw_dir / "paper.json")
    questions_payload = _read_json(raw_dir / "questions.json")
    primary = _primary_row(rows)
    paper_name = str(paper_meta.get("name") or primary.name).strip()
    year = _to_int(paper_meta.get("year")) or primary.year or _infer_year(paper_name) or 0
    regions = sorted({row.label_name for row in rows if row.label_name})
    exam_scope = classify_exam_scope(primary.label_name, paper_name)
    variant = classify_variant(paper_name)
    source_kind = "\u56FD\u8003\u771F\u9898" if exam_scope == "\u56FD\u8003" else "\u7701\u8003\u771F\u9898"
    materials = [
        _compose_material_text(item, i)
        for i, item in enumerate(questions_payload.get("materials") or [], start=1)
    ]
    blocks = [
        _compose_question_block(
            raw_question=raw_question,
            paper_id=paper_id,
            question_no=index,
            total_questions=len(questions_payload.get("questions") or []),
            all_materials=materials,
            year=year,
            source_kind=source_kind,
            regions=regions,
            variant=variant,
            exam_scope=exam_scope,
        )
        for index, raw_question in enumerate(questions_payload.get("questions") or [], start=1)
    ]
    if not materials:
        raise ValueError("no materials")
    if not blocks:
        raise ValueError("no questions")

    paper_code = f"FBSL-{paper_id}"
    combine_key = str(paper_meta.get("combineKey") or primary.combine_key)
    date_str = str(paper_meta.get("date") or primary.date)
    topic_str = str(paper_meta.get("topic") or primary.topic)
    payload = {
        "paperCode": paper_code,
        "paperName": paper_name,
        "examYear": year,
        "sourceProvider": "fenbi_shenlun",
        "sourceKind": source_kind,
        "sortOrder": year * 10000 + sort_index,
        "visibleInPublic": True,
        "sections": [
            {
                "key": "section-essay",
                "title": "\u7533\u8BBA",
                "instructionText": "\u6839\u636E\u7ED9\u5B9A\u8D44\u6599\u4F5C\u7B54",
                "blocks": blocks,
            }
        ],
        "fenbiMetadata": {
            "paperId": paper_id,
            "combineKey": combine_key,
            "date": date_str,
            "topic": topic_str,
            "regions": regions,
            "examScope": exam_scope,
            "variant": variant,
            "sourceUrl": primary.url,
        },
    }
    record = {
        "paperId": paper_id,
        "paperCode": paper_code,
        "paperName": paper_name,
        "year": year,
        "date": date_str,
        "topic": topic_str,
        "examScope": exam_scope,
        "regions": "|".join(regions),
        "primaryRegion": primary.label_name,
        "variant": variant,
        "sourceKind": source_kind,
        "questionCount": len(blocks),
        "materialCount": len(materials),
        "combineKey": combine_key,
        "sourceUrl": primary.url,
    }
    return payload, record


def classify_exam_scope(region: str, paper_name: str) -> str:
    if region == "\u56FD\u8003" or "\u56FD\u5BB6\u516C\u8003" in paper_name or "\u56FD\u8003" in paper_name:
        return "\u56FD\u8003"
    return "\u7701\u8003"


def classify_variant(paper_name: str) -> str:
    matches = [item.strip() for item in _RE_VARIANT.findall(paper_name) if item.strip()]
    if matches:
        return "/".join(matches)
    keywords = (
        "\u526F\u7701\u7EA7",
        "\u5730\u5E02\u7EA7",
        "\u884C\u653F\u6267\u6CD5",
        "\u7701\u5E02",
        "\u53BF\u4E61",
        "\u53BF\u7EA7",
        "\u4E61\u9547",
        "\u516C\u5B89",
        "A\u5377",
        "B\u5377",
        "C\u5377",
    )
    found = [item for item in keywords if item in paper_name]
    return "/".join(found) if found else "\u901A\u7528"


def classify_question(stem: str, *, question_no: int, total_questions: int, full_score: int | None) -> tuple[str, str]:
    text = stem.replace("\n", " ")
    task_text = _RE_REQUIREMENT_SPLIT.split(text, maxsplit=1)[0]
    if any(keyword in text for keyword in _DOCUMENT_KEYWORDS):
        return "\u516C\u6587/\u5E94\u7528\u6587", "\u516C\u6587/\u5E94\u7528\u6587"
    if _looks_like_article(text, question_no=question_no, total_questions=total_questions, full_score=full_score):
        return "\u5927\u4F5C\u6587", "\u5927\u4F5C\u6587"
    if (
        any(keyword in task_text for keyword in _COUNTERMEASURE_KEYWORDS)
        or _RE_COUNTERMEASURE.search(task_text)
        or _RE_COUNTERMEASURE_CONTEXT.search(task_text)
    ):
        return "\u63D0\u51FA\u5BF9\u7B56", "\u63D0\u51FA\u5BF9\u7B56"
    if any(keyword in task_text for keyword in _ANALYSIS_KEYWORDS):
        return "\u7EFC\u5408\u5206\u6790", "\u7EFC\u5408\u5206\u6790"
    if any(keyword in task_text for keyword in _SUMMARY_KEYWORDS):
        return "\u5F52\u7EB3\u6982\u62EC", "\u5F52\u7EB3\u6982\u62EC"
    return "\u5176\u4ED6", "\u5F85\u4EBA\u5DE5\u5206\u7C7B"


def suggested_minutes(*, subtype: str, full_score: int | None, word_limit_max: int | None) -> int:
    if subtype == "\u5927\u4F5C\u6587":
        return 60
    if full_score is not None:
        return max(10, min(60, int(round(full_score * 1.5))))
    if word_limit_max is not None:
        return max(10, min(60, int(round(word_limit_max / 15))))
    return 20


def _compose_material_text(item: dict[str, Any], index: int) -> str:
    body = html_to_text(str(item.get("content") or ""))
    return f"\u6750\u6599{index}\n{body}".strip()


def _compose_question_block(
    *,
    raw_question: dict[str, Any],
    paper_id: str,
    question_no: int,
    total_questions: int,
    all_materials: list[str],
    year: int,
    source_kind: str,
    regions: list[str],
    variant: str,
    exam_scope: str,
) -> dict[str, Any]:
    stem = html_to_text(str(raw_question.get("content") or ""))
    metadata = _extract_question_metadata(raw_question, stem)
    subtype, second_subtype = classify_question(
        stem,
        question_no=question_no,
        total_questions=total_questions,
        full_score=metadata["fullScore"],
    )
    type_payload: dict[str, Any] = {
        "materialTexts": list(all_materials),
        "suggestedMinutes": suggested_minutes(
            subtype=subtype,
            full_score=metadata["fullScore"],
            word_limit_max=metadata["wordLimitMax"],
        ),
        "fenbiQuestionId": raw_question.get("id"),
        "referencedMaterialIndexes": raw_question.get("materialIndexes") or [],
        "referencedMaterialIds": metadata["materialIds"],
    }
    for key in ("wordLimitMin", "wordLimitMax", "fullScore"):
        value = metadata[key]
        if value is not None:
            type_payload[key] = value

    source_uuid = f"fbsl-{paper_id}-q{raw_question.get('id') or question_no}"
    tags = [
        "\u7533\u8BBA",
        "\u771F\u9898",
        "\u7C89\u7B14",
        source_kind,
        exam_scope,
        str(year),
        subtype,
        variant,
        *regions,
    ]
    return {
        "type": "question",
        "sourceUuid": source_uuid,
        "questionKind": "essay",
        "subtypeName": subtype,
        "secondSubtypeName": second_subtype,
        "stemText": _wrap_paragraphs(stem),
        "answerKeys": [],
        "options": [],
        "explanationText": "",
        "difficultyCode": _difficulty_code(raw_question.get("difficulty")),
        "rendererKey": "essay",
        "isGradable": False,
        "typePayload": type_payload,
        "canonicalTaxonomy": {
            "canonicalTopType": "\u7533\u8BBA",
            "canonicalSubtype": subtype,
            "canonicalSecondSubtype": second_subtype,
            "rawRenderType": "essay",
            "mappingSource": "fenbi_shenlun_import_v1",
        },
        "tags": _dedupe(tags),
        "examYear": year,
        "sourceProvider": "fenbi_shenlun",
        "sourceKind": source_kind,
    }


def _extract_question_metadata(raw_question: dict[str, Any], stem: str) -> dict[str, Any]:
    accessory = _question_primary_accessory(raw_question)
    score = _to_score(accessory.get("score") if accessory else None) or _parse_score(stem)
    title = str(accessory.get("title") or "").strip() if accessory else ""
    word_min, word_max = _parse_word_limits(stem)
    if word_max is None and accessory:
        word_max = _to_int(accessory.get("wordCount"))
    material_ids = accessory.get("materialIndexes") if accessory else []
    if not isinstance(material_ids, list):
        material_ids = []
    return {
        "title": title,
        "fullScore": score,
        "wordLimitMin": word_min,
        "wordLimitMax": word_max,
        "materialIds": material_ids,
    }


def _question_primary_accessory(raw_question: dict[str, Any]) -> dict[str, Any] | None:
    for item in raw_question.get("accessories") or []:
        if isinstance(item, dict) and ("score" in item or "wordCount" in item or "title" in item):
            return item
    return None


def _parse_word_limits(text: str) -> tuple[int | None, int | None]:
    range_match = _RE_WORD_RANGE.search(text)
    if range_match:
        first, second = int(range_match.group(1)), int(range_match.group(2))
        return min(first, second), max(first, second)
    min_match = _RE_MIN_WORDS.search(text)
    max_match = _RE_MAX_WORDS.search(text)
    return (
        int(min_match.group(1)) if min_match else None,
        int(max_match.group(1)) if max_match else None,
    )


def _parse_score(text: str) -> int | None:
    match = _RE_SCORE.search(text)
    if not match:
        return None
    return _to_score(match.group(1))


def _looks_like_article(text: str, *, question_no: int, total_questions: int, full_score: int | None) -> bool:
    if any(keyword in text for keyword in _ARTICLE_KEYWORDS):
        if "\u77ED\u8BC4" in text or "\u8BC4\u8BBA" in text:
            return False
        return True
    return question_no == total_questions and full_score is not None and full_score >= 35


def _wrap_paragraphs(text: str) -> str:
    paragraphs = [line.strip() for line in text.splitlines() if line.strip()]
    return "".join(f"<p>{html.escape(line)}</p>" for line in paragraphs)


def _difficulty_code(raw: Any) -> str:
    value = _to_int(raw)
    if value is None:
        return "unknown"
    if value <= 2:
        return "easy"
    if value == 3:
        return "medium"
    if value >= 4:
        return "hard"
    return "unknown"


def _write_manifest_files(
    *,
    output_root: Path,
    source_root: Path,
    rows: list[FenbiRow],
    records: list[dict[str, Any]],
    failures: list[dict[str, str]],
    year_start: int,
    year_end: int,
) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    records_sorted = sorted(records, key=lambda item: (item["year"], item["paperName"], item["paperId"]))
    _write_csv(output_root / "classification.csv", records_sorted)
    _write_json_atomic(
        output_root / "classification.json",
        {
            "generatedAt": datetime.now(UTC).isoformat(),
            "sourceRoot": str(source_root),
            "yearStart": year_start,
            "yearEnd": year_end,
            "manifestRowCount": len(rows),
            "uniquePaperCount": len({row.paper_id for row in rows}),
            "convertedPaperCount": len(records),
            "failedPaperCount": len(failures),
            "records": records_sorted,
            "failures": failures,
        },
    )
    row_records = [
        {
            "paperId": row.paper_id,
            "labelId": row.label_id,
            "region": row.label_name,
            "year": row.year,
            "paperName": row.name,
            "combineKey": row.combine_key,
            "topic": row.topic,
            "date": row.date,
            "url": row.url,
        }
        for row in rows
    ]
    _write_csv(output_root / "region_paper_rows.csv", row_records)


def _write_csv(path: Path, records: list[dict[str, Any]]) -> None:
    if not records:
        path.write_text("", encoding="utf-8")
        return
    fieldnames: list[str] = []
    for record in records:
        for key in record:
            if key not in fieldnames:
                fieldnames.append(key)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    os.replace(tmp, path)


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _group_by_paper_id(rows: list[FenbiRow]) -> dict[str, list[FenbiRow]]:
    grouped: dict[str, list[FenbiRow]] = {}
    for row in rows:
        grouped.setdefault(row.paper_id, []).append(row)
    return grouped


def _primary_row(rows: list[FenbiRow]) -> FenbiRow:
    return sorted(rows, key=lambda row: (0 if row.label_name == "\u56FD\u8003" else 1, row.label_name, row.paper_id))[0]


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"JSON root must be object: {path}")
    return payload


def _to_int(raw: Any) -> int | None:
    if raw is None or raw == "":
        return None
    try:
        return int(float(str(raw).strip()))
    except (TypeError, ValueError):
        return None


def _to_score(raw: Any) -> int | None:
    value = _to_int(raw)
    if value is None:
        return None
    return value


def _infer_year(text: str) -> int | None:
    match = _RE_YEAR.search(text)
    return int(match.group(1)) if match else None


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=None)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--year-start", type=int, default=DEFAULT_YEAR_START)
    parser.add_argument("--year-end", type=int, default=DEFAULT_YEAR_END)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args(argv)

    source_root = find_fenbi_source_root(args.source_root or DEFAULT_SOURCE_ROOT)
    summary = convert_source_tree(
        source_root=source_root,
        output_root=args.output_root,
        year_start=args.year_start,
        year_end=args.year_end,
        limit=args.limit,
    )
    print(
        "Converted Fenbi Shenlun: "
        f"{summary.converted_papers}/{summary.unique_papers} unique papers, "
        f"{summary.total_manifest_rows} region-paper rows, "
        f"{summary.failed_papers} failed -> {summary.output_root}"
    )
    return 0 if summary.failed_papers == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
