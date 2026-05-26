from __future__ import annotations

import argparse

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from sikao_api.db.models import (
    MaterialGroup,
    Paper,
    PaperRevision,
    Question,
)
from sikao_api.db.models_v2 import (
    MaterialGroupAssetV2,
    MaterialGroupV2,
    PaperBlockV2,
    PaperRevisionV2,
    PaperSectionV2,
    PaperV2,
    QuestionAssetV2,
    QuestionOptionV2,
    QuestionV2,
)
from sikao_api.scripts.backfill_question_subject import infer_subject
from sikao_api.scripts.backfill_v2_common import (
    BackfillStats,
    add_common_args,
    commit_or_rollback,
    iter_with_limit,
    open_session,
)


def infer_paper_track(paper: Paper) -> str:
    if (
        paper.paper_code.startswith("FBSL-")
        or "申论" in (paper.source_kind or "")
        or "申论" in paper.paper_name
    ):
        return "essay"
    has_essay = any(
        infer_subject(question) == "申论" or "申论" in (question.question_kind or "")
        for revision in paper.revisions
        for question in revision.questions
    )
    return "essay" if has_essay else "xingce"


def build_question_content(question: Question) -> dict[str, object]:
    return {
        "answerText": question.answer_text,
        "explanationText": question.explanation_text,
        "difficultyCode": question.difficulty_code,
        "rendererKey": question.renderer_key,
        "typePayload": question.type_payload_json,
        "specialPayload": question.special_payload_json,
        "sourcePayload": question.source_payload_json,
        "canonicalTopType": question.canonical_top_type,
        "canonicalSubtype": question.canonical_subtype,
        "canonicalSecondSubtype": question.canonical_second_subtype,
    }


def run(*, database_url: str | None, dry_run: bool, limit: int | None) -> int:
    session, _db = open_session(database_url=database_url)
    stats = BackfillStats()
    try:
        papers = list(
            session.scalars(
                select(Paper)
                .options(
                    selectinload(Paper.revisions)
                    .selectinload(PaperRevision.sections),
                    selectinload(Paper.revisions)
                    .selectinload(PaperRevision.blocks),
                    selectinload(Paper.revisions)
                    .selectinload(PaperRevision.material_groups)
                    .selectinload(MaterialGroup.assets),
                    selectinload(Paper.revisions)
                    .selectinload(PaperRevision.questions)
                    .selectinload(Question.options),
                    selectinload(Paper.revisions)
                    .selectinload(PaperRevision.questions)
                    .selectinload(Question.assets),
                )
                .order_by(Paper.id.asc())
            )
        )

        for paper in iter_with_limit(papers, limit=limit):
            stats.scanned += 1
            paper_v2 = session.scalar(
                select(PaperV2).where(PaperV2.paper_code == paper.paper_code)
            )
            paper_track = infer_paper_track(paper)
            if paper_v2 is None:
                paper_v2 = PaperV2(
                    paper_code=paper.paper_code,
                    title=paper.paper_name,
                    subject_kind=paper_track,
                    created_at=paper.created_at,
                    updated_at=paper.updated_at,
                )
                session.add(paper_v2)
                session.flush()
                stats.inserted += 1
            else:
                paper_v2.title = paper.paper_name
                paper_v2.subject_kind = paper_track
                paper_v2.updated_at = paper.updated_at
                session.add(paper_v2)
                stats.updated += 1

            seen_revision_ids: set[int] = set()
            section_map: dict[int, int] = {}
            block_map: dict[int, int] = {}
            group_map: dict[int, int] = {}

            for revision in paper.revisions:
                revision_v2 = session.scalar(
                    select(PaperRevisionV2).where(
                        PaperRevisionV2.paper_id == paper_v2.id,
                        PaperRevisionV2.revision_number == revision.revision_number,
                    )
                )
                if revision_v2 is None:
                    revision_v2 = PaperRevisionV2(
                        paper_id=paper_v2.id,
                        revision_number=revision.revision_number,
                        status="published" if revision.is_published else "draft",
                        created_at=revision.created_at,
                    )
                    session.add(revision_v2)
                    session.flush()
                else:
                    revision_v2.status = "published" if revision.is_published else "draft"
                    session.add(revision_v2)
                seen_revision_ids.add(revision_v2.id)
                seen_section_ids: set[int] = set()
                seen_block_ids: set[int] = set()
                seen_group_ids: set[int] = set()
                seen_question_ids: set[int] = set()

                for section in revision.sections:
                    section_v2 = session.scalar(
                        select(PaperSectionV2).where(
                            PaperSectionV2.revision_id == revision_v2.id,
                            PaperSectionV2.section_key == section.section_key,
                        )
                    )
                    if section_v2 is None:
                        section_v2 = PaperSectionV2(
                            revision_id=revision_v2.id,
                            section_key=section.section_key,
                            title=section.title,
                            display_order=section.display_order,
                        )
                        session.add(section_v2)
                        session.flush()
                    else:
                        section_v2.title = section.title
                        section_v2.display_order = section.display_order
                        session.add(section_v2)
                    seen_section_ids.add(section_v2.id)
                    section_map[section.id] = section_v2.id

                for block in revision.blocks:
                    block_v2 = session.scalar(
                        select(PaperBlockV2).where(
                            PaperBlockV2.revision_id == revision_v2.id,
                            PaperBlockV2.display_order == block.display_order,
                        )
                    )
                    if block_v2 is None:
                        block_v2 = PaperBlockV2(
                            revision_id=revision_v2.id,
                            section_id=section_map[block.section_id],
                            block_kind=block.block_type,
                            display_order=block.display_order,
                        )
                        session.add(block_v2)
                        session.flush()
                    else:
                        block_v2.section_id = section_map[block.section_id]
                        block_v2.block_kind = block.block_type
                        session.add(block_v2)
                    seen_block_ids.add(block_v2.id)
                    block_map[block.id] = block_v2.id

                for group in revision.material_groups:
                    group_v2 = session.scalar(
                        select(MaterialGroupV2).where(
                            MaterialGroupV2.revision_id == revision_v2.id,
                            MaterialGroupV2.block_id == block_map[group.block_id],
                        )
                    )
                    if group_v2 is None:
                        group_v2 = MaterialGroupV2(
                            revision_id=revision_v2.id,
                            block_id=block_map[group.block_id],
                            title=group.title,
                            content_json={
                                "groupKind": group.group_kind,
                                "materialText": group.material_text,
                                "instructionText": group.instruction_text,
                                "payload": group.payload_json,
                            },
                            display_order=group.display_order,
                        )
                        session.add(group_v2)
                        session.flush()
                    else:
                        group_v2.title = group.title
                        group_v2.content_json = {
                            "groupKind": group.group_kind,
                            "materialText": group.material_text,
                            "instructionText": group.instruction_text,
                            "payload": group.payload_json,
                        }
                        group_v2.display_order = group.display_order
                        session.add(group_v2)
                    seen_group_ids.add(group_v2.id)
                    group_map[group.id] = group_v2.id

                    existing_assets: dict[tuple[str, int], MaterialGroupAssetV2] = {}
                    for existing_group_asset in session.scalars(
                        select(MaterialGroupAssetV2).where(
                            MaterialGroupAssetV2.material_group_id == group_v2.id
                        )
                    ):
                        existing_assets[
                            (existing_group_asset.file_path, existing_group_asset.display_order)
                        ] = existing_group_asset
                    seen_asset_keys: set[tuple[str, int]] = set()
                    for group_asset in group.assets:
                        key = (group_asset.file_path, group_asset.display_order)
                        seen_asset_keys.add(key)
                        asset_v2 = existing_assets.get(key)
                        if asset_v2 is None:
                            session.add(
                                MaterialGroupAssetV2(
                                    material_group_id=group_v2.id,
                                    file_path=group_asset.file_path,
                                    mime_type=group_asset.mime_type,
                                    display_order=group_asset.display_order,
                                )
                            )
                        else:
                            asset_v2.mime_type = group_asset.mime_type
                            session.add(asset_v2)
                    stale_asset_ids = [
                        asset.id
                        for key, asset in existing_assets.items()
                        if key not in seen_asset_keys
                    ]
                    if stale_asset_ids:
                        session.execute(
                            delete(MaterialGroupAssetV2).where(
                                MaterialGroupAssetV2.id.in_(stale_asset_ids)
                            )
                        )

                for question in revision.questions:
                    item_no = question.position
                    question_v2 = session.scalar(
                        select(QuestionV2).where(
                            QuestionV2.revision_id == revision_v2.id,
                            QuestionV2.item_no == item_no,
                        )
                    )
                    subject_kind = question.subject or infer_subject(question) or "未知"
                    material_group_v2_id = (
                        group_map.get(question.material_group_id)
                        if question.material_group_id is not None
                        else None
                    )
                    if question_v2 is None:
                        question_v2 = QuestionV2(
                            revision_id=revision_v2.id,
                            section_id=section_map[question.section_id],
                            block_id=block_map[question.block_id],
                            material_group_id=material_group_v2_id,
                            item_no=item_no,
                            subject_kind=subject_kind,
                            prompt=question.stem_text,
                            answer_kind=question.renderer_key,
                            status="published" if question.enabled else "draft",
                            content_json=build_question_content(question),
                            created_at=question.created_at,
                            updated_at=question.updated_at,
                        )
                        session.add(question_v2)
                        session.flush()
                    else:
                        question_v2.section_id = section_map[question.section_id]
                        question_v2.block_id = block_map[question.block_id]
                        question_v2.material_group_id = material_group_v2_id
                        question_v2.subject_kind = subject_kind
                        question_v2.prompt = question.stem_text
                        question_v2.answer_kind = question.renderer_key
                        question_v2.status = "published" if question.enabled else "draft"
                        question_v2.content_json = build_question_content(question)
                        question_v2.updated_at = question.updated_at
                        session.add(question_v2)
                    seen_question_ids.add(question_v2.id)

                    existing_options = {
                        option.option_key: option
                        for option in session.scalars(
                            select(QuestionOptionV2).where(
                                QuestionOptionV2.question_id == question_v2.id
                            )
                        )
                    }
                    seen_option_keys: set[str] = set()
                    for option in question.options:
                        seen_option_keys.add(option.option_key)
                        option_v2 = existing_options.get(option.option_key)
                        if option_v2 is None:
                            session.add(
                                QuestionOptionV2(
                                    question_id=question_v2.id,
                                    option_key=option.option_key,
                                    option_text=option.option_text,
                                    display_order=option.display_order,
                                )
                            )
                        else:
                            option_v2.option_text = option.option_text
                            option_v2.display_order = option.display_order
                            session.add(option_v2)
                    stale_option_ids = [
                        option.id
                        for key, option in existing_options.items()
                        if key not in seen_option_keys
                    ]
                    if stale_option_ids:
                        session.execute(
                            delete(QuestionOptionV2).where(
                                QuestionOptionV2.id.in_(stale_option_ids)
                            )
                        )

                    existing_question_assets: dict[tuple[str, int], QuestionAssetV2] = {}
                    for existing_question_asset in session.scalars(
                        select(QuestionAssetV2).where(
                            QuestionAssetV2.question_id == question_v2.id
                        )
                    ):
                        existing_question_assets[
                            (
                                existing_question_asset.file_path,
                                existing_question_asset.display_order,
                            )
                        ] = existing_question_asset
                    seen_question_asset_keys: set[tuple[str, int]] = set()
                    for question_asset in question.assets:
                        key = (question_asset.file_path, question_asset.display_order)
                        seen_question_asset_keys.add(key)
                        question_asset_v2: QuestionAssetV2 | None = existing_question_assets.get(key)
                        if question_asset_v2 is None:
                            session.add(
                                QuestionAssetV2(
                                    question_id=question_v2.id,
                                    file_path=question_asset.file_path,
                                    mime_type=question_asset.mime_type,
                                    display_order=question_asset.display_order,
                                )
                            )
                        else:
                            question_asset_v2.mime_type = question_asset.mime_type
                            session.add(question_asset_v2)
                    stale_question_asset_ids = [
                        asset.id
                        for key, asset in existing_question_assets.items()
                        if key not in seen_question_asset_keys
                    ]
                    if stale_question_asset_ids:
                        session.execute(
                            delete(QuestionAssetV2).where(
                                QuestionAssetV2.id.in_(stale_question_asset_ids)
                            )
                        )

                stale_question_ids = list(
                    session.scalars(
                        select(QuestionV2.id).where(
                            QuestionV2.revision_id == revision_v2.id,
                            QuestionV2.id.notin_(seen_question_ids),
                        )
                    )
                )
                if stale_question_ids:
                    session.execute(delete(QuestionV2).where(QuestionV2.id.in_(stale_question_ids)))

                stale_group_ids = list(
                    session.scalars(
                        select(MaterialGroupV2.id).where(
                            MaterialGroupV2.revision_id == revision_v2.id,
                            MaterialGroupV2.id.notin_(seen_group_ids),
                        )
                    )
                )
                if stale_group_ids:
                    session.execute(delete(MaterialGroupV2).where(MaterialGroupV2.id.in_(stale_group_ids)))

                stale_block_ids = list(
                    session.scalars(
                        select(PaperBlockV2.id).where(
                            PaperBlockV2.revision_id == revision_v2.id,
                            PaperBlockV2.id.notin_(seen_block_ids),
                        )
                    )
                )
                if stale_block_ids:
                    session.execute(delete(PaperBlockV2).where(PaperBlockV2.id.in_(stale_block_ids)))

                stale_section_ids = list(
                    session.scalars(
                        select(PaperSectionV2.id).where(
                            PaperSectionV2.revision_id == revision_v2.id,
                            PaperSectionV2.id.notin_(seen_section_ids),
                        )
                    )
                )
                if stale_section_ids:
                    session.execute(delete(PaperSectionV2).where(PaperSectionV2.id.in_(stale_section_ids)))

            stale_revision_ids = list(
                session.scalars(
                    select(PaperRevisionV2.id).where(
                        PaperRevisionV2.paper_id == paper_v2.id,
                        PaperRevisionV2.id.notin_(seen_revision_ids),
                    )
                )
            )
            if stale_revision_ids:
                session.execute(delete(PaperRevisionV2).where(PaperRevisionV2.id.in_(stale_revision_ids)))

        commit_or_rollback(session, dry_run=dry_run)
    finally:
        session.close()
    stats.emit(scope="content", dry_run=dry_run)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="backfill_v2_content",
        description="Backfill legacy paper/question content into *_v2 tables.",
    )
    add_common_args(parser)
    args = parser.parse_args()
    return run(
        database_url=args.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
    )


if __name__ == "__main__":
    raise SystemExit(main())
