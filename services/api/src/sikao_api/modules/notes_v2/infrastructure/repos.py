from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, case, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteImageV2, NoteTagV2, NoteV2, QuestionV2, UserV2


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

    def list_public_notes(
        self,
        *,
        page: int,
        size: int,
        sort: str,
        linked_question_id: int | None,
        tags: Sequence[str],
    ) -> tuple[list[tuple[NoteV2, str | None]], int]:
        stmt = (
            select(NoteV2, UserV2.display_name)
            .join(UserV2, UserV2.id == NoteV2.user_id)
            .where(
                NoteV2.visibility == "public",
                NoteV2.deleted_at.is_(None),
            )
        )
        if linked_question_id is not None:
            stmt = stmt.where(NoteV2.linked_question_id == linked_question_id)
        if sort == "featured":
            stmt = stmt.where(NoteV2.is_featured.is_(True))
        if tags:
            stmt = self._apply_tag_filter(stmt, tags=tags)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.session.scalar(count_stmt) or 0)

        stmt = stmt.order_by(*self._resolve_community_order_by(sort=sort))
        stmt = stmt.offset((page - 1) * size).limit(size)
        rows = list(self.session.execute(stmt).all())
        return [(note, display_name) for note, display_name in rows], total

    def list_note_tags(self, *, note_id: int) -> list[str]:
        return list(
            self.session.scalars(
                select(NoteTagV2.tag_name)
                .where(NoteTagV2.note_id == note_id)
                .order_by(NoteTagV2.id.asc())
            )
        )

    def list_note_tags_map(self, *, note_ids: Sequence[int]) -> dict[int, list[str]]:
        if not note_ids:
            return {}
        rows = self.session.execute(
            select(NoteTagV2.note_id, NoteTagV2.tag_name)
            .where(NoteTagV2.note_id.in_(list(note_ids)))
            .order_by(NoteTagV2.note_id.asc(), NoteTagV2.id.asc())
        ).all()
        tags_map: dict[int, list[str]] = {}
        for note_id, tag_name in rows:
            tags_map.setdefault(int(note_id), []).append(str(tag_name))
        return tags_map

    def replace_tags(
        self,
        *,
        note_id: int,
        user_id: int,
        tags: Sequence[str],
    ) -> list[str]:
        existing_rows = list(
            self.session.scalars(
                select(NoteTagV2).where(NoteTagV2.note_id == note_id).order_by(NoteTagV2.id.asc())
            )
        )
        system_tags = [row.tag_name for row in existing_rows if row.is_system]
        for row in existing_rows:
            if not row.is_system:
                self.session.delete(row)
        self.session.flush()
        persisted: list[str] = []
        for tag_name in system_tags:
            persisted.append(tag_name)
        for tag_name in tags:
            if tag_name in system_tags:
                continue
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

    def list_tag_counts(self, *, user_id: int) -> list[tuple[str, bool, int]]:
        rows = self.session.execute(
            select(
                NoteTagV2.tag_name,
                func.max(case((NoteTagV2.is_system.is_(True), 1), else_=0)),
                func.count(NoteTagV2.id),
            )
            .where(NoteTagV2.user_id == user_id)
            .group_by(NoteTagV2.tag_name)
            .order_by(func.count(NoteTagV2.id).desc(), NoteTagV2.tag_name.asc())
        ).all()
        return [(str(tag_name), bool(is_system), int(count)) for tag_name, is_system, count in rows]

    def get_note_tag(
        self,
        *,
        note_id: int,
        tag_name: str,
    ) -> NoteTagV2 | None:
        return self.session.scalar(
            select(NoteTagV2).where(
                NoteTagV2.note_id == note_id,
                NoteTagV2.tag_name == tag_name,
            )
        )

    def add_note_tag(
        self,
        *,
        user_id: int,
        note_id: int,
        tag_name: str,
        is_system: bool = False,
    ) -> NoteTagV2:
        row = NoteTagV2(
            user_id=user_id,
            note_id=note_id,
            tag_name=tag_name,
            is_system=is_system,
        )
        self.session.add(row)
        self.session.flush()
        return row

    def user_has_tag_name(self, *, user_id: int, tag_name: str) -> bool:
        return (
            self.session.scalar(
                select(NoteTagV2.id)
                .where(
                    NoteTagV2.user_id == user_id,
                    NoteTagV2.tag_name == tag_name,
                )
                .limit(1)
            )
            is not None
        )

    def list_user_tags(
        self,
        *,
        user_id: int,
        tag_names: Sequence[str] | None = None,
    ) -> list[NoteTagV2]:
        stmt = select(NoteTagV2).where(NoteTagV2.user_id == user_id)
        if tag_names:
            stmt = stmt.where(NoteTagV2.tag_name.in_(list(tag_names)))
        return list(self.session.scalars(stmt))

    def count_note_images(self, *, note_id: int) -> int:
        return int(
            self.session.scalar(
                select(func.count(NoteImageV2.id)).where(NoteImageV2.note_id == note_id)
            )
            or 0
        )

    def list_owned_orphan_note_images_by_paths(
        self,
        *,
        user_id: int,
        file_paths: Sequence[str],
        for_update: bool = False,
    ) -> list[NoteImageV2]:
        if not file_paths:
            return []
        stmt = select(NoteImageV2).where(
            NoteImageV2.user_id == user_id,
            NoteImageV2.note_id.is_(None),
            NoteImageV2.file_path.in_(list(file_paths)),
        )
        if for_update:
            stmt = stmt.with_for_update()
        return list(self.session.scalars(stmt))

    def create_note_image(
        self,
        *,
        note_id: int | None,
        user_id: int,
        file_path: str,
        file_name: str,
        file_size: int,
        mime_type: str,
        width: int | None,
        height: int | None,
    ) -> NoteImageV2:
        row = NoteImageV2(
            note_id=note_id,
            user_id=user_id,
            file_path=file_path,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            width=width,
            height=height,
        )
        self.session.add(row)
        self.session.flush()
        return row

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
            stmt = self._apply_tag_filter(stmt, tags=tags)
        return stmt

    @staticmethod
    def _apply_tag_filter(
        stmt: Select[Any],
        *,
        tags: Sequence[str],
    ) -> Select[Any]:
        tag_subquery = (
            select(NoteTagV2.note_id)
            .where(NoteTagV2.tag_name.in_(list(tags)))
            .group_by(NoteTagV2.note_id)
            .having(func.count(func.distinct(NoteTagV2.tag_name)) == len(tags))
        )
        return stmt.where(NoteV2.id.in_(tag_subquery))

    @staticmethod
    def _resolve_community_order_by(*, sort: str) -> tuple[Any, ...]:
        if sort == "latest":
            return (NoteV2.created_at.desc(), NoteV2.id.desc())
        if sort == "hottest":
            return (
                NoteV2.reaction_count.desc(),
                NoteV2.created_at.desc(),
                NoteV2.id.desc(),
            )
        if sort == "featured":
            return (
                NoteV2.reaction_count.desc(),
                NoteV2.created_at.desc(),
                NoteV2.id.desc(),
            )
        raise ValueError(f"unsupported community sort: {sort}")
