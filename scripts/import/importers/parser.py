from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class RawPaperRecord:
    source_path: Path
    paper_code: str
    title: str
    subject_kind: str
    questions: list[dict[str, Any]]


def load_raw_papers(input_path: Path) -> list[RawPaperRecord]:
    source = input_path.expanduser().resolve()
    if source.is_dir():
        papers: list[RawPaperRecord] = []
        for child in sorted(source.iterdir()):
            if child.suffix.lower() == ".json":
                papers.extend(_load_json_file(child))
            elif child.suffix.lower() == ".csv":
                papers.extend(_load_csv_file(child))
        if not papers:
            raise FileNotFoundError(f"no JSON/CSV inputs found under {source}")
        return papers
    if source.suffix.lower() == ".json":
        return _load_json_file(source)
    if source.suffix.lower() == ".csv":
        return _load_csv_file(source)
    raise ValueError(f"unsupported input format: {source.suffix or source.name}")


def _load_json_file(path: Path) -> list[RawPaperRecord]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        payloads = [payload]
    elif isinstance(payload, list):
        payloads = payload
    else:
        raise ValueError(f"{path}: top-level JSON must be an object or list")

    records: list[RawPaperRecord] = []
    for index, item in enumerate(payloads, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"{path}: paper item #{index} must be an object")
        records.append(_build_raw_paper(path, item))
    return records


def _load_csv_file(path: Path) -> list[RawPaperRecord]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError(f"{path}: CSV has no rows")

    grouped: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in rows:
        normalized = {key: value for key, value in row.items() if key is not None}
        paper_code = _required_text(normalized, "paper_code", path)
        title = _required_text(normalized, "title", path)
        subject_kind = _required_text(normalized, "subject_kind", path)
        grouped.setdefault((paper_code, title, subject_kind), []).append(normalized)

    return [
        RawPaperRecord(
            source_path=path,
            paper_code=paper_code,
            title=title,
            subject_kind=subject_kind,
            questions=questions,
        )
        for (paper_code, title, subject_kind), questions in grouped.items()
    ]


def _build_raw_paper(path: Path, item: dict[str, Any]) -> RawPaperRecord:
    paper_code = _required_text(item, "paper_code", path)
    title = _required_text(item, "title", path)
    subject_kind = _required_text(item, "subject_kind", path)
    questions = item.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError(f"{path}: paper {paper_code} must contain a non-empty questions list")
    normalized_questions: list[dict[str, Any]] = []
    for index, question in enumerate(questions, start=1):
        if not isinstance(question, dict):
            raise ValueError(f"{path}: question #{index} in {paper_code} must be an object")
        normalized_questions.append(question)
    return RawPaperRecord(
        source_path=path,
        paper_code=paper_code,
        title=title,
        subject_kind=subject_kind,
        questions=normalized_questions,
    )


def _required_text(payload: dict[str, Any], key: str, path: Path) -> str:
    raw = payload.get(key)
    value = str(raw or "").strip()
    if not value:
        raise ValueError(f"{path}: missing required field {key!r}")
    return value
