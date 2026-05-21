from __future__ import annotations

import argparse
from datetime import date, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from sikao_api.db.models import StudyPlan
from sikao_api.db.models_v2 import DailyPlanItemV2, DailyPlanV2, UserV2, WeeklyPlanV2
from sikao_api.scripts.backfill_v2_common import (
    BackfillStats,
    add_common_args,
    commit_or_rollback,
    iter_with_limit,
    legacy_public_id,
    open_session,
)


def week_start(plan_date):
    return plan_date - timedelta(days=plan_date.weekday())


def _week_end(week_start_date: date) -> date:
    return week_start_date + timedelta(days=6)


def _count_legacy_week_days(session, *, legacy_user_id: int, monday: date) -> int:
    return int(
        session.scalar(
            select(func.count())
            .select_from(StudyPlan)
            .where(
                StudyPlan.user_id == legacy_user_id,
                StudyPlan.plan_date >= monday,
                StudyPlan.plan_date <= _week_end(monday),
            )
        )
        or 0
    )


def _load_migrated_week_plan_ids(session, *, user_id: int, monday: date) -> list[int]:
    return list(
        session.scalars(
            select(DailyPlanV2.id)
            .where(
                DailyPlanV2.user_id == user_id,
                DailyPlanV2.plan_date >= monday,
                DailyPlanV2.plan_date <= _week_end(monday),
            )
            .order_by(DailyPlanV2.plan_date.asc(), DailyPlanV2.id.asc())
        )
    )


def _build_week_summary(
    session,
    *,
    user_id: int,
    monday: date,
) -> dict[str, int] | None:
    daily_plan_ids = _load_migrated_week_plan_ids(session, user_id=user_id, monday=monday)
    if not daily_plan_ids:
        return None
    total_items = int(
        session.scalar(
            select(func.count())
            .select_from(DailyPlanItemV2)
            .where(DailyPlanItemV2.daily_plan_id.in_(daily_plan_ids))
        )
        or 0
    )
    completed_items = int(
        session.scalar(
            select(func.count())
            .select_from(DailyPlanItemV2)
            .where(
                DailyPlanItemV2.daily_plan_id.in_(daily_plan_ids),
                DailyPlanItemV2.state == "completed",
            )
        )
        or 0
    )
    return {
        "dailyPlanCount": len(daily_plan_ids),
        "totalItems": total_items,
        "completedItems": completed_items,
    }


def run(*, database_url: str | None, dry_run: bool, limit: int | None) -> int:
    session, _db = open_session(database_url=database_url)
    stats = BackfillStats()
    try:
        plans = list(
            session.scalars(
                select(StudyPlan)
                .options(selectinload(StudyPlan.tasks))
                .order_by(StudyPlan.plan_date.asc(), StudyPlan.id.asc())
            )
        )
        affected_weeks: set[tuple[int, int, date]] = set()

        for legacy_plan in iter_with_limit(plans, limit=limit):
            stats.scanned += 1
            user_v2 = session.scalar(
                select(UserV2).where(
                    UserV2.public_id == legacy_public_id(legacy_plan.user_id)
                )
            )
            if user_v2 is None:
                stats.conflicts += 1
                continue

            daily_plan = session.scalar(
                select(DailyPlanV2).where(
                    DailyPlanV2.user_id == user_v2.id,
                    DailyPlanV2.plan_date == legacy_plan.plan_date,
                )
            )
            if daily_plan is None:
                daily_plan = DailyPlanV2(
                    user_id=user_v2.id,
                    plan_date=legacy_plan.plan_date,
                    status=legacy_plan.generation_status,
                    created_at=legacy_plan.created_at,
                    updated_at=legacy_plan.updated_at,
                )
                session.add(daily_plan)
                session.flush()
                stats.inserted += 1
            else:
                daily_plan.status = legacy_plan.generation_status
                daily_plan.updated_at = legacy_plan.updated_at
                session.add(daily_plan)
                stats.updated += 1

            session.execute(
                delete(DailyPlanItemV2).where(
                    DailyPlanItemV2.daily_plan_id == daily_plan.id
                )
            )
            for task in sorted(legacy_plan.tasks, key=lambda item: item.display_order):
                session.add(
                    DailyPlanItemV2(
                        daily_plan_id=daily_plan.id,
                        item_kind=task.task_kind,
                        title=str(task.payload_json.get("title", "")),
                        summary=str(task.payload_json.get("subtitle") or ""),
                        state=task.status,
                        display_order=task.display_order,
                        metadata_json={
                            "payload": task.payload_json,
                            "resultPayload": task.result_payload,
                            "legacyTaskId": task.id,
                        },
                    )
                )

            affected_weeks.add(
                (
                    legacy_plan.user_id,
                    user_v2.id,
                    week_start(legacy_plan.plan_date),
                )
            )

        session.flush()

        for legacy_user_id, user_id, monday in sorted(affected_weeks):
            legacy_count = _count_legacy_week_days(
                session,
                legacy_user_id=legacy_user_id,
                monday=monday,
            )
            migrated_plan_ids = _load_migrated_week_plan_ids(
                session,
                user_id=user_id,
                monday=monday,
            )
            if len(migrated_plan_ids) != legacy_count:
                stats.skipped += 1
                continue

            summary = _build_week_summary(session, user_id=user_id, monday=monday)
            if summary is None:
                continue
            weekly_plan = session.scalar(
                select(WeeklyPlanV2).where(
                    WeeklyPlanV2.user_id == user_id,
                    WeeklyPlanV2.week_start == monday,
                )
            )
            if weekly_plan is None:
                weekly_plan = WeeklyPlanV2(
                    user_id=user_id,
                    week_start=monday,
                    status="ready",
                    summary_json=summary,
                )
                session.add(weekly_plan)
            else:
                weekly_plan.summary_json = summary
                weekly_plan.status = "ready"
                session.add(weekly_plan)

        commit_or_rollback(session, dry_run=dry_run)
    finally:
        session.close()
    stats.emit(scope="planning", dry_run=dry_run)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="backfill_v2_planning",
        description="Backfill legacy study_plans into daily/weekly v2 tables.",
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
