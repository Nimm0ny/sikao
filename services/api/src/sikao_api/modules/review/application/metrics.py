from __future__ import annotations

from threading import RLock
from time import monotonic

from opentelemetry import metrics


_meter = metrics.get_meter("sikao_api.review")

_mastery_counter = _meter.create_counter(
    "review_srs_mastery_transitions_total",
    description="Review mastery transitions (probation_entered / graduated).",
)
_archived_counter = _meter.create_counter(
    "review_item_archived_total",
    description="Archived review items.",
)
_restored_counter = _meter.create_counter(
    "review_item_restored_total",
    description="Restored review items.",
)
_cause_requests_counter = _meter.create_counter(
    "review_cause_analysis_requests_total",
    description="Review cause-analysis requests.",
)
_cause_cache_hits_counter = _meter.create_counter(
    "review_cause_analysis_cache_hits_total",
    description="Review cause-analysis cache hits.",
)
_cause_failures_counter = _meter.create_counter(
    "review_cause_analysis_failures_total",
    description="Review cause-analysis failures.",
)
_cause_taxonomy_fallback_counter = _meter.create_counter(
    "cause_taxonomy_other_fallback_total",
    description="Cause taxonomy fallback-to-other events.",
)
_weekly_snapshot_counter = _meter.create_counter(
    "review_weekly_snapshots_generated_total",
    description="Generated review weekly snapshots.",
)
_cause_duration_histogram = _meter.create_histogram(
    "review_cause_analysis_duration_ms",
    unit="ms",
    description="Review cause-analysis duration.",
)

_snapshot_lock = RLock()
_snapshot: dict[str, int] = {}


def reset_review_metric_snapshot() -> None:
    with _snapshot_lock:
        _snapshot.clear()


def get_review_metric_snapshot() -> dict[str, int]:
    with _snapshot_lock:
        return dict(_snapshot)


def increment_mastery_transition(*, outcome: str) -> None:
    _mastery_counter.add(1, attributes={"outcome": outcome})
    _record("review_srs_mastery_transitions_total")


def increment_archived() -> None:
    _archived_counter.add(1)
    _record("review_item_archived_total")


def increment_restored() -> None:
    _restored_counter.add(1)
    _record("review_item_restored_total")


def increment_cause_request(*, scope: str, mode: str) -> None:
    _cause_requests_counter.add(1, attributes={"scope": scope, "mode": mode})
    _record("review_cause_analysis_requests_total")


def increment_cause_cache_hit(*, scope: str, mode: str) -> None:
    _cause_cache_hits_counter.add(1, attributes={"scope": scope, "mode": mode})
    _record("review_cause_analysis_cache_hits_total")


def increment_cause_failure(*, scope: str, mode: str, error_type: str) -> None:
    _cause_failures_counter.add(1, attributes={"scope": scope, "mode": mode, "error_type": error_type})
    _record("review_cause_analysis_failures_total")


def increment_cause_taxonomy_other_fallback() -> None:
    _cause_taxonomy_fallback_counter.add(1)
    _record("cause_taxonomy_other_fallback_total")


def increment_weekly_snapshot_generated() -> None:
    _weekly_snapshot_counter.add(1)
    _record("review_weekly_snapshots_generated_total")


def observe_cause_duration_ms(*, scope: str, mode: str, started_at: float) -> int:
    duration_ms = int((monotonic() - started_at) * 1000)
    _cause_duration_histogram.record(duration_ms, attributes={"scope": scope, "mode": mode})
    return duration_ms


def _record(name: str) -> None:
    with _snapshot_lock:
        _snapshot[name] = _snapshot.get(name, 0) + 1
