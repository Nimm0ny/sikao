from __future__ import annotations

import pytest
from pydantic import ValidationError as PydanticValidationError

from sikao_api.modules.llm.application.plan_generator import parse_generated_plan
from sikao_api.modules.llm.application.recommender import parse_recommendations


def test_recommendation_parser_accepts_bailian_shape() -> None:
    parsed = parse_recommendations(
        """{
          "recommendations": [
            {
              "title": "Review weak items first",
              "description": "You just submitted a session, so review is the best next action.",
              "estimatedMinutes": 20,
              "actionType": "review",
              "ctaLabel": "Review",
              "payload": {}
            }
          ]
        }"""
    )
    item = parsed.recommendations[0]
    assert item.reason.startswith("You just submitted")
    assert item.estimated_minutes == 20
    assert item.cta == "Review"
    assert item.payload == {}


def test_recommendation_parser_rejects_missing_required_fields() -> None:
    with pytest.raises(PydanticValidationError):
        parse_recommendations(
            """{
              "recommendations": [
                {
                  "title": "Review weak items first",
                  "description": "You just submitted a session, so review is the best next action.",
                  "action_type": "review"
                }
              ]
            }"""
        )


def test_recommendation_parser_rejects_missing_payload() -> None:
    with pytest.raises(PydanticValidationError):
        parse_recommendations(
            """{
              "recommendations": [
                {
                  "title": "Review weak items first",
                  "reason": "You just submitted a session, so review is the best next action.",
                  "estimated_minutes": 20,
                  "action_type": "review",
                  "cta": "Review"
                }
              ]
            }"""
        )


def test_recommendation_parser_rejects_long_cta() -> None:
    with pytest.raises(PydanticValidationError):
        parse_recommendations(
            """{
              "recommendations": [
                {
                  "title": "Review weak items first",
                  "reason": "You just submitted a session, so review is the best next action.",
                  "estimated_minutes": 20,
                  "action_type": "review",
                  "cta": "Review weak spots",
                  "payload": {}
                }
              ]
            }"""
        )


def test_plan_parser_accepts_bailian_start_end_aliases() -> None:
    parsed = parse_generated_plan(
        """{
          "events": [
            {
              "title": "Essay review",
              "category": "essay",
              "subject": "essay",
              "start": "2026-06-02T19:00:00+08:00",
              "end": "2026-06-02T20:00:00+08:00",
              "description": "Refine outline and evidence.",
              "targetId": null
            }
          ],
          "summary": {"total_minutes": 60},
          "errors": []
        }"""
    )
    event = parsed.events[0]
    assert event.start_at.isoformat() == "2026-06-02T19:00:00+08:00"
    assert event.end_at.isoformat() == "2026-06-02T20:00:00+08:00"
    assert event.notes == "Refine outline and evidence."
