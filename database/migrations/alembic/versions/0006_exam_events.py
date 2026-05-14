"""Phase 7 ARCH §7.3 P3 (KEY OBS #5): exam_events table for admin-managed
exam calendar.

替前端 hardcoded `EXAM_EVENTS` list (frontend/src/lib/exam-calendar.ts).
admin 通过 /api/v2/admin/exam-events CRUD 维护, 前端 GET /api/v2/exam-events
拉 visible 的 events 渲染日历 view.

Inline seed: 把现有 frontend hardcoded 3 个 entries (2026 国考 / 2027 多省
联考 / 2027 国考) 同步迁过来, 投产即生效不空表.
"""

from __future__ import annotations

from datetime import date

import sqlalchemy as sa
from alembic import op


revision = "0006_exam_events"
down_revision = "0005_rename_paper_position_to_display_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exam_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(length=60), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("exam_date", sa.Date(), nullable=False),
        sa.Column("registration_start", sa.Date(), nullable=True),
        sa.Column("registration_end", sa.Date(), nullable=True),
        sa.Column(
            "precision", sa.String(length=20), nullable=False, server_default="estimate"
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("slug", name="uq_exam_events_slug"),
    )
    op.create_index("ix_exam_events_slug", "exam_events", ["slug"])
    op.create_index(
        "ix_exam_events_visible_date", "exam_events", ["visible", "exam_date"]
    )

    # Inline seed — 跟前端 hardcoded 3 entries 一致, 投产后用户立即看到日历.
    # admin 之后通过 CRUD endpoint 改 / 加 / 删.
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "INSERT INTO exam_events "
            "(slug, name, category, exam_date, registration_start, registration_end, "
            " precision, notes, visible) "
            "VALUES "
            "(:slug, :name, :category, :exam_date, :reg_start, :reg_end, "
            " :precision, :notes, :visible)"
        ),
        [
            {
                "slug": "national-2026",
                "name": "2026 国考 (中央机关)",
                "category": "national",
                "exam_date": date(2026, 12, 6),
                "reg_start": date(2026, 10, 15),
                "reg_end": date(2026, 10, 24),
                "precision": "estimate",
                "notes": "12 月第 1 个周日笔试 (按往年规律), 公告 10 月中旬",
                "visible": True,
            },
            {
                "slug": "provincial-2027-spring",
                "name": "2027 多省联考",
                "category": "provincial",
                "exam_date": date(2027, 3, 21),
                "reg_start": None,
                "reg_end": None,
                "precision": "estimate",
                "notes": "3 月最后一个周日笔试 (估), 各省公告 1-2 月发",
                "visible": True,
            },
            {
                "slug": "national-2027",
                "name": "2027 国考 (中央机关)",
                "category": "national",
                "exam_date": date(2027, 12, 5),
                "reg_start": None,
                "reg_end": None,
                "precision": "estimate",
                "notes": "按往年规律推算",
                "visible": True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_exam_events_visible_date", table_name="exam_events")
    op.drop_index("ix_exam_events_slug", table_name="exam_events")
    op.drop_table("exam_events")
