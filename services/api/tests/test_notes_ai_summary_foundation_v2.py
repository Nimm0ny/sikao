from __future__ import annotations

from sikao_api.modules.review.application.validators import validate_review_item_source_contract
from sikao_api.modules.system.application.errors import ValidationError


def test_notes_ai_summary_foundation_note_card_requires_source_note_id() -> None:
    validate_review_item_source_contract(
        source_kind="note_card",
        question_id=None,
        metadata_json={"source_note_id": 42, "card_text": "捆绑法适用于相邻约束"},
    )

    try:
        validate_review_item_source_contract(
            source_kind="note_card",
            question_id=None,
            metadata_json={"note_id": 42, "card_text": "bad field name"},
        )
    except ValidationError:
        return
    raise AssertionError("note_card metadata must use source_note_id instead of note_id")
