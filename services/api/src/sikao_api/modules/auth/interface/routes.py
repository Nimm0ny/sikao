from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.core.limiter import (
    identifier_by_body_phone,
    identifier_by_ip,
    make_limiter,
)
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.auth.application.auth import AuthService
from sikao_api.modules.auth.application.auth_recovery import AuthRecoveryService
from sikao_api.modules.system.infrastructure.email import build_email_provider
from sikao_api.modules.auth.application.security import (
    AUTH_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    generate_csrf_token,
    get_current_user,
    verify_csrf_token,
)

router = APIRouter(prefix="/api/v2/auth", tags=["auth-v2"])


def _set_auth_cookie(response: Response, *, token: str, expires_in: int, secure: bool) -> None:
    """Set httpOnly + SameSite=Strict cookie for JWT.

    P1 review fix Phase B.2. samesite=strict 是合理 PoC 默认 (单机 same-origin
    部署); 跨站 SSO 类场景将来要切到 None+Secure, 那时候必须 secure=True.
    """
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=expires_in,
        httponly=True,
        samesite="strict",
        secure=secure,
        path="/",
    )


def _set_csrf_cookie(response: Response, *, expires_in: int, secure: bool) -> str:
    """Generate + set CSRF token cookie. NOT httponly (frontend JS reads + sends
    via X-CSRF-Token header). Phase B.3 double-submit cookie pattern.

    Returns the token so the caller can also surface it in response body —
    jsdom/test environment doesn't always sync Set-Cookie to document.cookie,
    so frontend reads csrfToken from body and sets it on subsequent requests.
    """
    token = generate_csrf_token()
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        max_age=expires_in,
        httponly=False,  # frontend axios interceptor needs to read this
        samesite="strict",
        secure=secure,
        path="/",
    )
    return token


@router.post("/login", response_model=schemas.LoginResponseV2)
def login(
    payload: schemas.LoginIdentifierRequest,
    response: Response,
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.LoginResponseV2:
    """Identity v2 (D1 + D15): identifier (email/phone/username_legacy) + password.

    Username_legacy 仅命中 email IS NULL AND phone IS NULL 的老 user (D15
    兼容期, 90 天 deprecation). 详细探测逻辑见 auth.detect_identifier_kind.
    """
    result = AuthService(session, settings).login_with_identifier(payload)
    _set_auth_cookie(
        response,
        token=result.access_token,
        expires_in=result.expires_in,
        secure=settings.auth_cookie_secure,
    )
    _set_csrf_cookie(
        response, expires_in=result.expires_in, secure=settings.auth_cookie_secure
    )
    return result.to_response()


@router.post(
    "/refresh",
    response_model=schemas.LoginResponseV2,
    dependencies=[Depends(verify_csrf_token)],
)
def refresh(
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.LoginResponseV2:
    """Re-issue auth_token + csrf_token cookies without re-login.

    Post-Phase D P1-2: 解决 SPA 长开后 cookie 过期 (auth/csrf 都同 expiry)
    导致所有 state-mutating 调用 403 的死锁. 前端 axios response interceptor
    在 401 时调 /refresh, 成功 → retry; 失败 → clearSession.

    Require auth (cookie/bearer 双 source 都行) + CSRF (require cookie 就 require csrf).

    P1 review fix (#3e): user 字段走 serialize_user (跟 /me 单一来源), 含 phone /
    phone_verified / needs_identifier_setup 派生字段. 之前手 build 缺字段, 前端
    refresh 后 router guard 误判 needs_identifier_setup.
    """
    from sikao_api.modules.auth.application.security import create_access_token

    new_token, expires_in = create_access_token(settings=settings, user=user)
    _set_auth_cookie(
        response, token=new_token, expires_in=expires_in, secure=settings.auth_cookie_secure
    )
    _set_csrf_cookie(response, expires_in=expires_in, secure=settings.auth_cookie_secure)
    return schemas.LoginResponseV2(
        token_type="bearer",
        expires_in=expires_in,
        user=AuthService(session, settings).serialize_user(user),
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf_token)],
)
def logout(response: Response) -> None:
    """Phase B.2: 清 auth_token cookie. 无 body, 204 No Content.

    幂等 — 未登录调用也不报错 (cookie 不存在 delete 也是 OK).
    Phase B.3: 加 CSRF 校验 (D4 决策: 防恶意站点 force logout).
    """
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")


@router.get("/me", response_model=schemas.UserSummaryV2)
def me(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.UserSummaryV2:
    return AuthService(session, settings).me(user)


# ─── Phase B (auth recovery) endpoints ────────────────────────────────────


def _expose_dev_magic_link(settings: Settings) -> bool:
    """P1-3 双 gate: app_env in {local, test} AND dev_expose_magic_link=True.

    prod 即使误配 stub 也不暴露 link (validate_runtime 兜底拒绝 prod 上
    dev_expose_magic_link=True, 这里二次防御).
    """
    return (
        settings.app_env in ("local", "test")
        and settings.dev_expose_magic_link
    )


def _build_recovery_service(
    session: Session, settings: Settings
) -> AuthRecoveryService:
    return AuthRecoveryService(session, settings, build_email_provider(settings))


@router.post(
    "/forgot-password",
    response_model=schemas.ForgotPasswordResponse,
    response_model_exclude_none=True,  # P0-3: prod _devMagicLink not in body
    dependencies=[
        # commit #6b: 3/min/IP — 防 forgot-password 暴力 enumerate emails
        Depends(make_limiter(times=3, minutes=1, identifier=identifier_by_ip)),
    ],
)
def forgot_password(
    payload: schemas.ForgotPasswordRequest,
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.ForgotPasswordResponse:
    """D5: 总返 200, 不暴露 email 是否注册.

    No CSRF: anonymous endpoint, 调用方根本没 cookie. token + user 一一对应,
    攻击者拿不到 user email 就拿不到 link.
    """
    service = _build_recovery_service(session, settings)
    link = service.request_password_reset(payload.email)
    if link is not None and _expose_dev_magic_link(settings):
        return schemas.ForgotPasswordResponse(_devMagicLink=link)
    return schemas.ForgotPasswordResponse()


@router.post("/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password(
    payload: schemas.ResetPasswordRequest,
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.ResetPasswordResponse:
    """Token 自身就是鉴权凭据 (sha256 stored, single-use).

    No CSRF: anonymous endpoint + token 单次使用替防 CSRF (攻击者诱导用户
    重放也只能换 user 自己 password, 而且 token 一次性, 第二次失败).
    Bad token (假 / used / expired) 全 410 + code=token_invalid.
    """
    service = _build_recovery_service(session, settings)
    service.reset_password(payload.token, payload.new_password)
    return schemas.ResetPasswordResponse()


@router.post(
    "/verify-email/send",
    response_model=schemas.VerifyEmailSendResponse,
    response_model_exclude_none=True,
    dependencies=[Depends(verify_csrf_token)],
)
def verify_email_send(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.VerifyEmailSendResponse:
    """已登录 user 主动请求发 verify email.

    Require auth: 只 verify 自己的 email, 不让人代发.
    Require CSRF: cookie auth + state-mutating, 走 double-submit.
    """
    service = _build_recovery_service(session, settings)
    link = service.request_email_verify(user)
    if link is not None and _expose_dev_magic_link(settings):
        return schemas.VerifyEmailSendResponse(_devMagicLink=link)
    return schemas.VerifyEmailSendResponse()


@router.post(
    "/verify-email/confirm",
    response_model=schemas.VerifyEmailConfirmResponse,
)
def verify_email_confirm(
    payload: schemas.VerifyEmailConfirmRequest,
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.VerifyEmailConfirmResponse:
    """Token 自身就是鉴权 (跟 reset-password 同模式).

    P1-4: 不签 JWT (cookie/session 不变), 只翻 email_verified flag. 前端
    landing page 根据 user.email_verified=True 显示成功 UX.
    """
    service = _build_recovery_service(session, settings)
    user = service.confirm_email_verify(payload.token)
    return schemas.VerifyEmailConfirmResponse(
        user=schemas.UserSummaryV2(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
        )
    )


# ─── Identity v2 endpoints ───────────────────────────────────────────────
# 老 /auth/register + PUT /auth/email 已删 (commit #3d). /auth/login 切到
# LoginIdentifierRequest. 注册分流: /register/email (D3 write-then-verify) +
# /register/phone (D4 verify-then-write 含 SMS code). bind/unbind 走独立
# /bind/{phone,email}/* endpoints (commit #4).


import logging  # noqa: E402

from sikao_api.modules.system.application.errors import ForbiddenError, ValidationError  # noqa: E402
from sikao_api.modules.auth.application.phone import normalize_phone  # noqa: E402
from sikao_api.modules.system.infrastructure.sms import build_sms_provider  # noqa: E402
from sikao_api.modules.auth.application.sms_code import SmsCodeService  # noqa: E402

logger = logging.getLogger(__name__)


def _expose_dev_magic_code(settings: Settings) -> bool:
    """跟 _expose_dev_magic_link 同双 gate: app_env in {local, test} AND
    dev_expose_magic_code=True. prod 即使误配也不暴露 (validate_runtime 兜底).
    """
    return (
        settings.app_env in ("local", "test")
        and settings.dev_expose_magic_code
    )


@router.post(
    "/register/email",
    response_model=schemas.LoginResponseV2,
    dependencies=[
        # commit #6b: 3/min/IP — 防自动化批量注册
        Depends(make_limiter(times=3, minutes=1, identifier=identifier_by_ip)),
    ],
)
def register_email(
    payload: schemas.RegisterEmailRequest,
    response: Response,
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.LoginResponseV2:
    """Identity v2 (D3): email + password 注册. write-then-verify.

    成功直接返 cookie + csrf; frontend 收到能 setSession + navigate /app.
    Email 重复 → 409 code=email_taken. display_name 默认 split('@')[0].
    """
    result = AuthService(session, settings).register_email(payload)
    _set_auth_cookie(
        response,
        token=result.access_token,
        expires_in=result.expires_in,
        secure=settings.auth_cookie_secure,
    )
    _set_csrf_cookie(
        response, expires_in=result.expires_in, secure=settings.auth_cookie_secure
    )
    return result.to_response()


@router.post(
    "/register/phone",
    response_model=schemas.LoginResponseV2,
    dependencies=[
        # commit #6b: 3/min/IP — 防自动化批量注册 (SMS code 已 1/min/phone 限)
        Depends(make_limiter(times=3, minutes=1, identifier=identifier_by_ip)),
    ],
)
def register_phone(
    payload: schemas.RegisterPhoneRequest,
    request: Request,
    response: Response,
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.LoginResponseV2:
    """Identity v2 (D4 + D10): phone + sms_code + password 注册. verify-then-write.

    SMS code 必须先验通过 (走 /sms/send-code 拿 code). confirmer_ip 留痕审计
    (额外发现 B). phone 重复 → 409 code=phone_taken. SMS code 错 → 410
    code=code_invalid (跟 reset-password 同模式).
    """
    confirmer_ip = request.client.host if request.client else None
    result = AuthService(session, settings).register_phone(
        payload, confirmer_ip=confirmer_ip
    )
    _set_auth_cookie(
        response,
        token=result.access_token,
        expires_in=result.expires_in,
        secure=settings.auth_cookie_secure,
    )
    _set_csrf_cookie(
        response, expires_in=result.expires_in, secure=settings.auth_cookie_secure
    )
    return result.to_response()


@router.post(
    "/sms/send-code",
    response_model=schemas.SmsSendCodeResponse,
    response_model_exclude_none=True,  # prod _devMagicCode not in body
    dependencies=[
        # commit #6b plan §4 限流: 三 limit stacked, 防 SMS 烧钱 + 单点爆破.
        # 1/min/phone: 同 phone 1 分钟最多发 1 条 (UX 友好 + 防 typo 重发)
        # 5/24h/phone: 同 phone 一天上限 5 条 (防恶意目标骚扰)
        # 10/min/IP: 同 IP 1 分钟最多 10 条 (防同 IP 多 phone 群发)
        Depends(make_limiter(times=1, minutes=1, identifier=identifier_by_body_phone)),
        Depends(make_limiter(times=5, hours=24, identifier=identifier_by_body_phone)),
        Depends(make_limiter(times=10, minutes=1, identifier=identifier_by_ip)),
    ],
)
def sms_send_code(
    payload: schemas.SmsSendCodeRequest,
    request: Request,
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.SmsSendCodeResponse:
    """Identity v2 (D8 + D17): 发 6-digit SMS code.

    Anonymous-allowed (purpose=register / login_otp); bind_phone 推
    /auth/bind/phone/send-code (commit #4) 才暴露给登录用户. 当前 endpoint
    若 purpose=bind_phone → 403 (force users to use the bind endpoint when
    it lands).

    限流 (D13) 在 commit #6 fastapi-limiter 加. SMS provider 失败 swallow +
    log (跟 forgot-password D5 silent-200 同模式: 不 leak phone 是否注册).
    """
    if payload.purpose == "bind_phone":
        raise ForbiddenError(
            "use /auth/bind/phone/send-code for bind purpose (commit #4)",
            code="not_exposed",
        )

    normalized = normalize_phone(payload.phone)
    if normalized is None:
        raise ValidationError(
            "phone must be 11-digit mainland China format"
        )
    requester_ip = request.client.host if request.client else None

    sms_code_svc = SmsCodeService(session, settings)
    raw_code = sms_code_svc.issue_code(
        target_kind="phone",
        target_value=normalized,
        purpose=payload.purpose,
        requester_ip=requester_ip,
    )

    sms_provider = build_sms_provider(settings)
    try:
        sms_provider.send_verify_code(
            to_phone=normalized,
            code=raw_code,
            purpose=payload.purpose,
        )
    except Exception as exc:  # noqa: BLE001 — fail-open (D5-style swallow)
        # SMS gateway 短暂不可用不能 leak existence; ops 看 logger 能复盘.
        logger.error(
            "auth.sms.send_code.failed phone=%s purpose=%s err=%s",
            normalized,
            payload.purpose,
            exc,
        )

    if _expose_dev_magic_code(settings):
        return schemas.SmsSendCodeResponse(_devMagicCode=raw_code)
    return schemas.SmsSendCodeResponse()


# ─── Bind endpoints (commit #4b) — D10 verify-then-write + D12 password ──
# 都 require logged-in (cookie auth) + CSRF + password 二次校验. 详见
# app/services/auth_binding.py.


@router.post(
    "/bind/phone/send-code",
    response_model=schemas.SmsSendCodeResponse,
    response_model_exclude_none=True,
    dependencies=[
        Depends(verify_csrf_token),
        # commit #6b: 同 sms/send-code 三 limit stacked (logged-in 但仍按 phone
        # 限流防 SMS 烧钱). 跟 anonymous /sms/send-code 共享 Redis key
        # namespace by design — 同 phone 全局 1/min 一致.
        Depends(make_limiter(times=1, minutes=1, identifier=identifier_by_body_phone)),
        Depends(make_limiter(times=5, hours=24, identifier=identifier_by_body_phone)),
        Depends(make_limiter(times=10, minutes=1, identifier=identifier_by_ip)),
    ],
)
def bind_phone_send_code(
    payload: schemas.BindPhoneSendCodeRequest,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.SmsSendCodeResponse:
    """Logged-in user 给 newPhone 发 SMS code. D10 不写 user.phone.

    D18 入口预检 (newPhone 已被别 user 占 → 409 phone_taken; 自己已绑同
    phone → 409 phone_already_bound). dev gate 决定 _devMagicCode 暴露.
    """
    from sikao_api.modules.auth.application.auth_binding import AuthBindingService

    requester_ip = request.client.host if request.client else None
    raw_code = AuthBindingService(session, settings).bind_phone_send_code(
        user, payload.phone, requester_ip=requester_ip
    )
    if _expose_dev_magic_code(settings):
        return schemas.SmsSendCodeResponse(_devMagicCode=raw_code)
    return schemas.SmsSendCodeResponse()


@router.post(
    "/bind/phone/confirm",
    response_model=schemas.IdentifierActionResponse,
    dependencies=[Depends(verify_csrf_token)],
)
def bind_phone_confirm(
    payload: schemas.BindPhoneConfirmRequest,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.IdentifierActionResponse:
    """Code + password 验通过 → 写 user.phone + phone_verified=True.

    D12 password confirm (失败 403 password_invalid). D18 二次预检 (race
    window). D17(b) attempt 计数 (3 失败自废). #4a SmsCodeService user_id
    强匹配防 token leak.
    """
    from sikao_api.modules.auth.application.auth_binding import AuthBindingService

    confirmer_ip = request.client.host if request.client else None
    updated = AuthBindingService(session, settings).bind_phone_confirm(
        user,
        payload.phone,
        payload.sms_code,
        payload.password,
        confirmer_ip=confirmer_ip,
    )
    return schemas.IdentifierActionResponse(
        user=AuthService(session, settings).serialize_user(updated)
    )


@router.post(
    "/bind/email/send-link",
    response_model=schemas.ForgotPasswordResponse,
    response_model_exclude_none=True,
    dependencies=[
        Depends(verify_csrf_token),
        # commit #6b: 5/min/IP — bind email link, 防同 IP 多账号 abuse
        Depends(make_limiter(times=5, minutes=1, identifier=identifier_by_ip)),
    ],
)
def bind_email_send_link(
    payload: schemas.BindEmailSendLinkRequest,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.ForgotPasswordResponse:
    """Logged-in user 给 newEmail 发 verify link. D10 不写 user.email.

    D18 入口预检. token 是 secrets.token_urlsafe(32). dev gate 决定
    _devMagicLink 暴露. Reuses ForgotPasswordResponse shape (ok + 可选
    _devMagicLink) — D7 dev gate 跟 forgot-password 同模式.
    """
    from sikao_api.modules.auth.application.auth_binding import AuthBindingService

    requester_ip = request.client.host if request.client else None
    raw_token = AuthBindingService(session, settings).bind_email_send_link(
        user, payload.email, requester_ip=requester_ip
    )
    if _expose_dev_magic_link(settings):
        return schemas.ForgotPasswordResponse(_devMagicLink=raw_token)
    return schemas.ForgotPasswordResponse()


@router.post(
    "/bind/email/confirm",
    response_model=schemas.IdentifierActionResponse,
    dependencies=[Depends(verify_csrf_token)],
)
def bind_email_confirm(
    payload: schemas.BindEmailConfirmRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.IdentifierActionResponse:
    """Token + password 验通过 → 写 user.email + email_verified=True.

    Token 自身鉴权 (sha256 stored, single-use, user_id-bound). password
    confirm 二次校验 (D12). D18 二次预检 (newEmail 被抢).
    """
    from sikao_api.modules.auth.application.auth_binding import AuthBindingService

    updated = AuthBindingService(session, settings).bind_email_confirm(
        user, payload.token, payload.password
    )
    return schemas.IdentifierActionResponse(
        user=AuthService(session, settings).serialize_user(updated)
    )


# ─── Unbind endpoints (commit #4c) — D11 solo-verified 保留 ──────────────


@router.post(
    "/unbind/phone",
    response_model=schemas.IdentifierActionResponse,
    dependencies=[Depends(verify_csrf_token)],
)
def unbind_phone(
    payload: schemas.UnbindRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.IdentifierActionResponse:
    """Unbind user.phone (D11): email 必须 IS NOT NULL AND email_verified=True.

    D12 password confirm. 失败 → 409 identifier_must_remain_verified. 已
    unbind (user.phone IS NULL) → idempotent 200 (no state change).
    """
    from sikao_api.modules.auth.application.auth_binding import AuthBindingService

    updated = AuthBindingService(session, settings).unbind_phone(
        user, payload.password
    )
    return schemas.IdentifierActionResponse(
        user=AuthService(session, settings).serialize_user(updated)
    )


@router.post(
    "/unbind/email",
    response_model=schemas.IdentifierActionResponse,
    dependencies=[Depends(verify_csrf_token)],
)
def unbind_email(
    payload: schemas.UnbindRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.IdentifierActionResponse:
    """Unbind user.email (D11 反向): phone 必须 IS NOT NULL AND phone_verified=True."""
    from sikao_api.modules.auth.application.auth_binding import AuthBindingService

    updated = AuthBindingService(session, settings).unbind_email(
        user, payload.password
    )
    return schemas.IdentifierActionResponse(
        user=AuthService(session, settings).serialize_user(updated)
    )
