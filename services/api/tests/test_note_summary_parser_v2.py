from __future__ import annotations

import pytest

from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError
from sikao_api.modules.llm.application.parsers.note_summary_parser import (
    NoteSummaryOutput,
    parse_note_summary_output,
)


def test_parse_note_summary_output_accepts_valid_cards() -> None:
    parsed = parse_note_summary_output(
        """
        {
          "cards": [
            {"text": "捆绑法适用于相邻约束"},
            {"text": "插空法适用于不相邻约束"}
          ]
        }
        """
    )
    assert isinstance(parsed, NoteSummaryOutput)
    assert [card.text for card in parsed.cards] == [
        "捆绑法适用于相邻约束",
        "插空法适用于不相邻约束",
    ]


def test_parse_note_summary_output_rejects_empty_or_oversized_card_sets() -> None:
    with pytest.raises(Exception):
        parse_note_summary_output('{"cards": []}')
    with pytest.raises(Exception):
        parse_note_summary_output(
            '{"cards":[{"text":"a"},{"text":"b"},{"text":"c"},{"text":"d"}]}'
        )


def test_parse_note_summary_output_rejects_invalid_json() -> None:
    with pytest.raises(LlmJsonParseError):
        parse_note_summary_output("not json at all")
