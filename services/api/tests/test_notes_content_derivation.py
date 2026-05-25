from __future__ import annotations

from sikao_api.modules.notes_v2.domain.body_extractor import extract_text, extract_word_count
from sikao_api.modules.notes_v2.domain.content_hash import compute_content_hash


def test_extract_text_handles_heading_paragraph_and_image_alt() -> None:
    body_json = {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "排列组合公式"}],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "捆绑法适用于相邻约束。"}],
            },
            {
                "type": "image",
                "attrs": {"src": "/uploads/notes/demo.png", "alt": "公式图"},
            },
        ],
    }

    extracted = extract_text(body_json)

    assert "排列组合公式" in extracted
    assert "捆绑法适用于相邻约束。" in extracted
    assert "公式图" in extracted


def test_extract_word_count_counts_cjk_and_non_cjk_content() -> None:
    body_text = "数量关系 formula summary"

    count = extract_word_count(body_text)

    assert count == 6


def test_compute_content_hash_is_stable_and_changes_on_content_change() -> None:
    body_json = {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "A"}]}],
    }
    equivalent = {
        "content": [{"content": [{"text": "A", "type": "text"}], "type": "paragraph"}],
        "type": "doc",
    }
    changed = {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "B"}]}],
    }

    first = compute_content_hash(body_json)
    second = compute_content_hash(equivalent)
    third = compute_content_hash(changed)

    assert first == second
    assert first != third
    assert len(first) == 64
