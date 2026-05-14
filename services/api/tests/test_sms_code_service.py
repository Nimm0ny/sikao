"""SmsCodeService unit tests — Identity v2 (D9, D17, D19).

Covers:
- issue_code: happy + requester_ip + replace 旧 unused (D9 replace 模式) +
  cross-purpose / cross-target 隔离 + 不动 already-used codes
- verify_code: happy + confirmer_ip + nonexistent / wrong / expired / used →
  GoneError + D17(b) attempt+1 / ≥3 mark used + 跨 purpose 隔离
- _hash_code stable + _generate_numeric_code length + leading-zero allowed
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import PreRegisterCode, utc_now
from sikao_api.modules.system.application.errors import GoneError
from sikao_api.modules.auth.application.sms_code import (
    D17_MAX_ATTEMPTS,
    SmsCodeService,
    _generate_numeric_code,
    _hash_code,
)


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None)  # type: ignore[call-arg]


@pytest.fixture
def service(session: Session, settings: Settings) -> SmsCodeService:
    return SmsCodeService(session, settings)


# ─── helpers ────────────────────────────────────────────────


def test_hash_code_is_stable() -> None:
    """sha256 hash is deterministic — 同 input 同 output (D19 比对前提)."""
    assert _hash_code("123456") == _hash_code("123456")
    assert _hash_code("123456") != _hash_code("123457")


def test_generate_numeric_code_length() -> None:
    """Code length 跟 settings.auth_sms_code_length 一致 (默认 6)."""
    code = _generate_numeric_code(6)
    assert len(code) == 6
    assert code.isdigit()


def test_generate_numeric_code_allows_leading_zero() -> None:
    """Leading-zero codes (e.g. "012345") 必须允许 — secrets.choice 均匀分布."""
    # 100 次抽样应有概率出现 first digit 0 (1/10 概率).
    samples = {_generate_numeric_code(6) for _ in range(200)}
    assert any(s.startswith("0") for s in samples), (
        "leading-zero codes 应当能生成 (200 次抽样未命中, suspicious)"
    )


# ─── issue_code ─────────────────────────────────────────────


def test_issue_code_returns_6_digit_and_persists_row(
    service: SmsCodeService, session: Session
) -> None:
    raw_code = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    assert len(raw_code) == 6
    assert raw_code.isdigit()
    rows = session.scalars(select(PreRegisterCode)).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.target_kind == "phone"
    assert row.target_value == "13800138000"
    assert row.purpose == "register"
    assert row.code_hash == _hash_code(raw_code)
    assert row.used_at is None
    assert row.attempt_count == 0


def test_issue_code_persists_requester_ip(
    service: SmsCodeService, session: Session
) -> None:
    service.issue_code(
        target_kind="phone",
        target_value="13800138000",
        purpose="register",
        requester_ip="203.0.113.5",
    )
    row = session.scalars(select(PreRegisterCode)).first()
    assert row is not None
    assert row.requester_ip == "203.0.113.5"


def test_issue_code_replaces_unused_same_target_purpose(
    service: SmsCodeService, session: Session
) -> None:
    """同 (target, purpose) 旧 unused 必须 invalidate (replace 模式 D9).

    防表灌满 + reduce active code surface.
    """
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    rows = session.scalars(
        select(PreRegisterCode).order_by(PreRegisterCode.id)
    ).all()
    assert len(rows) == 2
    assert rows[0].used_at is not None  # 旧 row 被 invalidate
    assert rows[1].used_at is None  # 新 row active


def test_issue_code_does_not_invalidate_cross_purpose(
    service: SmsCodeService, session: Session
) -> None:
    """同 phone 不同 purpose (register vs bind_phone) 互不影响."""
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="bind_phone"
    )
    register_row = session.scalar(
        select(PreRegisterCode).where(PreRegisterCode.purpose == "register")
    )
    bind_row = session.scalar(
        select(PreRegisterCode).where(PreRegisterCode.purpose == "bind_phone")
    )
    assert register_row is not None
    assert bind_row is not None
    assert register_row.used_at is None
    assert bind_row.used_at is None


def test_issue_code_does_not_invalidate_cross_target(
    service: SmsCodeService, session: Session
) -> None:
    """不同 phone (同 purpose) 互不影响."""
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    service.issue_code(
        target_kind="phone", target_value="13900139000", purpose="register"
    )
    rows = session.scalars(select(PreRegisterCode)).all()
    assert all(r.used_at is None for r in rows)


# ─── verify_code happy + side effects ───────────────────────


def test_verify_code_happy_marks_used_and_returns_row(
    service: SmsCodeService, session: Session
) -> None:
    raw_code = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    row = service.verify_code(
        target_kind="phone",
        target_value="13800138000",
        purpose="register",
        code=raw_code,
    )
    assert row.used_at is not None
    assert row.target_value == "13800138000"


def test_verify_code_persists_confirmer_ip(
    service: SmsCodeService, session: Session
) -> None:
    raw_code = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    service.verify_code(
        target_kind="phone",
        target_value="13800138000",
        purpose="register",
        code=raw_code,
        confirmer_ip="198.51.100.7",
    )
    row = session.scalar(select(PreRegisterCode))
    assert row is not None
    assert row.confirmer_ip == "198.51.100.7"


# ─── verify_code failure paths + D17 (b) attempt+1 ──────────


def test_verify_code_nonexistent_raises_gone(
    service: SmsCodeService,
) -> None:
    """No code issued → verify raise GoneError (probe 一致)."""
    with pytest.raises(GoneError) as exc_info:
        service.verify_code(
            target_kind="phone",
            target_value="13800138000",
            purpose="register",
            code="123456",
        )
    assert exc_info.value.code == "code_invalid"


def test_verify_code_wrong_code_increments_attempt(
    service: SmsCodeService, session: Session
) -> None:
    """错 code → raise + active row attempt_count+1 (D17 b)."""
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    with pytest.raises(GoneError):
        service.verify_code(
            target_kind="phone",
            target_value="13800138000",
            purpose="register",
            code="999999",
        )
    row = session.scalar(select(PreRegisterCode))
    assert row is not None
    assert row.attempt_count == 1
    assert row.used_at is None  # 还有重试机会 (1 < 3)


def test_verify_code_three_failures_marks_used(
    service: SmsCodeService, session: Session
) -> None:
    """D17 (b): attempt_count ≥ D17_MAX_ATTEMPTS (3) 自废 (mark used_at=now)."""
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    for _ in range(D17_MAX_ATTEMPTS):
        with pytest.raises(GoneError):
            service.verify_code(
                target_kind="phone",
                target_value="13800138000",
                purpose="register",
                code="999999",
            )
    row = session.scalar(select(PreRegisterCode))
    assert row is not None
    assert row.attempt_count == D17_MAX_ATTEMPTS
    assert row.used_at is not None  # 自废


def test_verify_code_after_three_failures_correct_code_still_rejected(
    service: SmsCodeService, session: Session
) -> None:
    """3 失败后 active code 已 mark used; 即使输对也拒 (一次性废, 引导重发)."""
    raw_code = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    for _ in range(D17_MAX_ATTEMPTS):
        with pytest.raises(GoneError):
            service.verify_code(
                target_kind="phone",
                target_value="13800138000",
                purpose="register",
                code="999999",
            )
    # 现在输正确 code 仍拒.
    with pytest.raises(GoneError):
        service.verify_code(
            target_kind="phone",
            target_value="13800138000",
            purpose="register",
            code=raw_code,
        )


def test_verify_code_expired_raises_gone(
    service: SmsCodeService, session: Session
) -> None:
    """过期 code → raise (跟 wrong code 一样 probe 一致)."""
    raw_code = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    # 直接改 DB 把 expires_at 设到过去.
    row = session.scalar(select(PreRegisterCode))
    assert row is not None
    row.expires_at = utc_now() - timedelta(minutes=1)
    session.flush()

    with pytest.raises(GoneError):
        service.verify_code(
            target_kind="phone",
            target_value="13800138000",
            purpose="register",
            code=raw_code,
        )


def test_verify_code_already_used_raises_gone(
    service: SmsCodeService, session: Session
) -> None:
    """已 used code (single-use) 二次 verify 拒."""
    raw_code = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    service.verify_code(
        target_kind="phone",
        target_value="13800138000",
        purpose="register",
        code=raw_code,
    )
    with pytest.raises(GoneError):
        service.verify_code(
            target_kind="phone",
            target_value="13800138000",
            purpose="register",
            code=raw_code,
        )


def test_verify_code_no_active_silent_no_raise_beyond_gone(
    service: SmsCodeService, session: Session
) -> None:
    """No active code (e.g. attacker probe 陌生 phone) → GoneError, 不动表.

    probe 行为一致 (相同 GoneError) — attacker 区分不了 "phone 注册过 + 我猜
    错 code" vs "phone 没注册".
    """
    rows_before = session.scalars(select(PreRegisterCode)).all()
    assert len(rows_before) == 0
    with pytest.raises(GoneError):
        service.verify_code(
            target_kind="phone",
            target_value="13800138000",
            purpose="register",
            code="123456",
        )
    rows_after = session.scalars(select(PreRegisterCode)).all()
    assert len(rows_after) == 0  # 没有 ghost row 写入


def test_verify_code_cross_purpose_isolation(
    service: SmsCodeService, session: Session
) -> None:
    """register code 不能拿来 verify bind_phone (跨 purpose 隔离)."""
    raw_code = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    with pytest.raises(GoneError):
        service.verify_code(
            target_kind="phone",
            target_value="13800138000",
            purpose="bind_phone",
            code=raw_code,
        )


# ─── #4a user_id 校验: bind token leak defense ────────────────


def test_issue_code_persists_user_id_for_bind_purpose(
    service: SmsCodeService, session: Session
) -> None:
    """bind/* 流 issue_code 必须 persist user_id. register/login_otp 留 NULL."""
    service.issue_code(
        target_kind="email",
        target_value="new@example.com",
        purpose="bind_email",
        user_id=42,
    )
    row = session.scalar(select(PreRegisterCode))
    assert row is not None
    assert row.user_id == 42

    # register 默认 user_id=NULL
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    register_row = session.scalar(
        select(PreRegisterCode).where(PreRegisterCode.purpose == "register")
    )
    assert register_row is not None
    assert register_row.user_id is None


def test_verify_code_user_id_mismatch_raises_gone(
    service: SmsCodeService, session: Session
) -> None:
    """Bind token leak 防御: alice 的 bind code 被 attacker 偷, 在 attacker
    session (user_id=B) confirm → row.user_id=A != B, 命中失败 → GoneError.
    """
    raw_code = service.issue_code(
        target_kind="email",
        target_value="alice-new@example.com",
        purpose="bind_email",
        user_id=1,  # alice
    )
    # attacker (user_id=2) tries to use alice's token
    with pytest.raises(GoneError):
        service.verify_code(
            target_kind="email",
            target_value="alice-new@example.com",
            purpose="bind_email",
            code=raw_code,
            user_id=2,  # bob (attacker)
        )


def test_verify_code_register_code_cannot_be_used_for_bind(
    service: SmsCodeService, session: Session
) -> None:
    """跨 user_id 隔离: register row.user_id=NULL, bind 要求 user_id=int —
    SQLAlchemy `IS NULL` 跟 `= int` 互斥, 命中失败.
    """
    # alice 走 register flow 拿 code
    raw_code = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    # attacker tries to use it as a bind code (purpose mismatch + user_id mismatch)
    with pytest.raises(GoneError):
        service.verify_code(
            target_kind="phone",
            target_value="13800138000",
            purpose="bind_phone",  # cross-purpose 也拒
            code=raw_code,
            user_id=99,
        )


def test_verify_code_bind_user_id_match_happy(
    service: SmsCodeService, session: Session
) -> None:
    """Sanity: 同 user_id 仍 happy path."""
    raw_code = service.issue_code(
        target_kind="email",
        target_value="alice-new@example.com",
        purpose="bind_email",
        user_id=7,
    )
    row = service.verify_code(
        target_kind="email",
        target_value="alice-new@example.com",
        purpose="bind_email",
        code=raw_code,
        user_id=7,
    )
    assert row.user_id == 7
    assert row.used_at is not None


def test_issue_code_replace_isolated_per_user(
    service: SmsCodeService, session: Session
) -> None:
    """两个 user 同时 bind 同 newPhone (不同 user_id) — replace 模式不该跨
    user invalidate (各自的 active code 互不影响). 实际中两 user 不能 bind
    同 phone (D18 unique 预检拦), 但 service 层正交语义仍要正确.
    """
    service.issue_code(
        target_kind="phone",
        target_value="13800138000",
        purpose="bind_phone",
        user_id=1,
    )
    service.issue_code(
        target_kind="phone",
        target_value="13800138000",
        purpose="bind_phone",
        user_id=2,
    )
    rows = session.scalars(select(PreRegisterCode)).all()
    assert len(rows) == 2
    # 两 row 都仍 active (cross-user 不 invalidate)
    assert all(r.used_at is None for r in rows)


def test_issue_code_bind_email_user_level_prune_across_targets(
    service: SmsCodeService, session: Session
) -> None:
    """#6c P2 from #4 review F1: 同 user 同 bind_email purpose 多次 issue
    (不同 newEmail), 旧 row 应 user-level prune (不限 target_value). 防用户
    连发 N 次 bind link 旧 row 累积."""
    # alice 先 bind a@x.com
    service.issue_code(
        target_kind="email",
        target_value="a@x.com",
        purpose="bind_email",
        user_id=1,
    )
    # alice 想换成 b@x.com (输错重发)
    service.issue_code(
        target_kind="email",
        target_value="b@x.com",
        purpose="bind_email",
        user_id=1,
    )
    rows = session.scalars(
        select(PreRegisterCode).order_by(PreRegisterCode.id)
    ).all()
    assert len(rows) == 2
    # 旧 row (a@x.com) user-level prune.
    assert rows[0].used_at is not None
    assert rows[0].target_value == "a@x.com"
    # 新 row 仍 active.
    assert rows[1].used_at is None
    assert rows[1].target_value == "b@x.com"


def test_issue_code_bind_phone_user_level_prune_across_targets(
    service: SmsCodeService, session: Session
) -> None:
    """#6c: bind_phone 同模式 — 同 user 跨 target_value prune."""
    service.issue_code(
        target_kind="phone",
        target_value="13800138000",
        purpose="bind_phone",
        user_id=1,
    )
    service.issue_code(
        target_kind="phone",
        target_value="13900139000",
        purpose="bind_phone",
        user_id=1,
    )
    rows = session.scalars(
        select(PreRegisterCode).order_by(PreRegisterCode.id)
    ).all()
    assert len(rows) == 2
    assert rows[0].used_at is not None  # 旧 phone 被 prune
    assert rows[1].used_at is None  # 新 phone active


def test_issue_code_register_purpose_keeps_target_isolation(
    service: SmsCodeService, session: Session
) -> None:
    """#6c: register / login_otp purpose 维持 target_value 隔离 — 不同 phone
    同时 register 互不干涉 (user_id NULL, 没 user-level concept)."""
    service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    service.issue_code(
        target_kind="phone", target_value="13900139000", purpose="register"
    )
    rows = session.scalars(select(PreRegisterCode)).all()
    assert len(rows) == 2
    # 两 row 都仍 active — 不同 phone 不互 prune.
    assert all(r.used_at is None for r in rows)


# ─── P0 review fix #3e regression: hash collision allowed ────


def test_issue_code_two_targets_can_share_same_code(
    service: SmsCodeService,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """P0 review fix (#3e): 6-digit code 空间 10^6, 表内 ~1184 active rows
    时 50% 概率两 phone 拿相同 code → 同 code_hash. 之前 code_hash 表级
    UNIQUE 撞 IntegrityError 500. 修复后 (drop UNIQUE) 不应 raise.

    Mock 随机生成 让两个 phone 拿同 code; 两次 issue 都该成功 + 各自
    verify 正确命中本 phone (不串).
    """
    from sikao_api.modules.auth.application import sms_code as sms_code_module

    # Force the same 6-digit code for both issues.
    monkeypatch.setattr(
        sms_code_module, "_generate_numeric_code", lambda length: "424242"
    )

    code_a = service.issue_code(
        target_kind="phone", target_value="13800138000", purpose="register"
    )
    code_b = service.issue_code(
        target_kind="phone", target_value="13900139000", purpose="register"
    )
    assert code_a == "424242"
    assert code_b == "424242"

    # 各自 verify 仍按 (target_value, purpose) 隔离 — 即使 code_hash 相同.
    row_a = service.verify_code(
        target_kind="phone",
        target_value="13800138000",
        purpose="register",
        code="424242",
    )
    assert row_a.target_value == "13800138000"

    # B 仍未消费 (A 命中只 mark A's row used; B 的 row 仍 active).
    row_b = service.verify_code(
        target_kind="phone",
        target_value="13900139000",
        purpose="register",
        code="424242",
    )
    assert row_b.target_value == "13900139000"
    assert row_b.id != row_a.id
