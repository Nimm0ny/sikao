from __future__ import annotations

from datetime import UTC, datetime

from sikao_api.db.schemas_v2 import ActionLinkV2, OperationAckV2, OverviewResponseV2, ReviewDetailResponseV2, ReviewItemV2, ReviewListResponseV2, SectionCardV2, SummaryMetricV2


def build_review_list() -> ReviewListResponseV2:
    return ReviewListResponseV2(items=[], total=0, page=1, page_size=20)


def build_smart_review() -> OverviewResponseV2:
    return OverviewResponseV2(
        summary=[SummaryMetricV2(key="smart", label="Smart review", value="empty")],
        sections=[SectionCardV2(key="smart", title="智能复盘", description="Phase 1 review skeleton.", status="empty", href="/wrong-book/smart-review")],
        actions=[ActionLinkV2(key="wrong-book", label="错题本", href="/wrong-book")],
    )


def build_review_detail(item_id: int) -> ReviewDetailResponseV2:
    now = datetime.now(UTC).replace(tzinfo=None)
    item = ReviewItemV2(
        id=item_id,
        kind="placeholder",
        title=f"review-item-{item_id}",
        status="empty",
        href=f"/wrong-book/{item_id}",
        created_at=now,
    )
    return ReviewDetailResponseV2(
        item=item,
        history=[],
        actions=[ActionLinkV2(key="redo", label="错题重做", href=f"/wrong-book/{item_id}/redo")],
    )


def build_redo_ack() -> OperationAckV2:
    return OperationAckV2(ok=True, status="accepted")
