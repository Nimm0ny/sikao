"""Unit tests for `_rewrite_asset_urls` helper in `sikao_api.modules.question_bank.application.exam_papers`.

Why a dedicated unit test file: the helper is a pure string transform that
runs on every question read. Keeping its tests isolated from the integration
test suite (test_exam_api.py) makes regressions trivial to localize and the
helper trivial to extend (e.g. when fenbi data starts emitting single-quoted
src or other img attributes).

Reason this exists: 2026-04-26 E2E found that question stems shipped raw
fenbi HTML (`<img src="assets/0007_xxx.png">`) which the browser resolves
against the page URL → 404. The helper rewrites these to the public asset
endpoint URL so `<img>` tags load directly without any frontend change.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import pytest

from sikao_api.modules.question_bank.application.exam_papers import _rewrite_asset_urls


@dataclass
class FakeAsset:
    id: int
    file_path: str


def test_rewrite_single_img_in_stem() -> None:
    assets = [FakeAsset(id=42, file_path="/abs/path/0007_53394c904c959157.png")]
    html = '<p>题干文本</p><p><img width="600px" src="assets/0007_53394c904c959157.png" /></p>'

    result = _rewrite_asset_urls(html, assets)

    assert result == (
        '<p>题干文本</p><p><img width="600px" src="/api/v2/assets/questions/42" /></p>'
    )


def test_rewrite_multi_imgs_in_explanation() -> None:
    assets = [
        FakeAsset(id=10, file_path="/whatever/0001_aaaa.png"),
        FakeAsset(id=11, file_path="/whatever/0002_bbbb.png"),
    ]
    html = (
        '解析：第一图 <img src="assets/0001_aaaa.png" /> '
        '第二图 <img src="assets/0002_bbbb.png" />。'
    )

    result = _rewrite_asset_urls(html, assets)

    assert '<img src="/api/v2/assets/questions/10" />' in result
    assert '<img src="/api/v2/assets/questions/11" />' in result
    assert "assets/0001_aaaa.png" not in result
    assert "assets/0002_bbbb.png" not in result


def test_rewrite_skips_unknown_basename(caplog: pytest.LogCaptureFixture) -> None:
    """basename 在 assets[] 找不到时 fail-soft：保留原 src + WARNING log。

    Why fail-soft 而非 raise：dangling reference 是数据完整性问题，不该
    让一道题的 read 把整 paper 接口 500。前端会得到 broken img，但
    其他题正常显示。"""
    assets = [FakeAsset(id=1, file_path="/x/0001_known.png")]
    html = '<p><img src="assets/0099_unknown.png" /></p>'

    with caplog.at_level(logging.WARNING, logger="sikao_api.modules.question_bank.application.exam_papers"):
        result = _rewrite_asset_urls(html, assets)

    assert 'src="assets/0099_unknown.png"' in result, "unknown src must be preserved"
    assert any(
        "0099_unknown.png" in record.message for record in caplog.records
    ), "missing basename must emit a WARNING log"


def test_rewrite_handles_no_assets() -> None:
    assert _rewrite_asset_urls(None, []) is None
    assert _rewrite_asset_urls("", []) == ""
    # html with imgs but empty assets[] → behaves like skips_unknown_basename × N
    assert (
        _rewrite_asset_urls('<img src="assets/x.png" />', [])
        == '<img src="assets/x.png" />'
    )
    # plain html without any img tag → unchanged
    assert _rewrite_asset_urls("<p>纯文本</p>", []) == "<p>纯文本</p>"
