"""LLM usage estimator unit tests — Slice 0a (R9 fallback).

Cover:
- mode=none → 返 0 + warn log
- mode=tiktoken English / Chinese 真实估算 (cl100k_base BPE)
- 空字符串 → 0
- 非法 mode → ValueError
"""

from __future__ import annotations

import logging

import pytest

from sikao_api.modules.llm.application.llm.usage_estimator import estimate_tokens


def test_estimate_none_returns_zero(caplog: pytest.LogCaptureFixture) -> None:
    """mode=none → 返 0 + warn log (业务层用 estimated=True 标)."""
    with caplog.at_level(logging.WARNING, logger="sikao_api.modules.llm.application.llm.usage_estimator"):
        result = estimate_tokens("Hello world", mode="none")
    assert result == 0
    assert any("fallback=none" in r.getMessage() for r in caplog.records)


def test_estimate_tiktoken_english_text() -> None:
    """tiktoken cl100k_base 估算英文: 'Hello world' = 2 token (BPE pair).

    Sanity check: 英文典型 3-4 char/token, 短句子约 2-5 token.
    """
    result = estimate_tokens("Hello world", mode="tiktoken")
    assert 1 <= result <= 5  # tolerant range, BPE 跨版本可能 ±1


def test_estimate_tiktoken_chinese_text() -> None:
    """tiktoken cl100k_base 估算中文: 中文每字 ~1.5 token (BPE 分多 byte).

    "你好世界" 4 个汉字, 在 cl100k_base 下大约 6-8 token.
    """
    result = estimate_tokens("你好世界", mode="tiktoken")
    assert 4 <= result <= 12  # 中文 BPE 跨版本可能 ±2


def test_estimate_tiktoken_empty_string_returns_zero() -> None:
    """空字符串 → 0 token (合理 short-circuit, 不调 encoder)."""
    assert estimate_tokens("", mode="tiktoken") == 0


def test_estimate_tiktoken_long_text_scales() -> None:
    """长文本 token 数随长度大致线性增 (粗粒度 sanity)."""
    short = estimate_tokens("hi", mode="tiktoken")
    long = estimate_tokens("hello " * 100, mode="tiktoken")
    assert long > short * 10  # 100 word vs 1 word, 至少 10 倍 tokens


def test_estimate_invalid_mode_raises() -> None:
    """mode 非法 → ValueError (调用方 logic bug, 不 silent fallback)."""
    with pytest.raises(ValueError, match="unknown estimate mode"):
        estimate_tokens("hi", mode="invalid")  # type: ignore[arg-type]


def test_estimate_tiktoken_handles_network_failure(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """tiktoken 第一次跑 cl100k_base download encoder 失败 (离线/防火墙)
    → 返 0 + warn log (不阻塞业务主流程).

    tiktoken 内部走 requests.get + raise_for_status, 真失败 type 是
    requests.exceptions.RequestException (继承 OSError). 这里 mock OSError
    复现真实 path (Python builtin, 不引 requests dep).
    """
    import tiktoken

    def _fail_get_encoding(name: str) -> object:
        # OSError 是 requests.exceptions.RequestException 的祖先, 模拟真实
        # 网络失败的 catch path.
        raise OSError(f"network unreachable: cannot download {name}")

    monkeypatch.setattr(tiktoken, "get_encoding", _fail_get_encoding)

    with caplog.at_level(logging.WARNING, logger="sikao_api.modules.llm.application.llm.usage_estimator"):
        result = estimate_tokens("hello world", mode="tiktoken")

    assert result == 0
    assert any("encoder load failed" in r.getMessage() for r in caplog.records)


def test_estimate_tiktoken_handles_value_error(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """encoder hash mismatch / parse fail → ValueError → 同样降级到 0 + warn."""
    import tiktoken

    def _fail_get_encoding(name: str) -> object:
        raise ValueError(f"encoder hash mismatch for {name}")

    monkeypatch.setattr(tiktoken, "get_encoding", _fail_get_encoding)

    with caplog.at_level(logging.WARNING, logger="sikao_api.modules.llm.application.llm.usage_estimator"):
        result = estimate_tokens("hello", mode="tiktoken")

    assert result == 0
    assert any("encoder load failed" in r.getMessage() for r in caplog.records)


def test_estimate_tiktoken_does_not_swallow_logic_bugs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """KeyError / AttributeError / 其他 logic bug 不应被 silent catch (Fail-Fast).

    P1-#5-A: 之前 except Exception 太宽, 会吞 logic bug 让 estimator 神秘
    返 0. 缩窄到 (OSError, ValueError) 让 logic bug 上抛.
    """
    import tiktoken

    def _buggy_get_encoding(name: str) -> object:
        raise KeyError(f"unexpected internal state for {name}")

    monkeypatch.setattr(tiktoken, "get_encoding", _buggy_get_encoding)

    with pytest.raises(KeyError):
        estimate_tokens("hello", mode="tiktoken")
