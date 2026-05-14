"""LLM settings unit tests — Slice 0a (LLM infra).

Cover:
- 默认值 (按 plan §4.5)
- llm_api_key fallback 逻辑: env var → .env/apikey 文件 → None
- _read_apikey_file_default helper 直接读文件行为
"""

from __future__ import annotations

from pathlib import Path

import pytest

from sikao_api.core.config import Settings


def _make_settings(**overrides: object) -> Settings:
    """Settings(_env_file=None) 隔离 .env, 用 overrides 注 fields."""
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


def test_llm_settings_defaults() -> None:
    """plan §4.5 列出的默认值跟 Settings 类对齐."""
    settings = _make_settings()
    assert settings.llm_provider == "deepseek"
    assert settings.llm_base_url == "https://api.deepseek.com/v1"
    assert settings.llm_model_qa == "deepseek-v4-flash"
    assert settings.llm_model_essay == "deepseek-v4-pro"
    assert settings.llm_model_study_plan == "deepseek-v4-flash"
    assert settings.llm_fallback_model == "deepseek-chat"
    assert settings.llm_max_tokens == 4000
    assert settings.llm_timeout_seconds == 120
    assert settings.llm_usage_estimate_fallback == "tiktoken"


def test_llm_api_key_from_env_var_takes_precedence(monkeypatch: pytest.MonkeyPatch) -> None:
    """显式 env var → 优先, validator 不查文件."""
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: "sk-from-file")
    settings = _make_settings(llm_api_key="sk-test-from-env")
    assert settings.llm_api_key == "sk-test-from-env"


def test_llm_api_key_falls_back_to_apikey_file(monkeypatch: pytest.MonkeyPatch) -> None:
    """env var 不设 → field_validator 读 .env/apikey 文件 (mock)."""
    monkeypatch.setattr(
        "sikao_api.core.config._read_apikey_file_default", lambda: "sk-from-file"
    )
    settings = _make_settings(llm_api_key=None)
    assert settings.llm_api_key == "sk-from-file"


def test_llm_api_key_none_when_no_env_no_file(monkeypatch: pytest.MonkeyPatch) -> None:
    """env var 不设 + 文件不存在 → None (LLM features unavailable until configured)."""
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key=None)
    assert settings.llm_api_key is None


def test_llm_api_key_empty_string_falls_through_to_file(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """空字符串 env var 视作未设, fallback 到文件.

    CI 误注空 LLM_API_KEY="" (e.g. shell expand 漏 secret) 不应阻塞 startup,
    只让 build_llm_provider 调用时 fail-fast.
    """
    monkeypatch.setattr(
        "sikao_api.core.config._read_apikey_file_default", lambda: "sk-from-file"
    )
    settings = _make_settings(llm_api_key="")
    assert settings.llm_api_key == "sk-from-file"


def test_read_apikey_file_default_reads_real_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """_read_apikey_file_default 真读文件 (mock 出 _APIKEY_FILE 路径)."""
    fake_apikey = tmp_path / "apikey"
    fake_apikey.write_text("sk-mock-real-read\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", fake_apikey)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() == "sk-mock-real-read"


def test_read_apikey_file_default_returns_none_for_missing_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """文件不存在 → None (跳 LLM 启动检查, 调用时再失败)."""
    missing = tmp_path / "nonexistent_apikey"
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", missing)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() is None


def test_read_apikey_file_default_returns_none_for_blank_content(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """文件存在但全空白 → None (避免空字符串穿透到 provider 触发奇怪 401)."""
    empty = tmp_path / "apikey"
    empty.write_text("   \n   \n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", empty)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() is None


def test_read_apikey_file_default_parses_multiline_key_value(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """支持 lhr 实际写法: 'models: x\\napikey: sk-xxx' 多行 key:value 格式."""
    multiline = tmp_path / "apikey"
    multiline.write_text("models: deepseek-V4\napikey: sk-30c7456ee25148ec\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", multiline)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() == "sk-30c7456ee25148ec"


def test_read_apikey_file_default_accepts_api_key_alias(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """'api_key:' 别名 (snake_case 也 OK)."""
    f = tmp_path / "apikey"
    f.write_text("api_key: sk-alt-name-format\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", f)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() == "sk-alt-name-format"


def test_read_apikey_file_default_case_insensitive_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """大小写不敏感 (用户可能写 APIKEY: ...)."""
    f = tmp_path / "apikey"
    f.write_text("APIKEY: sk-upper\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", f)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() == "sk-upper"


def test_read_apikey_file_default_skips_comments_and_blanks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """# 注释行 + 空白行 跳过."""
    f = tmp_path / "apikey"
    f.write_text("# my deepseek key\n\nmodels: v4\napikey: sk-comments-ok\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", f)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() == "sk-comments-ok"


def test_read_apikey_file_default_single_line_raw_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """单行 raw key (无换行, 无冒号) 仍 work — 向后兼容简单格式."""
    f = tmp_path / "apikey"
    f.write_text("sk-raw-single-line")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", f)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() == "sk-raw-single-line"


def test_read_apikey_file_default_multiline_without_apikey_returns_none(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """多行但无 apikey 字段 → None (避免误读 models 字段当 key)."""
    f = tmp_path / "apikey"
    f.write_text("models: deepseek-V4\nendpoint: api.deepseek.com\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", f)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() is None


def test_read_apikey_file_default_strips_bom(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Windows Notepad 存的 utf-8-sig BOM 不应让第一行 key 被误读."""
    f = tmp_path / "apikey"
    # 显式写 BOM + multi-line. ﻿ 是 Unicode BOM, utf-8 编码为 EF BB BF.
    f.write_bytes(b"\xef\xbb\xbfapikey: sk-bom-test\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", f)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() == "sk-bom-test"


def test_read_apikey_file_default_accepts_dash_alias(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """中划线变体 (api-key / API-KEY) 应该规范化等同 api_key."""
    f = tmp_path / "apikey"
    f.write_text("models: x\napi-key: sk-dash-form\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", f)

    from sikao_api.core.config import _read_apikey_file_default

    assert _read_apikey_file_default() == "sk-dash-form"


def test_llm_base_url_https_passes() -> None:
    """https://api.example/v1 → 默认值类似 → 通过."""
    settings = _make_settings(llm_base_url="https://api.deepseek.com/v1")
    assert settings.llm_base_url == "https://api.deepseek.com/v1"


def test_llm_base_url_http_localhost_passes() -> None:
    """http://localhost / 127.0.0.1 → dev vLLM 测试场景, 允许."""
    settings = _make_settings(llm_base_url="http://localhost:8000/v1")
    assert settings.llm_base_url == "http://localhost:8000/v1"
    settings2 = _make_settings(llm_base_url="http://127.0.0.1:8000/v1")
    assert settings2.llm_base_url == "http://127.0.0.1:8000/v1"


def test_llm_base_url_http_external_rejected() -> None:
    """http://公网 IP → 拒 (明文 key 泄露). pydantic 抛 ValidationError."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="LLM_BASE_URL"):
        _make_settings(llm_base_url="http://api.example.com/v1")


def test_llm_base_url_file_scheme_rejected() -> None:
    """file:/// → 拒 (避免读本地敏感文件)."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="LLM_BASE_URL"):
        _make_settings(llm_base_url="file:///etc/passwd")


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost.evil.com/v1",      # 子域钓鱼: localhost. 后接 .evil.com
        "http://localhost.attacker.io",      # 同上
        "http://127.0.0.1.evil.com/v1",      # 127.0.0.1. 后接子域
        "http://localhostxyz/v1",            # localhost 后无边界字符直接接字母
        "http://127.0.0.1xyz",               # 127.0.0.1 后接字母
        "http://1270.0.0.1/v1",              # 假 IP (没短-circuit 但容易误以为)
    ],
)
def test_llm_base_url_subdomain_attack_rejected(url: str) -> None:
    """子域钓鱼防护: localhost / 127.0.0.1 后必须紧跟 ':' / '/' / EOF.

    P1-#2-A: 旧 startswith 实现让 'http://localhost.evil.com' 通过, 攻击者
    可拿到明文 LLM key. regex 边界检查防御.
    """
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="LLM_BASE_URL"):
        _make_settings(llm_base_url=url)


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost",                  # bare host
        "http://localhost/v1",               # 接 path
        "http://localhost:8000",             # 接 port
        "http://localhost:8000/v1",          # 接 port + path
        "http://127.0.0.1",                  # bare IP
        "http://127.0.0.1/v1",
        "http://127.0.0.1:8000/v1",
    ],
)
def test_llm_base_url_localhost_dev_forms_pass(url: str) -> None:
    """合法 dev 形态: localhost / 127.0.0.1 + (port / path / nothing) 都通过."""
    settings = _make_settings(llm_base_url=url)
    assert settings.llm_base_url == url


def test_read_apikey_file_default_strips_middle_bom(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """value 起始 BOM (用户 ':' 后 copy-paste 跨剪贴板带 BOM) → 剥掉.

    P2-#3-A 防御: utf-8-sig 只剥首字节 BOM, 中间 BOM 穿透 value 进
    Authorization header → 401. lstrip BOM 在 strip whitespace 之前.
    """
    f = tmp_path / "apikey"
    # 模拟 'apikey: <BOM> sk-xxx' (BOM 在 ':' 后 + 空格)
    f.write_bytes(b"apikey: \xef\xbb\xbf sk-middle-bom\n")
    monkeypatch.setattr("sikao_api.core.config._APIKEY_FILE", f)

    from sikao_api.core.config import _read_apikey_file_default

    result = _read_apikey_file_default()
    assert result == "sk-middle-bom"
    assert "﻿" not in (result or "")
