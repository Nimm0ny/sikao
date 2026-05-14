from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sikao_api.db.base import Base

# 跨方言 JSON 列: PG 用 JSONB (二进制存储 + GIN 索引可用), SQLite 用 JSON (TEXT
# 兜底, SA 自动 dumps/loads). 业务侧永远拿 dict/list, 永不 json.dumps. v1 schema
# 升级 (xingce import + 上线设计) 把 9 个 *_json 列从 Text/JSON 统一切到这套类型.
JSONB_COMPAT = JSON().with_variant(JSONB(), "postgresql")


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


question_tags = Table(
    "question_tags",
    Base.metadata,
    Column("question_id", ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Identity v2 (D6/D7): username 保留 display 用, 不再作为登录 identifier.
    # 新 phone 注册的用户 username=NULL; 老 user 仍保留原 username. unique 约束
    # 保留 (NULL 在 PG/SQLite 都豁免 unique violation, 多个 NULL 共存 OK).
    # 0001 baseline 仍建 NOT NULL (FORCE_NOT_NULL_IN_0001), 0015 ALTER 改 nullable.
    username: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Phase B.1 (auth recovery): email 可选字段, 老 user 兼容. unique 约束让
    # email 重复 register 直接 IntegrityError. lower() 比对在应用层处理.
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Identity v2: 大陆手机号 11 位纯数字 (normalize_phone 处理 +86/空格/横线).
    # 跟 email 同模式 nullable+unique. phone_verified 跟 email_verified 同语义.
    phone: Mapped[str | None] = mapped_column(String(11), nullable=True, unique=True, index=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    practice_sessions: Mapped[list[PracticeSession]] = relationship(back_populates="user")
    auth_tokens: Mapped[list[AuthToken]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    # SIKAO Wave 8 Phase A (0021): Home block 1 "我的考试". CASCADE: 删账户
    # 带走自定义考试. FK ondelete="CASCADE" + ORM cascade 双保险.
    user_exams: Mapped[list[UserExam]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    paper_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    paper_name: Mapped[str] = mapped_column(String(255), nullable=False)
    exam_year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_provider: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    source_kind: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    current_revision_id: Mapped[int | None] = mapped_column(
        ForeignKey("paper_revisions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    revisions: Mapped[list[PaperRevision]] = relationship(
        back_populates="paper",
        foreign_keys="PaperRevision.paper_id",
        order_by="PaperRevision.revision_number",
        cascade="all, delete-orphan",
    )
    current_revision: Mapped[PaperRevision | None] = relationship(foreign_keys=[current_revision_id], post_update=True)
    practice_sessions: Mapped[list[PracticeSession]] = relationship(back_populates="paper")


class PaperRevision(Base):
    __tablename__ = "paper_revisions"
    __table_args__ = (UniqueConstraint("paper_id", "revision_number", name="uq_paper_revision_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    paper_id: Mapped[int] = mapped_column(ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    paper_name: Mapped[str] = mapped_column(String(255), nullable=False)
    exam_year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_provider: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    source_kind: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    is_gradable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    uses_placeholder_answers: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    visible_in_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_snapshot_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    paper: Mapped[Paper] = relationship(back_populates="revisions", foreign_keys=[paper_id])
    sections: Mapped[list[PaperSection]] = relationship(
        back_populates="paper_revision",
        cascade="all, delete-orphan",
        order_by="PaperSection.display_order",
    )
    blocks: Mapped[list[PaperBlock]] = relationship(
        back_populates="paper_revision",
        cascade="all, delete-orphan",
        order_by="PaperBlock.display_order",
    )
    material_groups: Mapped[list[MaterialGroup]] = relationship(
        back_populates="paper_revision",
        cascade="all, delete-orphan",
        order_by="MaterialGroup.display_order",
    )
    questions: Mapped[list[Question]] = relationship(
        back_populates="paper_revision",
        cascade="all, delete-orphan",
        order_by="Question.position",
    )
    practice_sessions: Mapped[list[PracticeSession]] = relationship(back_populates="paper_revision")
    release_audits: Mapped[list[ReleaseAudit]] = relationship(
        back_populates="revision",
        cascade="all, delete-orphan",
        order_by="ReleaseAudit.created_at",
    )


class PaperSection(Base):
    __tablename__ = "paper_sections"
    __table_args__ = (
        UniqueConstraint("paper_revision_id", "section_key", name="uq_section_key_per_revision"),
        UniqueConstraint("paper_revision_id", "display_order", name="uq_section_order_per_revision"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    paper_revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions.id", ondelete="CASCADE"), nullable=False, index=True)
    section_key: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    instruction_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    paper_revision: Mapped[PaperRevision] = relationship(back_populates="sections")
    blocks: Mapped[list[PaperBlock]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="PaperBlock.display_order",
    )
    questions: Mapped[list[Question]] = relationship(back_populates="section")


class PaperBlock(Base):
    __tablename__ = "paper_blocks"
    __table_args__ = (UniqueConstraint("paper_revision_id", "display_order", name="uq_block_order_per_revision"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    paper_revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("paper_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    block_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    paper_revision: Mapped[PaperRevision] = relationship(back_populates="blocks")
    section: Mapped[PaperSection] = relationship(back_populates="blocks")
    material_group: Mapped[MaterialGroup | None] = relationship(
        back_populates="block",
        cascade="all, delete-orphan",
        uselist=False,
    )
    questions: Mapped[list[Question]] = relationship(back_populates="block", order_by="Question.position")


class MaterialGroup(Base):
    __tablename__ = "material_groups"
    __table_args__ = (UniqueConstraint("paper_revision_id", "source_group_uuid", name="uq_revision_group_uuid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    paper_revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions.id", ondelete="CASCADE"), nullable=False, index=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("paper_blocks.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    source_group_uuid: Mapped[str] = mapped_column(String(100), nullable=False)
    group_kind: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    material_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    instruction_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    paper_revision: Mapped[PaperRevision] = relationship(back_populates="material_groups")
    block: Mapped[PaperBlock] = relationship(back_populates="material_group")
    assets: Mapped[list[MaterialGroupAsset]] = relationship(
        back_populates="material_group",
        cascade="all, delete-orphan",
        order_by="MaterialGroupAsset.display_order",
    )
    questions: Mapped[list[Question]] = relationship(back_populates="material_group", order_by="Question.position")


class MaterialGroupAsset(Base):
    __tablename__ = "material_group_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    material_group_id: Mapped[int] = mapped_column(ForeignKey("material_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_role: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)

    material_group: Mapped[MaterialGroup] = relationship(back_populates="assets")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    questions: Mapped[list[Question]] = relationship(secondary=question_tags, back_populates="tags")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        UniqueConstraint("paper_revision_id", "position", name="uq_question_position_per_revision"),
        UniqueConstraint("paper_revision_id", "source_uuid", name="uq_question_source_uuid_per_revision"),
        Index("ix_questions_revision_position", "paper_revision_id", "position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    paper_revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("paper_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("paper_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    material_group_id: Mapped[int | None] = mapped_column(ForeignKey("material_groups.id", ondelete="SET NULL"), nullable=True, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    source_uuid: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    question_kind: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subtype_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    second_subtype_name: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    stem_text: Mapped[str] = mapped_column(Text, nullable=False)
    answer_text: Mapped[str] = mapped_column(String(50), nullable=False)
    explanation_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    difficulty_code: Mapped[str] = mapped_column(String(20), default="unknown", nullable=False, index=True)
    exam_year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_provider: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    source_kind: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    is_gradable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    renderer_key: Mapped[str] = mapped_column(String(50), default="single_choice", nullable=False)
    type_payload_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    special_payload_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    source_payload_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    canonical_top_type: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    canonical_subtype: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    canonical_second_subtype: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    raw_render_type: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    canonical_mapping_source: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    # Phase 5.4a：显式"科目"字段，用于错题本 / 数据面板按科目聚合。首次导入
    # 无值，由 app/scripts/backfill_question_subject.py 基于 canonical_top_type
    # 推断填充。保持 nullable 直到打标覆盖率 ≥95% 后另立 migration 改约束。
    subject: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    paper_revision: Mapped[PaperRevision] = relationship(back_populates="questions")
    section: Mapped[PaperSection] = relationship(back_populates="questions")
    block: Mapped[PaperBlock] = relationship(back_populates="questions")
    material_group: Mapped[MaterialGroup | None] = relationship(back_populates="questions")
    options: Mapped[list[QuestionOption]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.display_order",
    )
    assets: Mapped[list[QuestionAsset]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionAsset.display_order",
    )
    tags: Mapped[list[Tag]] = relationship(secondary=question_tags, back_populates="questions")
    practice_answers: Mapped[list[PracticeSessionAnswer]] = relationship(back_populates="question")


class QuestionOption(Base):
    __tablename__ = "question_options"
    __table_args__ = (
        UniqueConstraint("question_id", "option_key", name="uq_question_option_key"),
        UniqueConstraint("question_id", "display_order", name="uq_question_option_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    option_key: Mapped[str] = mapped_column(String(10), nullable=False)
    option_text: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    question: Mapped[Question] = relationship(back_populates="options")


class QuestionAsset(Base):
    __tablename__ = "question_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_role: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)

    question: Mapped[Question] = relationship(back_populates="assets")


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    total_files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_papers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_questions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    items: Mapped[list[ImportJobItem]] = relationship(
        back_populates="import_job",
        cascade="all, delete-orphan",
        order_by="ImportJobItem.id",
    )


class ImportJobItem(Base):
    __tablename__ = "import_job_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    import_job_id: Mapped[int] = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    paper_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    paper_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    revision_id: Mapped[int | None] = mapped_column(ForeignKey("paper_revisions.id", ondelete="SET NULL"), nullable=True, index=True)
    revision_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    imported_question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    error_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    import_job: Mapped[ImportJob] = relationship(back_populates="items")
    revision: Mapped[PaperRevision | None] = relationship()


class PracticeSession(Base):
    __tablename__ = "practice_sessions"
    __table_args__ = (Index("ix_practice_sessions_user_started", "user_id", "started_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mode: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # ARCH §7.2 Pages P2 修复 (2026-04-28, alembic 0004): paper_id /
    # paper_revision_id 改 nullable. cross-paper retry session (mode=retry_wrong
    # 且 questions 跨多 revision) 用 NULL 标记 — 跟单 paper retry 共用 mode 字段
    # 但用 paper_revision_id 是否 NULL 区分. 提交/结果路径专门处理 NULL case.
    paper_id: Mapped[int | None] = mapped_column(
        ForeignKey("papers.id", ondelete="CASCADE"), nullable=True, index=True
    )
    paper_revision_id: Mapped[int | None] = mapped_column(
        ForeignKey("paper_revisions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    total_questions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # B-review B4 (alembic 0004): cross-paper retry session 的 batch question_ids
    # NULL = 老 paper-bound session (无 batch allowlist — paper_revision_id 匹配
    # 是 source of truth). cross-paper session 必须有此字段, submit 守门 (防 user
    # 提交 batch 外的题). v1 上线设计 (alembic 0012): Text 切 JSONB, 应用层直存
    # list[int] 不再 json.dumps. 字段名 `_json` 是历史遗留, 兼顾 grep 不改名.
    retry_question_ids_json: Mapped[list[int] | None] = mapped_column(JSONB_COMPAT, nullable=True)

    user: Mapped[User] = relationship(back_populates="practice_sessions")
    paper: Mapped[Paper | None] = relationship(back_populates="practice_sessions")
    paper_revision: Mapped[PaperRevision | None] = relationship(back_populates="practice_sessions")
    answers: Mapped[list[PracticeSessionAnswer]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="PracticeSessionAnswer.display_order",
    )


class PracticeSessionAnswer(Base):
    __tablename__ = "practice_session_answers"
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_practice_session_question"),
        Index("ix_practice_session_answers_session_question", "session_id", "question_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("practice_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    # 独立 review KEY OBS #2 修 (alembic 0005): 列从 paper_position 改名
    # display_order, 老名字暗示 "position within paper revision" 在 cross-
    # paper retry 路径 (mode=retry_wrong_cross_paper) 是 batch index 不是真
    # paper position. display_order 中性更准确: "answer 在此 session 内的展示
    # 顺序", 兼容两种 mode.
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_answer: Mapped[str] = mapped_column(String(50), nullable=False)
    correct_answer_snapshot: Mapped[str] = mapped_column(String(50), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False, index=True)

    session: Mapped[PracticeSession] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship(back_populates="practice_answers")


class ReleaseAudit(Base):
    __tablename__ = "release_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions.id", ondelete="CASCADE"), nullable=False, index=True)
    released_by: Mapped[str] = mapped_column(String(255), nullable=False)
    release_note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    release_execution_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    revision: Mapped[PaperRevision] = relationship(back_populates="release_audits")


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("scope", "idempotency_key", name="uq_idempotency_scope_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scope: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_code: Mapped[int] = mapped_column(Integer, nullable=False)
    response_body: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class WrongQuestionMastery(Base):
    """
    Phase 5.4a：错题掌握度追踪表。自动规则驱动（见 app/services/mastery.py）：
      - 用户第一次做错某题 → 创建记录，level=not_mastered
      - 再做对 1 次     → level=reviewing（consecutive_correct_count=1）
      - 再做对 2 次     → level=mastered（consecutive_correct_count>=2）
      - 任意答错再次触发 → 重置 level=not_mastered 且 consecutive_correct_count=0

    匿名 session（user 为 None）不进此表，避免 guest 累计无意义数据。
    """

    __tablename__ = "wrong_question_masteries"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_mastery_user_question"),
        Index("ix_mastery_user_updated", "user_id", "last_updated"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 字面量 "not_mastered" | "reviewing" | "mastered"（避免 ENUM 跨方言差异）。
    mastery_level: Mapped[str] = mapped_column(
        String(20), nullable=False, default="not_mastered"
    )
    last_wrong_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    consecutive_correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )
    # SIKAO Wave 4 Phase 2C (alembic 0020): xingce-wrongbook BE 4 字段扩.
    # error_reasons / bluff_count / peek_count / attempts_json — 见 0020 docstring.
    error_reasons: Mapped[list[str]] = mapped_column(
        JSONB_COMPAT, default=list, nullable=False
    )
    bluff_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    peek_count: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    attempts_json: Mapped[list[dict] | None] = mapped_column(JSONB_COMPAT, nullable=True)

    # relationships —— 供 ExamPaperService.list_wrong_questions 的 joinedload 用。
    question: Mapped[Question] = relationship()
    user: Mapped[User] = relationship()


class WrongQuestionAttempt(Base):
    """SIKAO Wave 4 Phase 2C (alembic 0019): 错题做题历史粒度表.

    跟 WrongQuestionMastery (一题一行聚合) 互补: 一次做题一行.

    应用层走 attempts 表查询历史 (DetailA "答题记录"), 而非依赖 attempts_json
    备份 (attempts_json 仅 cold-storage 用).
    """

    __tablename__ = "wrong_question_attempts"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "question_id", "attempt_no", name="uq_attempts_user_question_attempt"
        ),
        Index(
            "ix_attempts_user_question_time",
            "user_id",
            "question_id",
            "attempted_at",
        ),
        Index("ix_attempts_user_time", "user_id", "attempted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_option_key: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    error_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)

    question: Mapped[Question] = relationship()
    user: Mapped[User] = relationship()


class AuthToken(Base):
    """Phase B (auth recovery): single-use auth tokens for password reset +
    email verify flows.

    Token storage: 仅存 sha256(raw) hex (D4). raw token 仅在 send-email 那
    一次返给上层 (用于拼 link). 验证时 hash 比对.

    Lifecycle:
      - created_at + expires_at: TTL 1h (password_reset) / 24h (email_verify)
      - used_at NULL → 可用; 一旦 used_at 设值 → reject (single-use)
      - reset 成功后 invalidate 同 user 同 kind 其他 unused token (D6 + P1-6)
    """

    __tablename__ = "auth_tokens"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_auth_tokens_hash"),
        Index("ix_auth_tokens_user_kind", "user_id", "kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # 字面量 "password_reset" | "email_verify". 不用 ENUM 避免跨方言差异.
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="auth_tokens")


class PreRegisterCode(Base):
    """Identity v2 (D9): SMS / email verify code 给 register / bind / future OTP login.

    跟 AuthToken 互补:
      - AuthToken: user-bound (reset/verify-email, user 已登录, user_id 必填)
      - PreRegisterCode: target-bound (target_value 是要绑/要注册的 phone/email,
        register 时 user 还没存在; bind 时新 phone/email 也还没写进 user)

    D17 confirm 端限流自废: 单 code 失败 ≥3 次 → mark used_at=now (一次性废,
    引导用户重发 code). attempt_count 字段记失败次数.

    D19 比对方式: confirm 端用 code_hash 作 SQL WHERE 条件查 (DB-side lookup),
    跟 AuthToken._lookup_token 同模式, 天然防时序攻击.

    Metadata 字段 (额外发现 B 修订): requester_ip / confirmer_ip 仅留痕事后
    审计, 不做"send/confirm IP 同 /24"硬阻塞 (主流 C 端不做, false positive 高).
    """

    __tablename__ = "pre_register_codes"
    # P0 review fix (#3e): 删 code_hash 表级 UNIQUE — 6-digit code 空间 10^6,
    # 表内累积 ~1184 active rows 时 50% 概率两 phone 拿到相同 code → 同
    # code_hash → INSERT 撞 UNIQUE → IntegrityError 500. verify_code 已经按
    # (target_kind, target_value, purpose, code_hash, used_at IS NULL,
    # expires>now) 多条件 WHERE 查, 不需全局唯一. 攻击者跨 target probe
    # 同 code 也命中不到 (target_value 强约束).
    __table_args__ = (
        Index("ix_pre_register_codes_target", "target_kind", "target_value"),
        Index("ix_pre_register_codes_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # bind/* 时填 (logged-in user 在 bind newEmail/newPhone, 防 token leak —
    # attacker 偷 victim 的 newEmail token 不能在 attacker 自己 session confirm
    # 写到 attacker user.email). register / login_otp 时 NULL (user 还不存在).
    # ondelete=CASCADE: user 删了 pending bind code 一起清.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    # 'phone' | 'email' — 决定 target_value 是手机号还是邮箱.
    target_kind: Mapped[str] = mapped_column(String(10), nullable=False)
    # 已 normalized: phone 是 11 位纯数字 (normalize_phone), email 是 lower-strip.
    target_value: Mapped[str] = mapped_column(String(255), nullable=False)
    # sha256(6-digit code) hex (register / login_otp) 或 sha256(token_urlsafe(32))
    # (bind_email link). raw code/token 仅 send 那一次返上层.
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    # 'register' | 'bind_phone' | 'bind_email' | 'login_otp' (future).
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    # D17 (b): 单 code confirm 失败次数, ≥3 mark used_at=now (一次性废).
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    # 额外发现 B (review fix): metadata only, 不做 IP /24 同段硬阻塞.
    requester_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    confirmer_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)


class ExamEvent(Base):
    """Phase 7 ARCH §7.3 P3 — 公考考试日历, admin 维护.

    替前端 hardcoded EXAM_EVENTS list (lib/exam-calendar.ts). frontend GET
    /api/v2/exam-events 拉, admin 通过 /api/v2/admin/exam-events CRUD 维护.

    `slug` 是 stable identifier 给后续 ICS / 通知功能引用. `visible` 让 admin
    在不删数据情况下隐藏 (e.g. 暂未确认的草稿).
    """

    __tablename__ = "exam_events"
    __table_args__ = (Index("ix_exam_events_visible_date", "visible", "exam_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # 字面量 national / provincial / institution / other. 不用 ENUM 避方言差.
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    registration_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    registration_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    # 字面量 confirmed / estimate. 让 UI 显示 "估" badge.
    precision: Mapped[str] = mapped_column(String(20), default="estimate", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class LlmTokenUsage(Base):
    """Slice 0b: LLM token 使用记账, 一次 LLM call 一行.

    User 删了走 SET NULL (不 cascade) — 用量数据保留给 admin 审计 / 计费追溯,
    不带 PII 直接信息 (prompt 内容不存这表, 只存 token 数 + model + cost).

    feature 字面量: 'qa' | 'essay_grading' | 'study_plan' (Slice 1a/2c/3a 用).
    provider 字面量: 'system' (lhr 默认 DS) | 'user_byom' (Slice 0c).
    """

    __tablename__ = "llm_token_usage"
    __table_args__ = (
        Index("ix_llm_token_usage_user_created", "user_id", "created_at"),
        Index("ix_llm_token_usage_feature_created", "feature", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    feature: Mapped[str] = mapped_column(String(32), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    # token 字段全 INTEGER (单 call ≤ 4096 max_tokens, 不会溢出 int32).
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    # DeepSeek 扩展二档. OpenAI 不返这字段, default 0 (业务层 record_usage 取
    # ChatCompletionResult.prompt_cache_hit_tokens 直接落).
    prompt_cache_hit_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prompt_cache_miss_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    # denormalized for query speed (sum 时不用 prompt + completion 两 col 加).
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    # 估算成本 (cents). NULL if model 没价格表 (BYOM 用户给的 endpoint 没价格).
    cost_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # True if usage 来自 tiktoken 估算 (R9 fallback): stream final chunk
    # 没带 usage 字段时. 业务层 admin dashboard 会标 "估算" badge.
    estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class UserLlmConfig(Base):
    """Slice 0c: 用户 BYOM (Bring Your Own Model) 配置.

    每用户可配置多个 LLM endpoint, is_default 标当前激活. api_key_encrypted
    是 AES-256-GCM 加密的 blob (version || nonce || ct+tag), 详 services/
    llm/byom_config.py. AAD 绑定 user_id 防 ciphertext 被剪贴到别人的 record.

    User 删走 CASCADE: BYOM key 也删 (悬挂加密 blob 无意义).
    """

    __tablename__ = "user_llm_configs"
    __table_args__ = (
        UniqueConstraint("user_id", "label", name="uq_user_llm_configs_user_label"),
        Index("ix_user_llm_configs_user_default", "user_id", "is_default"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    base_url: Mapped[str] = mapped_column(String(255), nullable=False)
    # AES-256-GCM blob: version (1B) || nonce (12B) || ct+tag (var). 详
    # services/llm/byom_config.py 编解码.
    api_key_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 字面量 'ok' / 'unreachable' / 'auth_failed' / 'timeout' / NULL (从未测过).
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_tested_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class LlmConversation(Base):
    """Slice 1a: AI 答疑会话.

    user 删走 CASCADE — PII 答疑历史不留. messages 1:N (delete-orphan: 删会话
    自动删消息, 跟 schema FK ondelete=CASCADE 双层保证).

    context_kind 字面量 (业务层 enum):
      'question' | 'wrong_question' | 'session_result' | 'general'
    context_id NULL 仅 'general'.

    updated_at: 续 message 时由 service 层 explicit 刷新, list 按 DESC 排.
    """

    __tablename__ = "llm_conversations"
    __table_args__ = (
        Index("ix_llm_conversations_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    context_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    context_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    messages: Mapped[list[LlmMessage]] = relationship(
        "LlmMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="LlmMessage.created_at",
    )


class LlmMessage(Base):
    """Slice 1a: AI 答疑会话单条消息.

    role 字面量: 'system' | 'user' | 'assistant'.
    content 一次性 INSERT (assistant stream 累积完成后写入), 不存增量 chunk —
    避免每 chunk 一行 IO 风暴, 也防部分 chunk 写后 crash 留半截 row.

    token_usage_id 仅 assistant 消息有 (record_usage 写完拿 id 回填). user/system
    消息 token 数随 assistant call 一起记到 usage 行 (prompt_tokens), 单 row.
    """

    __tablename__ = "llm_messages"
    __table_args__ = (
        Index("ix_llm_messages_conversation_created", "conversation_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("llm_conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_usage_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_token_usage.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    conversation: Mapped[LlmConversation] = relationship(
        "LlmConversation", back_populates="messages"
    )


class EssayGradingRecord(Base):
    """Slice 2c: 申论批改记录.

    每次用户提交一次申论作答 → 一行 record. status 状态机:
      pending  — 用户已提交, BackgroundTask 异步评分中
      completed — LLM 返回 + sanity check 通过, score / feedback_json 落地
      failed   — LLM / parse / sanity check 任一失败, failure_reason 描述

    user 走 CASCADE — 用户删账户时 PII 答案不留. token_usage 走 SET NULL —
    用量审计行保留, 删 record 不删 usage (跟 LlmMessage 一致).
    """

    __tablename__ = "essay_grading_records"
    __table_args__ = (
        Index(
            "ix_essay_grading_records_user_created", "user_id", "created_at"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending"
    )
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=5, scale=2), nullable=True
    )
    # feedback_json shape (R10 sanity check 后写入):
    #   {overallScore, dimensions[{name, weight, score, comment}], strengths[],
    #    weaknesses[], suggestions[], sampleAnswer, suspicious}
    feedback_json: Mapped[dict | None] = mapped_column(JSONB_COMPAT, nullable=True)
    token_usage_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_token_usage.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    graded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class EssayDraftRecord(Base):
    """PR13 P5: 申论草稿持久化 (per-question upsert, in-progress).

    跟 EssayGradingRecord 区分:
      - drafts (本表): 用户输入中的草稿 (键盘 / 手写 metadata), FE 2s debounced
        autosave 写入; 每 (user_id, question_id) 唯一行, 多次保存 in-place update.
      - grading_records: 用户最终 submit 的答案 + LLM 评分结果, 多次重做同题各占
        一行 (insert-only).

    URL deviation from plan §8 (master 拍板):
      Plan 写 endpoint /api/v2/essay/sessions/{session_id}/draft, 但 BE 现状没
      session 实体. upsert 仍按 (user_id, question_id) 唯一约束 — 跟 plan §3
      schema 字符级对齐. session_id 是 FE 路由 namespace, 不需 BE 实体对应.

    handwritten_draft_metadata shape (app-level, schema 不约束):
      {path?: str, mime_type?: str, asset_id?: int, uploaded_at?: str,
       stroke_count?: int}
    新增字段不破坏 schema (JSON 列开放).

    user / question 都走 CASCADE — 用户删账户 + 题目删除 → 草稿 PII 不留.
    """

    __tablename__ = "essay_draft_records"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "question_id", name="uq_essay_draft_user_question"
        ),
        Index(
            "ix_essay_drafts_user_question", "user_id", "question_id"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    # 键盘草稿原文; max 5000 char (跟 EssayGradingRecord.answer_text 同上限).
    typed_draft: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # 手写草稿 metadata (JSONB on PG / JSON on SQLite). nullable — 用户未手写
    # 时为 NULL, 不是 {}.
    handwritten_draft_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB_COMPAT, nullable=True
    )
    saved_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class StudyPlan(Base):
    """Slice 3a: 学习计划 (每用户每天 1 份).

    generation_status 三态: success / fallback_cold_start / fallback_llm_failed.
    fallback 两种语义区分给 FE banner (P1-1 方案 A): cold_start 是新用户兜底,
    llm_failed 是 LLM 异常降级, 两者都 is_fallback=True 但语境不同.

    user CASCADE — 删账户带走 plan; plan→task 也 CASCADE 整套清理.
    token_usage SET NULL — 用量审计行保留, 删 record 不删 usage.
    """

    __tablename__ = "study_plans"
    __table_args__ = (
        UniqueConstraint("user_id", "plan_date", name="uq_study_plans_user_date"),
        Index("ix_study_plans_user_date", "user_id", "plan_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    generation_status: Mapped[str] = mapped_column(String(32), nullable=False)
    token_usage_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_token_usage.id", ondelete="SET NULL"), nullable=True
    )
    # SIKAO Wave 8 Phase A (0021): Home block 4 "今日配额" 数据源.
    # 全 nullable 兼容老 plan 行; Phase B service GET /today 把 NULL 当
    # "未设配额" 渲对应空态.
    daily_quota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    daily_accuracy_target: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    # 学科细分配额 {"言语": 10, "判推": 5, ...}. 应用层永远 dict (memory
    # `reference_jsonb_compat_pattern`).
    subject_quotas: Mapped[dict[str, int] | None] = mapped_column(
        JSONB_COMPAT, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    tasks: Mapped[list[StudyPlanTask]] = relationship(
        "StudyPlanTask",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="StudyPlanTask.display_order",
    )


class StudyPlanTask(Base):
    """Slice 3a: 学习计划单 task.

    task_kind ∈ {practice, review_wrong, essay_writing} (D1 砍 study_concept).
    payload_json shape 跟随 task_kind, Pydantic discriminated union 校验
    (schemas.PracticeTaskPayload / ReviewWrongTaskPayload / EssayWritingTaskPayload).

    status 三态 (D4): pending → completed / skipped, 单向不可逆.
    completed 时设 completed_at, skipped 时仍 NULL (区分 "完成时间" vs "跳过时间不需记录").
    """

    __tablename__ = "study_plan_tasks"
    __table_args__ = (
        Index(
            "ix_study_plan_tasks_plan_order", "plan_id", "display_order"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False
    )
    task_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSONB_COMPAT, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending"
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    plan: Mapped[StudyPlan] = relationship("StudyPlan", back_populates="tasks")


class QuestionNote(Base):
    """Phase 3.7 (fenbi-merge) — 用户对单题的笔记 (markdown).

    一个用户对一道题最多一条笔记 (UNIQUE on (user_id, question_id)). 富文本
    存 markdown 源文 (D-决策降级: 不引 tiptap 重库, qlink 用 [[#017]] 语法).
    PUT 走 upsert; 跨 paper / 跨 session 共享同一笔记 (笔记是题级而非答题
    会话级数据, 答题完了笔记还在).

    paper_id 故意不存 — 同一 question 在多套卷里出现时, 笔记只有一份;
    "在哪场练习写的"是 audit 信息, 走 created_at 时序就够, 不需要列.
    """

    __tablename__ = "question_notes"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_question_notes_user_question"),
        Index("ix_question_notes_user_question", "user_id", "question_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class Note(Base):
    """SIKAO Wave 4 Phase 2B (notebook module): 跨领域笔记池.

    跟 QuestionNote (0014, 题级 markdown) 是 **不同概念**:
      - QuestionNote: 一题一行 markdown (粒度 = question level).
      - Note:        用户自由创建 N 张卡 (粒度 = user level, 4 类 NoteType
                     跨题型沉淀: quote/method/reflect/material).
    两套并存, 不合并.

    type 字面量: 'quote' | 'method' | 'reflect' | 'material'.
    body_json shape discriminated by type:
      quote    -> { text: str }
      method   -> { title: str, steps: [{ index: str, text: str }] }
      reflect  -> { text: str }
      material -> { rows: [{ key: str, value: str }] }

    source_domain 字面量: 'xingce' | 'essay' (跨领域决策 §1, 单池 + filter).
    source_kind 字面量: 'paper' | 'specialty' | 'manual' | 'practice' | 'grading'.

    attached_to optional, 跟错题 bridge: { wrongAnswerIds?, questionTypeIds?,
    xingceQuestionIds?, paperIds? }. P0/P1 用 JSONB containment 查; P3 量大抽 m2m.

    SM-2 spaced repetition 字段:
      - ease            current ease factor (default 2.5, min 1.3).
      - review_count    历史 review 次数.
      - next_review_at  下次 review 时间 (today queue ORDER BY 锚点).
      - reviewed_at     最近一次 review 时间.

    user 删走 CASCADE — 笔记 PII 删账户带走.
    """

    __tablename__ = "notes"
    __table_args__ = (
        Index("ix_notes_user_type", "user_id", "type"),
        Index("ix_notes_user_source_domain", "user_id", "source_domain"),
        Index("ix_notes_user_next_review", "user_id", "next_review_at"),
        Index("ix_notes_user_created", "user_id", "created_at"),
        # SIKAO Wave 10 Phase A (0022): 单题视图 "公开笔记 top voted" 主索引.
        Index(
            "ix_notes_question_public_likes",
            "question_id",
            "is_public",
            "likes_count",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    body_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    source_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    source_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    source_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_domain: Mapped[str] = mapped_column(String(8), nullable=False)
    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    attached_to: Mapped[dict | None] = mapped_column(JSONB_COMPAT, nullable=True)
    visibility: Mapped[str] = mapped_column(String(8), default="self", nullable=False)
    ease: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # SIKAO Wave 10 Phase A (0022): 笔记本社交化 6 字段. is_public 跟 visibility
    # 语义独立: visibility ('self'|'group') 是 P3 组内分享, is_public 是 "发表到
    # 题目下方公开池". display_anonymous 默认 true (lhr 决议, 隐私优先).
    # likes_count / comments_count 是服务端缓存 (note_likes/note_comments 表
    # 增删时同 transaction 维护, 避免每次 GET 笔记列表 COUNT() join).
    # question_id NULLABLE: 笔记可不绑题 (跨题型 method/quote 仍能公开但不挂题).
    # SET NULL: 删 question 不删笔记 (笔记落孤, 仍在用户笔记本里).
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    public_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    display_anonymous: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    reviews: Mapped[list[NoteReview]] = relationship(
        "NoteReview",
        back_populates="note",
        cascade="all, delete-orphan",
        order_by="NoteReview.reviewed_at",
    )
    # SIKAO Wave 10 Phase A (0022): 社交化反向关系. 删 note CASCADE 带走 comments
    # / likes / favorites. note_reports 跟 note 是 polymorphic (target_type+id),
    # 不在此 ORM 强约束, Phase B service 删 note 时显式清理对应 reports.
    comments: Mapped[list[NoteComment]] = relationship(
        "NoteComment",
        back_populates="note",
        cascade="all, delete-orphan",
    )
    likes: Mapped[list[NoteLike]] = relationship(
        "NoteLike",
        back_populates="note",
        cascade="all, delete-orphan",
    )
    favorites: Mapped[list[NoteFavorite]] = relationship(
        "NoteFavorite",
        back_populates="note",
        cascade="all, delete-orphan",
    )


class NoteReview(Base):
    """SIKAO Wave 4 Phase 2B — Note review history (SM-2 audit).

    每一次 user 对某 note 反馈 quality (0-5), 走 SM-2 算法重算 ease + interval +
    next_review_at, 同时一行 audit. notes 表本身只存 current 值, 不堆历史.

    user_id denormalized for streak query 速度 (聚 GROUP BY user_id + DATE).
    note 走 CASCADE: 删 note 带走所有 review audit. user 走 CASCADE: 删账户清.

    recall_quality 字面量 0-5 (SM-2 standard):
      0 = blackout (完全不记得)
      1 = wrong (记错)
      2 = wrong but familiar (错但有印象)
      3 = correct with difficulty (对但费劲)
      4 = correct (对)
      5 = perfect (轻松对)
    业务层 clamp 0-5; <3 reset interval=1, ≥3 走 SM-2 公式.
    """

    __tablename__ = "note_reviews"
    __table_args__ = (
        Index("ix_note_reviews_note", "note_id"),
        Index("ix_note_reviews_user_reviewed", "user_id", "reviewed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    recall_quality: Mapped[int] = mapped_column(Integer, nullable=False)
    ease_before: Mapped[float] = mapped_column(Float, nullable=False)
    ease_after: Mapped[float] = mapped_column(Float, nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False)
    next_review_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    note: Mapped[Note] = relationship("Note", back_populates="reviews")


class UserGoal(Base):
    """Phase 5.5 (fenbi-merge) — 用户备考目标分.

    单 row per user (UNIQUE on user_id). MVP 只存 target_score 总分;
    module_targets / exam_track 推 follow-up. 老 user 没 row → service
    返 has_goal=False, 前端引导用户设. PUT 用 upsert 语义 (insert or update).
    """

    __tablename__ = "user_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    target_score: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class UserExam(Base):
    """SIKAO Wave 8 Phase A (0021) — 用户自定义考试 (Home block 1 "我的考试").

    跟 ExamEvent (admin 维护的全局考试日历) 互补:
      - ExamEvent: 全局公告 (国考 / 省考 / ...), admin CRUD.
      - UserExam : 用户自己加的 "我要考的 N 场" (考公 + 考研 + 单位 special).

    exam_event_id (SET NULL) 让用户从 ExamEvent 库选 (auto-fill name/date)
    也允许纯手填 (设 None). 删 event 不删 user_exam — 用户记录保留, 仅丢联动.

    study_plan_id (SET NULL) 让用户给某场考试绑专属计划; Phase B service
    /sync 时维护. 删计划不删考试.
    """

    __tablename__ = "user_exams"
    __table_args__ = (
        Index("ix_user_exams_user_date", "user_id", "exam_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exam_event_id: Mapped[int | None] = mapped_column(
        ForeignKey("exam_events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    study_plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("study_plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    user: Mapped[User] = relationship(back_populates="user_exams")
    exam_event: Mapped[ExamEvent | None] = relationship()
    study_plan: Mapped[StudyPlan | None] = relationship()


# ── SIKAO Wave 10 Phase A (0022) — 笔记本社交化 4 新表 ──────────────────────
# notes 扩 6 字段 + 这 4 张表组成 "题目下方公开笔记" + "评论一级嵌套" +
# "点赞" + "收藏" + "举报 admin queue" 完整能力. Phase B (service / endpoint)
# 复用. 详 alembic/versions/0022_note_social_features.py docstring.


class NoteComment(Base):
    """SIKAO Wave 10 Phase A (0022) — 一级嵌套评论.

    parent_comment_id NULLABLE: 顶层 comment NULL; 回复某 comment 带 parent_id.
    不允许 grand-child (2+ 级), Phase B service 校验 (parent.parent_id IS NOT
    NULL 时拒绝 create). likes_count 是缓存, 后续 comment 级 like 表落地 (Wave
    10 暂不做).

    user / note 走 CASCADE — 删账户 / 删笔记带走 comment (PII + 数据完整).
    """

    __tablename__ = "note_comments"
    __table_args__ = (
        Index("ix_note_comments_note", "note_id"),
        Index("ix_note_comments_user", "user_id"),
        Index("ix_note_comments_parent", "parent_comment_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    parent_comment_id: Mapped[int | None] = mapped_column(
        ForeignKey("note_comments.id", ondelete="CASCADE"), nullable=True
    )
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    note: Mapped[Note] = relationship("Note", back_populates="comments")


class NoteLike(Base):
    """SIKAO Wave 10 Phase A (0022) — 笔记点赞.

    UNIQUE (note_id, user_id) 一个用户对一条笔记最多一个 like. Phase B
    service 走 INSERT ... ON CONFLICT DO NOTHING (PG) / INSERT OR IGNORE
    (SQLite) 实现 toggle, 同 transaction 维护 notes.likes_count +/-1.

    CASCADE: 删 note / 删 user 带走 like 行 (不留孤 PII).
    """

    __tablename__ = "note_likes"
    __table_args__ = (
        UniqueConstraint("note_id", "user_id", name="uq_note_likes_note_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )

    note: Mapped[Note] = relationship("Note", back_populates="likes")


class NoteFavorite(Base):
    """SIKAO Wave 10 Phase A (0022) — 笔记收藏.

    跟 NoteLike 同模式: UNIQUE (note_id, user_id), CASCADE on note/user 删除.
    收藏 vs 点赞语义差: like 是 "认可" (公开计数显示), favorite 是 "我要回看"
    (私人 bookmark, 在 "我的收藏" 列表里聚合). 不维护 notes.favorites_count
    缓存 (FE "我的收藏" 列表走 user_id 过滤直接 JOIN, 不需总数).
    """

    __tablename__ = "note_favorites"
    __table_args__ = (
        UniqueConstraint(
            "note_id", "user_id", name="uq_note_favorites_note_user"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )

    note: Mapped[Note] = relationship("Note", back_populates="favorites")


class NoteReport(Base):
    """SIKAO Wave 10 Phase A (0022) — 举报 admin queue.

    target_type ∈ {'note', 'comment'} polymorphic: target_id 在 'note' 时引
    notes.id, 'comment' 时引 note_comments.id. SA 不能强约束 polymorphic FK,
    Phase B service create 时显式校验 target 存在.

    status ∈ {'pending', 'reviewed', 'dismissed'}, admin /admin/reports queue
    走 WHERE status='pending' ORDER BY created_at ASC. reviewed_by_admin_id
    SET NULL 删 admin 不删 report (审计保留). reporter_user_id CASCADE:
    举报人删账户带走 report (PII).
    """

    __tablename__ = "note_reports"
    __table_args__ = (
        Index("ix_note_reports_target", "target_id"),
        Index("ix_note_reports_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)
    reporter_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )
    reviewed_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )
