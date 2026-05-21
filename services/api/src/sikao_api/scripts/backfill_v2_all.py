from __future__ import annotations

import argparse

from sikao_api.scripts.backfill_v2_content import run as run_content
from sikao_api.scripts.backfill_v2_identity import run as run_identity
from sikao_api.scripts.backfill_v2_planning import run as run_planning
from sikao_api.scripts.backfill_v2_session import run as run_session


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="backfill_v2_all",
        description="Run identity/content/planning V2 backfills in fixed order.",
    )
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    run_identity(
        database_url=args.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    run_content(
        database_url=args.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    run_planning(
        database_url=args.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    run_session(
        database_url=args.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
