from __future__ import annotations

import json
from pathlib import Path

from sikao_api.main import create_app


REPO_ROOT = Path(__file__).resolve().parents[3]
OPENAPI_SPEC_PATH = REPO_ROOT / "services" / "api" / "spec" / "openapi.json"


def test_checked_in_openapi_matches_live_app_for_review_backend_gate() -> None:
    checked_in = json.loads(OPENAPI_SPEC_PATH.read_text(encoding="utf-8"))
    live_schema = create_app().openapi()

    assert checked_in == live_schema

    paths = checked_in["paths"]
    assert "/api/v2/review/items" in paths
    assert "/api/v2/review/items/{item_id}/attempt" in paths
    assert "/api/v2/review/items/{item_id}/cause-analysis" in paths
    assert "/api/v2/review/cause-analysis/group" in paths
    assert "/api/v2/review/cause-analysis/{analysis_id}/feedback" in paths
    assert "/api/v2/review/cause-tags" in paths
    assert "/api/v2/review/weekly-summary" in paths
    assert "/api/v2/review/insights/trends" in paths
    assert "/api/v2/review/insights/causes" in paths
    assert "/api/v2/review/insights/redo-accuracy" in paths
    assert "/api/v2/review/debt/snapshot" in paths
    assert "/api/v2/review/debt/plan" in paths
    assert "/api/v2/review/debt/redistribute" in paths
    assert "/api/v2/review/debt/skip-rampup" in paths
    assert "/api/v2/review/items/{item_id}/add-to-plan" in paths
    assert "/api/v2/notes" in paths
    assert "/api/v2/notes/{note_id}" in paths
    assert "/api/v2/notes/tags" in paths
    assert "/api/v2/notes/tags/rename" in paths
    assert "/api/v2/notes/tags/merge" in paths
    assert "/api/v2/notes/{note_id}/tags" in paths
    assert "/api/v2/notes/{note_id}/tags/{tag_name}" in paths
    assert "/api/v2/notes/images" in paths
    assert "/api/v2/notes/search" in paths
    assert "/api/v2/notes/{note_id}/visibility" in paths
    assert "/api/v2/notes/community" in paths
    assert "/api/v2/notes/{note_id}/export" in paths
    assert "/api/v2/notes/{note_id}/ai-summary" in paths
    assert "/api/v2/notes/{note_id}/ai-summary/confirm" in paths
    assert "/api/v2/notes/weekly-review/generate" in paths
    assert {"get", "post"} <= set(paths["/api/v2/notes"])
    assert {"get", "put", "delete"} <= set(paths["/api/v2/notes/{note_id}"])
    assert {"get"} <= set(paths["/api/v2/notes/tags"])
    assert {"patch"} <= set(paths["/api/v2/notes/tags/rename"])
    assert {"post"} <= set(paths["/api/v2/notes/tags/merge"])
    assert {"post"} <= set(paths["/api/v2/notes/{note_id}/tags"])
    assert {"delete"} <= set(paths["/api/v2/notes/{note_id}/tags/{tag_name}"])
    assert {"post"} <= set(paths["/api/v2/notes/images"])
    assert {"get"} <= set(paths["/api/v2/notes/search"])
    assert {"patch"} <= set(paths["/api/v2/notes/{note_id}/visibility"])
    assert {"get"} <= set(paths["/api/v2/notes/community"])
    assert {"get"} <= set(paths["/api/v2/notes/{note_id}/export"])
    assert {"post"} <= set(paths["/api/v2/notes/{note_id}/ai-summary"])
    assert {"post"} <= set(paths["/api/v2/notes/{note_id}/ai-summary/confirm"])
    assert {"post"} <= set(paths["/api/v2/notes/weekly-review/generate"])


def test_openapi_includes_review_debt_and_profile_contract_shapes() -> None:
    checked_in = json.loads(OPENAPI_SPEC_PATH.read_text(encoding="utf-8"))
    schemas = checked_in["components"]["schemas"]

    assert "ReviewDebtSnapshotResponseV2" in schemas
    assert "ReviewDebtPlanResponseV2" in schemas

    debt_snapshot = schemas["ReviewDebtSnapshotResponseV2"]["properties"]
    assert {
        "debtSeverity",
        "overdueCount",
        "oldestOverdueDays",
        "dailyLimit",
        "recommendedTodayCount",
        "redistributedCount",
        "rampupPhase",
        "rampupStartedAt",
        "rampupUnlockAt",
        "rampupActive",
        "canRedistribute",
    } <= set(debt_snapshot)

    profile_info = schemas["ProfileInfoResponseV2"]["properties"]
    assert {
        "reviewDailyLimit",
        "reviewDebtRedistributeEnabled",
        "reviewRampupEnabled",
        "reviewHardQuestionAutoDeepAnalysis",
    } <= set(profile_info)

    cause_request_mode = schemas["CauseAnalysisRequestV2"]["properties"]["mode"]
    assert {"single", "forced", "deep"} <= set(cause_request_mode["enum"])

    assert "CommunityNoteListResponseV2" in schemas
    assert "CommunityNoteItemV2" in schemas
    assert "NoteVisibilityUpdateRequestV2" in schemas
    assert "NoteVisibilityUpdateResponseV2" in schemas

    community_feed = schemas["CommunityNoteItemV2"]["properties"]
    assert {
        "id",
        "title",
        "bodyPreview",
        "wordCount",
        "authorName",
        "tags",
        "linkedQuestionId",
        "reactionCount",
        "commentCount",
        "isFeatured",
        "createdAt",
    } <= set(community_feed)
