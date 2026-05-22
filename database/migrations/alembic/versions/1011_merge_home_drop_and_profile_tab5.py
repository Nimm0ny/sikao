"""Merge dual heads from Phase-Home M3 drop and Phase-Profile Tab5 deletion.

Two unrelated migrations were authored in parallel and both pointed back to
1009_home_practice_session_occurrence_ref:

  - 1010_home_drop_daily_weekly_planning_v2  (Home M3: drop legacy plan tables)
  - 1010_profile_tab5_account_deletion       (Profile Tab5: soft-delete columns
                                              + account_deletion_jobs_v2)

The two migrations are semantically independent (different table sets, no FK
overlap), so a no-op merge migration is the correct alembic-native fix. After
this revision lands, `alembic upgrade head` resolves cleanly to a single head
which downstream Stream A migrations (1012+) can chain against.

This migration is intentionally empty (no schema changes); both upgrade() and
downgrade() are no-ops.
"""

from __future__ import annotations

revision = "1011_merge_home_drop_and_profile_tab5"
down_revision = (
    "1010_home_drop_daily_weekly_planning_v2",
    "1010_profile_tab5_account_deletion",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
