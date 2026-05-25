from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteTagV2, NoteV2, QuestionV2, UserV2


class NotesRepoV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_notes(
        self,
        *,
        user_id: int,
        page: int,
        size: int,
        note_type: str | None,
        visibility: str | None,
        linked_question_id: int | None,
        has_linked_question: bool | None,
        tags: Sequence[str],
        sort: str,
        order: str,
    ) -> tuple[list[NoteV2], int]:
        stmt = select(NoteV2).where(
            NoteV2.user_id == user_id,
            NoteV2.deleted_at.is_(None),
        )
        stmt = self._apply_filters(
            stmt,
            note_type=note_type,
            visibility=visibility,
            linked_question_id=linked_question_id,
            has_linked_question=has_linked_question,
            tags=tags,
        )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.session.scalar(count_stmt) or 0)

        stmt = stmt.order_by(*self._resolve_order_by(sort=sort, order=order))
        stmt = stmt.offset((page - 1) * size).limit(size)
        items = list(self.session.scalars(stmt))
        return items, total

    def get_owned_note(
        self,
        *,
        user_id: int,
        note_id: int,
        include_deleted: bool = False,
    ) -> NoteV2 | None:
        stmt = select(NoteV2).where(
            NoteV2.id == note_id,
            NoteV2.user_id == user_id,
        )
        if not include_deleted:
            stmt = stmt.where(NoteV2.deleted_at.is_(None))
        return self.session.scalar(stmt)

    def get_question(self, *, question_id: int) -> QuestionV2 | None:
        return self.session.get(QuestionV2, question_id)

    def get_user(self, *, user_id: int) -> UserV2 | None:
        return self.session.get(UserV2, user_id)

    def list_note_tags(self, *, note_id: int) -> list[str]:
        return list(
            self.session.scalars(
                select(NoteTagV2.tag_name)
                .where(NoteTagV2.note_id == note_id)
                .order_by(NoteTagV2.id.asc())
            )
        )

    def replace_tags(
        self,
        *,
        note_id: int,
        user_id: int,
        tags: Sequence[str],
    ) -> list[str]:
        self.session.query(NoteTagV2).filter(NoteTagV2.note_id == note_id).delete()
        persisted: list[str] = []
        for tag_name in tags:
            row = NoteTagV2(
                user_id=user_id,
                note_id=note_id,
                tag_name=tag_name,
                is_system=False,
            )
            self.session.add(row)
            persisted.append(tag_name)
        self.session.flush()
        return persisted

    @staticmethod
    def _resolve_order_by(*, sort: str, order: str) -> tuple[Any, Any]:
        mapping = {
            "updated_at": NoteV2.updated_at,
            "created_at": NoteV2.created_at,
            "title": NoteV2.title,
        }
        column = mapping[sort]
        direction = column.asc() if order == "asc" else column.desc()
        if sort == "title":
            return direction, NoteV2.updated_at.desc()
        return direction, NoteV2.id.desc()

    def _apply_filters(
        self,
        stmt: Select[tuple[NoteV2]],
        *,
        note_type: str | None,
        visibility: str | None,
        linked_question_id: int | None,
        has_linked_question: bool | None,
        tags: Sequence[str],
    ) -> Select[tuple[NoteV2]]:
        if note_type is not None:
            stmt = stmt.where(NoteV2.type == note_type)
        if visibility is not None:
            stmt = stmt.where(NoteV2.visibility == visibility)
        if linked_question_id is not None:
            stmt = stmt.where(NoteV2.linked_question_id == linked_question_id)
        if has_linked_question is True:
            stmt = stmt.where(NoteV2.linked_question_id.is_not(None))
        elif has_linked_question is False:
            stmt = stmt.where(NoteV2.linked_question_id.is_(None))
        if tags:
            tag_subquery = (
                select(NoteTagV2.note_id)
                .where(NoteTagV2.tag_name.in_(list(tags)))
                .group_by(NoteTagV2.note_id)
                .having(func.count(func.distinct(NoteTagV2.tag_name)) == len(tags))
            )
            stmt = stmt.where(NoteV2.id.in_(tag_subquery))
        return stmt
