"""Lock the contract that the default DATABASE_URL is cwd-independent.

Why this test exists: dev 上多次踩到 `sqlite:///./var/exam_papers.db` 相对路径
+ git bash `&` 后台启动 cwd-不继承 shell cwd 的坑 —— cli + uvicorn 落到不同
文件，user 看似建好但登录 401。把 default 锁成 absolute path 后必须有测试
盯着，不让回退。
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from sikao_api.core.config import DEFAULT_DATABASE_URL, Settings


def test_default_database_url_is_absolute() -> None:
    """sqlite:/// 后必须是 absolute path（不能是 ./ 或 var/...）。"""
    assert DEFAULT_DATABASE_URL.startswith("sqlite:///")
    db_path = DEFAULT_DATABASE_URL.removeprefix("sqlite:///")
    assert Path(db_path).is_absolute(), (
        f"DEFAULT_DATABASE_URL must be an absolute path, got: {DEFAULT_DATABASE_URL}"
    )


def test_default_database_url_points_under_exam_api_var() -> None:
    """Absolute path 必须落到 services/api/var/exam_papers.db。"""
    db_path = Path(DEFAULT_DATABASE_URL.removeprefix("sqlite:///"))
    assert db_path.name == "exam_papers.db"
    assert db_path.parent.name == "var"
    assert db_path.parent.parent.name == "api"


def test_settings_uses_default_db_when_env_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """无 DATABASE_URL env 时，Settings.database_url == DEFAULT_DATABASE_URL。"""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(_env_file=None)  # type: ignore[call-arg]  # disable .env load to isolate
    assert settings.database_url == DEFAULT_DATABASE_URL


def test_settings_env_overrides_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """env DATABASE_URL 必须能覆盖 default —— prod / docker / test 都依赖这个。"""
    override = "sqlite:////tmp/override.db"
    monkeypatch.setenv("DATABASE_URL", override)
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.database_url == override


def test_default_db_url_independent_of_cwd(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """不论 cwd 是什么，DEFAULT_DATABASE_URL 都指向同一个文件。

    模拟 git bash `&` 后台启动 uvicorn 时 cwd != shell cwd 的场景。
    """
    monkeypatch.delenv("DATABASE_URL", raising=False)
    original_cwd = Path.cwd()
    try:
        os.chdir(tmp_path)
        # Re-import is unnecessary; module-level constant 已 frozen at import time.
        # 但 Settings() 仍要 cwd-independent。
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.database_url == DEFAULT_DATABASE_URL
    finally:
        os.chdir(original_cwd)


# ─── ARCH §7.3 P2 fix: relative sqlite URL → absolute against _EXAM_API_ROOT ─


def test_relative_sqlite_url_resolves_against_exam_api_root(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """env 传 `sqlite:///./var/x.db` 必须 absolutize 到 apps/exam-api/var/x.db.

    Phase B.1 (B 档 quick wins) 修复: cwd-dependent DATABASE_URL 在 .claude/
    import-one-paper.py 从 repo root 跑时把 DB 写到 ./var/x.db (repo root)
    而 backend uvicorn 从 apps/exam-api/ 启动读 apps/exam-api/var/x.db, 数据
    分裂. settings 层 normalize 解决.
    """
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./var/local-run/exam_api.db")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    expected_path = (
        Path(__file__).resolve().parents[1] / "var" / "local-run" / "exam_api.db"
    ).resolve()
    assert settings.database_url == f"sqlite:///{expected_path.as_posix()}"
    assert "./var" not in settings.database_url
    db_path = Path(settings.database_url.removeprefix("sqlite:///"))
    assert db_path.is_absolute()


def test_absolute_sqlite_url_passes_through(monkeypatch: pytest.MonkeyPatch) -> None:
    """已 absolute 的 sqlite URL 不应被改."""
    abs_url = "sqlite:////tmp/explicit-abs.db"
    monkeypatch.setenv("DATABASE_URL", abs_url)
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.database_url == abs_url


def test_postgres_url_passes_through(monkeypatch: pytest.MonkeyPatch) -> None:
    """非 sqlite (PG/MySQL/...) URL 完全 passthrough, 不动."""
    pg_url = "postgresql+pg8000://user:pass@host:5432/db"
    monkeypatch.setenv("DATABASE_URL", pg_url)
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.database_url == pg_url


def test_cors_allowed_origins_accepts_json_array_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS",
        '["http://127.0.0.1:18080","http://localhost:18080"]',
    )
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.cors_allowed_origins == (
        "http://127.0.0.1:18080",
        "http://localhost:18080",
    )


def test_relative_db_url_independent_of_cwd(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """relative DATABASE_URL 在任何 cwd 都解析到同一 absolute path."""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./var/local-run/exam_api.db")
    original_cwd = Path.cwd()
    try:
        os.chdir(tmp_path)
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        expected_path = (
            Path(__file__).resolve().parents[1] / "var" / "local-run" / "exam_api.db"
        ).resolve()
        assert settings.database_url == f"sqlite:///{expected_path.as_posix()}"
    finally:
        os.chdir(original_cwd)


def test_async_sqlite_driver_relative_path_resolves(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """sqlite+aiosqlite:///./var/x.db 也应 normalize (review B.1 P3 follow-up).

    旧 prefix match 只看 sqlite:/// (3 slashes) 漏 sqlite+<driver>:// 形式.
    没有 use site (项目当前 sync only) 但确保 future-proof.
    """
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./var/local-run/x.db")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    expected_path = (
        Path(__file__).resolve().parents[1] / "var" / "local-run" / "x.db"
    ).resolve()
    assert settings.database_url == f"sqlite+aiosqlite:///{expected_path.as_posix()}"


def test_in_memory_sqlite_passes_through(monkeypatch: pytest.MonkeyPatch) -> None:
    """sqlite:// (2-slash, in-memory) 不应被改 — path_part 是空字符串."""
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.database_url == "sqlite://"


def test_relative_upload_dir_resolves_against_exam_api_root(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """upload_dir / import_tmp_dir 跟 DATABASE_URL 同思路, cwd-independent."""
    monkeypatch.setenv("UPLOAD_DIR", "./var/local-run/uploads")
    monkeypatch.setenv("IMPORT_TMP_DIR", "./var/local-run/imports")
    original_cwd = Path.cwd()
    try:
        os.chdir(tmp_path)
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        exam_api_root = Path(__file__).resolve().parents[1]
        assert settings.upload_dir == (exam_api_root / "var" / "local-run" / "uploads").resolve()
        assert settings.import_tmp_dir == (exam_api_root / "var" / "local-run" / "imports").resolve()
        assert settings.upload_dir.is_absolute()
    finally:
        os.chdir(original_cwd)
