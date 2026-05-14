"""Phase 5.4c — 给 Question.subject 列补数据。

用途：0002 migration 后 Question.subject 新增为可空列，首次 upgrade 全部为 NULL。
本脚本按推断规则批量填值，供错题本 / 数据面板按科目聚合使用。

推断规则（按优先级，首个命中即停）：
    1. canonical_top_type ∈ {"言语理解","数量关系","判断推理","资料分析","常识判断"}
       → 直接用 canonical_top_type 作 subject（行测五模块本身就是独立科目）
    2. canonical_top_type == "申论" 或 question_kind 含 "申论"
       → "申论"
    3. source_kind 含 "公共基础" → "公共基础知识"
    4. 其他 → 保持 NULL（留待后续规则演进或人工补齐）

用法：
    python -m sikao_api.scripts.backfill_question_subject --dry-run
    python -m sikao_api.scripts.backfill_question_subject --apply
    python -m sikao_api.scripts.backfill_question_subject --apply --force  # 覆盖已有 subject

幂等：默认只填 NULL；`--force` 覆盖已有值（用于规则更新后重跑）。事务分批
commit（BATCH_SIZE=500）避免长事务。
"""

from __future__ import annotations

import argparse
from collections import Counter

from sqlalchemy import select

from sikao_api.core.config import get_settings
from sikao_api.db.session import DatabaseManager
from sikao_api.db.models import Question

XINGCE_MODULES = frozenset(
    ["言语理解", "数量关系", "判断推理", "资料分析", "常识判断"]
)
SHENLUN_KEYWORDS = ("申论",)
GONGJI_KEYWORDS = ("公共基础",)
BATCH_SIZE = 500

# v0.2 follow-up: fenbi paper 的 chapter 名是 sub-topic 级别（"政治理论" 是
# 常识判断的子分类, "科学推理" / "逻辑判断" / "图形推理" 是判断推理的子题型）.
# 这些 chapter 名经 `fenbi_to_standard._CHAPTER_CANONICAL_TOP` 映射后保留原名,
# 落到 Question.canonical_top_type 后, 不在 XINGCE_MODULES 5 大模块里, 老的
# infer_subject 直接 NULL → aggregation 看不到这些题. 加这层 sub-topic 映射兜底.
#
# 数据依据：本地 fenbi-mirror 240 套全量统计 chapters, 出现 ≥2 次的 sub-topic
# 都覆盖. 单次出现 (≤1 paper) 的边缘 chapter 保持回退 NULL —— 数据稀疏不值得猜.
SUBTOPIC_TO_SUBJECT = {
    # 政治理论是常识判断的核心子内容（行测大纲）
    "政治理论": "常识判断",
    # 推理类（多见于事业单位 / 选调）
    "科学推理": "判断推理",
    "类比推理": "判断推理",
    "图形推理": "判断推理",
    "逻辑判断": "判断推理",
    "综合分析能力": "判断推理",
    # 数量系
    "数学运算": "数量关系",
    "数理能力": "数量关系",
    # 常识系
    "常识应用能力": "常识判断",
    "综合知识": "常识判断",
    # 言语系
    "言语理解与表达能力": "言语理解",
    # 判断推理 alias
    "判断推理能力": "判断推理",
}


def infer_subject(question: Question) -> str | None:
    """纯函数：从 question 各字段推断 subject。不访问 session。"""
    top = (question.canonical_top_type or "").strip()
    if top in XINGCE_MODULES:
        return top
    # sub-topic 映射兜底（fenbi chapter 名直接落到 canonical_top_type 时常见）
    if top in SUBTOPIC_TO_SUBJECT:
        return SUBTOPIC_TO_SUBJECT[top]

    kind = (question.question_kind or "").strip()
    if top == "申论" or any(k in kind for k in SHENLUN_KEYWORDS):
        return "申论"

    source_kind = (question.source_kind or "").strip()
    if any(k in source_kind for k in GONGJI_KEYWORDS):
        return "公共基础知识"

    return None


def run(*, dry_run: bool, force: bool) -> int:
    settings = get_settings()
    db = DatabaseManager(settings)
    if settings.is_sqlite:
        db.create_all()
    session = db.session_factory()

    stmt = select(Question)
    if not force:
        stmt = stmt.where(Question.subject.is_(None))

    total = 0
    filled = 0
    skipped_null = 0
    batch_dirty = 0
    distribution: Counter[str] = Counter()

    try:
        for question in session.scalars(stmt).yield_per(BATCH_SIZE):
            total += 1
            inferred = infer_subject(question)
            if inferred is None:
                skipped_null += 1
                distribution["(未分类)"] += 1
                continue
            distribution[inferred] += 1
            if question.subject == inferred:
                # 幂等：值一样不算 dirty。
                filled += 1
                continue
            if not dry_run:
                question.subject = inferred
                batch_dirty += 1
            filled += 1
            if batch_dirty >= BATCH_SIZE:
                session.commit()
                batch_dirty = 0

        if not dry_run and batch_dirty > 0:
            session.commit()
    finally:
        session.close()

    mode = "DRY-RUN" if dry_run else "APPLY"
    print(f"[{mode}] scanned={total} filled={filled} null_remain={skipped_null}")
    print("subject distribution:")
    for subject, count in distribution.most_common():
        pct = (count / total * 100) if total > 0 else 0
        print(f"  {subject:<14} {count:>6}  ({pct:5.1f}%)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="backfill_question_subject",
        description="Backfill Question.subject from canonical_top_type / source_kind.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="只统计不写入")
    group.add_argument("--apply", action="store_true", help="真实写入")
    parser.add_argument(
        "--force", action="store_true", help="覆盖已有 subject（默认只填 NULL）"
    )
    args = parser.parse_args()
    return run(dry_run=args.dry_run, force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
