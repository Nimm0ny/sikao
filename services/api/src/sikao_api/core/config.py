from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from argon2 import PasswordHasher
from pydantic import ValidationInfo, computed_field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Match `sqlite:///` or `sqlite+<driver>:///` (3 slashes 后跟 path-part).
# `sqlite://` (in-memory, 2 slashes) 不 match → passthrough.
# `postgresql+...://` 不 match → passthrough.
_SQLITE_FILE_URL_RE = re.compile(r"^(sqlite(?:\+[a-z]+)?:///)")

# Match `http://localhost` 或 `http://127.0.0.1` 但 host 后必须紧跟 `:port` /
# `/path` / 字符串结尾, 防 'http://localhost.evil.com' 子域钓鱼 + DNS rebind.
# 用于 LLM_BASE_URL 校验 (services/llm/__init__.py 也用同 regex, keep in sync).
_LOCAL_HOST_HTTP_RE = re.compile(r"^http://(?:localhost|127\.0\.0\.1)(?::\d+|/|$)")


DEFAULT_ADMIN_PASSWORD = "adminpass"
DEFAULT_ADMIN_PASSWORD_HASH = PasswordHasher().hash(DEFAULT_ADMIN_PASSWORD)


def _is_absolute_db_path(path_str: str) -> bool:
    """Cross-platform absolute-path check for sqlite URL path-part.

    Path.is_absolute() 在 Windows 上对 `/tmp/x` (Linux 绝对路径) 返 False —
    用文本规则手判:
      - 起始 `/` → Linux 绝对 (sqlite URL 形如 sqlite:////tmp/x)
      - `<letter>:/` 或 `<letter>:\\` → Windows 绝对
    其他 (`./x`, `var/x`, `x.db`) 视作相对.
    """
    if not path_str:
        return False
    if path_str.startswith("/"):
        return True
    if len(path_str) >= 3 and path_str[1] == ":" and path_str[2] in ("/", "\\"):
        return True
    return False


# Default SQLite DB 用 absolute path 而非 `sqlite:///./var/...` 相对 cwd ——
# 后者在 git bash on Windows 用 `&` 后台启动 uvicorn 时 cwd 不一定 == shell cwd，
# 导致 cli create-user 写到 A 文件、uvicorn 读 B 文件，user 看似创建成功但
# 登录 401。Absolute path 消除歧义。
# 计算自 config.py 文件位置：
#   services/api/src/sikao_api/core/config.py
#                └─────── parents[3] = services/api
# 路径型默认值统一锚到 services/api，而不是 src/。
_EXAM_API_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_DB_PATH = _EXAM_API_ROOT / "var" / "exam_papers.db"
DEFAULT_DATABASE_URL = f"sqlite:///{_DEFAULT_DB_PATH.as_posix()}"

# Slice 0a (LLM infra): apikey 文件 fallback 路径.
# `<repo_root>/.env/apikey` — gitignored 目录, lhr 把 DeepSeek apikey 放这.
# `_EXAM_API_ROOT.parent.parent` = repo root.
_APIKEY_FILE = _EXAM_API_ROOT.parent.parent / ".env" / "apikey"


_APIKEY_LINE_KEYS = frozenset({"apikey", "api_key", "key"})


def _read_apikey_file_default() -> str | None:
    """Try reading <repo_root>/.env/apikey content. Returns None if file absent.

    支持两种格式 (lhr 实际把 apikey + 元数据混写):
    - Single-line raw key: 整文件就是 'sk-xxxxxxx' 一行.
    - Multi-line key:value (case insensitive):
          apikey: sk-xxx       ← 我们读取这行
          models: deepseek-V4  ← 元数据, 忽略
          # 注释行, 忽略
      key 名匹配 'apikey' / 'api_key' / 'key'.

    用 helper 函数 (而非 inline 在 validator 里) 让 unit test 能 monkeypatch
    this symbol 控制 fallback 行为, 不依赖 fs fixture.
    """
    if not _APIKEY_FILE.is_file():
        return None
    # encoding="utf-8-sig" 自动剥 Windows Notepad 留的 BOM (﻿). 否则
    # multi-line 第一行 key 会被读成 '﻿apikey' ≠ 'apikey' → 整文件无效.
    raw = _APIKEY_FILE.read_text(encoding="utf-8-sig").strip()
    if not raw:
        return None

    # 先按 key:value 解析 (multi-line 或 single-line 含 ':' 都走这).
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        # 比对前 lowercase + 中划线规范化成下划线 (用户可能写 'api-key:' 或
        # 'API-KEY:'), 避免合理写法落到 single-line raw 路径返整行.
        key_normalized = key.strip().lower().replace("-", "_")
        if key_normalized in _APIKEY_LINE_KEYS:
            # 三段 strip 防 'apikey: ﻿ sk-xxx' 这种 BOM 在 ': ' 后空格前
            # 边界: 先 strip whitespace, 再 lstrip BOM, 再 strip 剥 BOM 后空格.
            # utf-8-sig 只剥文件首字节 BOM, 中间 BOM 穿透 value 进 Authorization
            # header → 401. ﻿ 不是 ASCII whitespace, 单 .strip() 不剥.
            value = value.strip().lstrip("﻿").strip()
            return value or None

    # 找不到 key:value 形式 → 若全文是 single-line (no `\n`), 视作 raw key
    # (向后兼容用户写 'sk-xxx' 一行的简单格式).
    if "\n" not in raw:
        return raw
    return None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # 绝对路径让 BaseSettings 不依赖 cwd (root cwd 会撞 repo 根的 .env/
        # 目录, 导致 BaseSettings fallback 默认值 → backend 用错 db). 走
        # _EXAM_API_ROOT (config.py 文件位置推算) 直接锚到 services/api/.env.
        env_file=str(_EXAM_API_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "exam-api"
    app_env: Literal["local", "test", "poc", "prod"] = "local"
    app_port: int = 8000
    app_base_url: str = "http://127.0.0.1:8000"
    app_version: str = "0.1.0"
    git_sha: str = "dev"
    image_tag: str = "local"
    build_time: str = "unknown"
    schema_version: str = "unmigrated"
    log_level: str = "info"

    # Default 见 DEFAULT_DATABASE_URL —— absolute path 指向 services/api/var/exam_papers.db，
    # cwd-independent。dev 启动 + cli 任何 entry point 不传 DATABASE_URL 都进同一个 DB。
    database_url: str = DEFAULT_DATABASE_URL
    db_pool_size: int = 5
    db_pool_max_overflow: int = 10
    db_echo: bool = False

    # SIKAO 2026-05-13: backend_data 冷存根目录（行测 fenbi mirror + 申论 standard json）。
    # 默认指向 D:/py_pj/backend_data（lhr 本机），生产可通过 BACKEND_DATA_ROOT env 覆盖。
    # 子目录约定：
    #   {backend_data_root}/xingce/papers/<id_name>/{paper.json, assets/}
    #   {backend_data_root}/shenlun/standard_json/FBSL-*.standard.json
    # 由 scripts/import/* 与 services/api/src/sikao_api/scripts/backfill_*.py 共享。
    backend_data_root: str = "D:/py_pj/backend_data"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_exp_minutes: int = 120
    # P1 review fix Phase B.2: dev defaults False, prod (Dockerfile/Harness) 设
    # AUTH_COOKIE_SECURE=true. SameSite=Strict 是 hardcoded (跨站 zero use case
    # 在 PoC).
    auth_cookie_secure: bool = False

    admin_username: str = "admin"
    admin_password_hash: str = DEFAULT_ADMIN_PASSWORD_HASH

    cors_allowed_origins: Annotated[tuple[str, ...], NoDecode] = (
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:18080",
        "http://localhost:18080",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    )

    upload_dir: Path = Path("./var/uploads")
    import_tmp_dir: Path = Path("./var/imports")
    import_max_file_size_mb: int = 25
    import_max_file_count: int = 100
    # v1 上线设计 (alembic 0012): assets 路径相对化 — DB question_assets.file_path
    # / material_group_assets.file_path 存 `<paperCode>/assets/<basename>` 相对路径,
    # 物理文件落在 `assets_root / <relative>`. 解决 dev/prod 路径切换 + 题库搬家
    # 不断的 known issue (CLAUDE.md §12 E). dev 默认 services/api/var/assets,
    # prod 走 env 注入 /var/data/exam-assets/. import 时 service._resolve_assets
    # 把 staging 资产 copy 到此 root, FileResponse 拼回 absolute.
    assets_root: Path = Path("./var/assets")

    redis_url: str | None = None
    storage_healthcheck_url: str | None = None
    meili_url: str | None = None
    meili_master_key: str | None = None
    meili_index_name: str = "notes"
    meili_timeout_seconds: int = 3

    # Phase B (auth recovery) settings ——
    # email_provider: stub (dev logger) / noop (silent drop) / resend (真 SaaS).
    # 切 resend 必须同时设 RESEND_API_KEY + RESEND_FROM_EMAIL, 否则
    # validate_runtime fail-fast.
    email_provider: Literal["stub", "noop", "resend"] = "stub"
    # Resend 配置 (只在 email_provider=="resend" 时必须). RESEND_API_KEY 是
    # secret, 进 docker secrets / env, 别提交 .env.
    resend_api_key: str | None = None
    resend_from_email: str | None = None
    resend_reply_to: str | None = None
    # frontend_base_url: 拼 reset / verify magic link 用 ——
    # `https://app.example.com/reset-password?token=xxx`. dev 默认 vite dev
    # server (CLAUDE.md §11: 18080 是前端唯一端口, 5173 完全禁), prod 必须 env
    # 注入 (否则 link 指 localhost, 邮件收到点不开).
    # P0-1: 跟 app_base_url (API base) 区分, 两个独立来源.
    frontend_base_url: str = "http://localhost:18080"
    # dev_expose_magic_link: P1-3 双 gate. forgot-password 是否在 response
    # body 回 _devMagicLink. 仅当 app_env in {local, test} **AND** 此 flag
    # True 时暴露. prod 即使误配 stub 也不暴露 (validate_runtime 兜底).
    dev_expose_magic_link: bool = False
    # 默认 1h 短即降低截获后 window. forgot-password 下发的 token TTL.
    auth_password_reset_ttl_minutes: int = 60
    # 默认 24h, 用户邮件不一定立即看. verify-email 下发的 token TTL.
    auth_email_verify_ttl_minutes: int = 60 * 24

    # ─── Identity v2 (email/phone login + binding) settings ─────────────────
    # 详见 docs/plan/email-phone-login-and-binding.md.
    # sms_provider: stub (dev logger + _devMagicCode 暴露) / noop (silent drop)
    # / tencent (腾讯云 SMS). 切 tencent 必须同时设 secret_id/key/app_id/sign/
    # template_*, validate_runtime fail-fast 拦半配置.
    sms_provider: Literal["stub", "noop", "tencent"] = "stub"
    # 腾讯云 SMS 配置 (仅 sms_provider=="tencent" 时必须). secret 进 docker
    # secrets / env, 别提交 .env. template_* 是腾讯控制台报备审核通过的模板 ID.
    tencent_sms_secret_id: str | None = None
    tencent_sms_secret_key: str | None = None
    tencent_sms_app_id: str | None = None
    tencent_sms_sign_name: str | None = None  # 短信签名 (e.g. "思考")
    tencent_sms_template_register: str | None = None  # 注册码模板
    tencent_sms_template_bind: str | None = None  # 绑定换绑模板
    tencent_sms_template_login_otp: str | None = None  # OTP 登录 (Phase 1 不做, 字段留)
    # dev_expose_magic_code: 跟 dev_expose_magic_link 同模式双 gate. SMS code
    # 是否在 response body 回 `_devMagicCode`. 仅当 app_env in {local, test} AND
    # 此 flag True 时暴露. prod 误配 stub 也不暴露 (validate_runtime 兜底).
    dev_expose_magic_code: bool = False
    # 默认 10min 短即降低截获后 window + 配合 D17 confirm 端限流减爆破成本.
    auth_sms_code_ttl_minutes: int = 10
    # 6 位数字 — hardcoded 实际, 字段留扩展窗口 (将来 8 位等).
    auth_sms_code_length: int = 6

    # P1 review fix Phase 4.3: 改 None 默认 + 必须 env 注入. 当前无 use site
    # (deadcode-ish), 但若日后写 smoke 流程, fail-fast 强制走 env 而不是落到
    # 默认弱凭据上. 业务正确性变量 (CLAUDE.md §4) — 缺就崩, 禁止默认值.
    smoke_username: str | None = None
    smoke_password: str | None = None
    smoke_paper_code: str | None = None

    # ─── LLM infra (Slice 0a, plan §4.5) ─────────────────────────────────────
    # 系统默认 provider. PoC 阶段只 verify DeepSeek V4, 用户 BYOM 走相同
    # OpenAICompatibleProvider impl 但接其他 endpoint (Slice 0c 才加 BYOM).
    llm_provider: Literal["deepseek", "openai", "custom", "mock"] = "deepseek"
    # API key: env var 优先, 缺则 fallback 读 <repo_root>/.env/apikey 文件.
    # None 不 startup fail-fast (LLM 是 optional feature) — build_llm_provider
    # 调用时检查并抛 ConfigError, route handler 转 503 给 user.
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.deepseek.com/v1"
    # 三 model 按 feature 分: 答疑/学习计划走轻量 flash, 申论批改走 heavy pro.
    llm_model_qa: str = "deepseek-v4-flash"
    llm_model_essay: str = "deepseek-v4-pro"
    llm_model_study_plan: str = "deepseek-v4-flash"
    # Fallback (V4 preview 调用失败回落到 V3.2 兜底, 2026-07-24 deprecated 前可用).
    llm_fallback_model: str = "deepseek-chat"
    # 调用参数
    llm_max_tokens: int = 4000
    llm_timeout_seconds: int = 120
    # Slice 3a 学习计划专用 timeout — GET /study-plan/today 走同步阻塞 LLM call
    # (D2), 默认 10s 比全局 120s 大幅压短, 防新用户开 app 等待过久. 仅作用
    # system path; BYOM 用户自配 base_url (azure region 等可能高延迟), 用户
    # 自配自负, BYOM 路径继续用 llm_timeout_seconds.
    llm_timeout_study_plan_seconds: int = 10
    llm_max_retries: int = 1
    llm_temperature: float = 0.7
    llm_max_input_tokens: int = 16000
    llm_cache_ttl_seconds: int = 3600
    llm_quota_per_user_per_day: int = 50
    llm_quota_per_user_cost_cny_per_day: float = 5.0
    llm_cost_input_per_1m: float = 1.0
    llm_cost_output_per_1m: float = 2.0
    # Token usage estimation fallback (R9): stream final chunk usage 缺失时本地估算.
    # tiktoken: 用 OpenAI 兼容 BPE encoder 数 token (近似但够估算用量).
    # none: 计 0 + warn log (用量记账偏低但不阻塞).
    llm_usage_estimate_fallback: Literal["tiktoken", "none"] = "tiktoken"

    # Slice 0c (BYOM) — AES-256-GCM master key 加密用户 api_key. 32 bytes hex
    # encoded (64 chars). 例: secrets.token_hex(32). Default None → BYOM 不可
    # 用 (build_user_llm_provider 调用时抛 LLMConfigError). 不 startup fail-fast
    # 因为 BYOM 是 optional feature; 仅当用户尝试用 BYOM 时报错.
    # ⚠️ 丢失此 key → 已加密的 user_llm_configs.api_key_encrypted 全部不可解密
    # (R8). README + ops checklist 强警告.
    llm_config_enc_key: str | None = None

    # ─── Phase-Profile PR-P6: account-deletion sweep scheduler ───────────────
    # D-P11 + Del-5/6/7 (Phase/Profile/00-Decisions.md):
    # - 默认关闭 → pytest / dev 不会启动后台任务,
    #   prod 通过 DELETION_SWEEP_ENABLED=true 启用.
    # - 多 worker 部署: 仅 leader / 单独 sweeper worker 设 true,
    #   其他 worker 保持默认关闭 (run_hard_delete_sweep 多 worker 同时跑有 race).
    deletion_sweep_enabled: bool = False
    # 默认 24h: 注销宽限期 7 天, 一日扫一次足够及时.
    # 可调小到 60 (1min) 用于 staging 烟测.
    deletion_sweep_interval_seconds: int = 86400
    # 启动后等 60s 才首次跑 — 防 uvicorn startup 期 metrics / DB pool 还没暖好
    # 第一次 sweep 就吞 connection error. run_on_startup=True 时此值忽略.
    deletion_sweep_initial_delay_seconds: int = 60
    # 启动立即跑一次 (运维兜底重启时清积压). 默认 False — 重启不应改变 sweep
    # 节奏, 跟 cron 语义对齐.
    deletion_sweep_run_on_startup: bool = False

    # ─── Home Phase M5: scheduler / observability substrate ─────────────────
    # Stage 1 leader flag. 默认关闭，避免 dev / pytest 无意启动 Home 后台任务。
    home_scheduler_enabled: bool = False
    # Home runtime 固定按中国用户时区组织 cron 窗口。
    home_scheduler_timezone: str = "Asia/Shanghai"
    # OTel instrumentation flag: False 时保留 runtime 行为但不写指标。
    home_scheduler_metrics_enabled: bool = True

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_allowed_origins(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return ()
            if stripped.startswith("["):
                parsed = json.loads(stripped)
                if not isinstance(parsed, list):
                    raise ValueError("cors_allowed_origins JSON value must be a list")
                return tuple(str(item).strip() for item in parsed if str(item).strip())
            return tuple(item.strip() for item in stripped.split(",") if item.strip())
        return value

    @field_validator("database_url", mode="after")
    @classmethod
    def normalize_relative_sqlite_url(cls, value: str) -> str:
        """relative sqlite path → absolute, resolved against _EXAM_API_ROOT.

        ARCH §7.3 P2 修复: `.env` 写 `sqlite:///./var/local-run/exam_api.db`
        时 pydantic-settings 直接传给 SQLAlchemy, SA 把 ./ 解析成进程 cwd.
        cwd ≠ services/api/src (e.g. scripts/import/* 从 repo root 跑)
        → sqlite 把 DB 写到错误路径 → backend 看不到 import 数据.
        这里在 settings 层 normalize: 任何 relative sqlite 路径都用
        _EXAM_API_ROOT 解析, cwd-independent.

        SQLAlchemy URL 形式 (按 sqlite slashes 数区分):
          sqlite:///./foo.db          → relative (cwd/foo.db) ← 修
          sqlite:///C:/foo.db         → Windows 绝对  ← passthrough
          sqlite:////tmp/foo.db       → Linux 绝对 (4 slashes 第 4 个是 /)  ← passthrough
          sqlite+aiosqlite:///./x     → async driver, 也覆盖 (review fix)
          sqlite://                   → in-memory, passthrough (path_part=="")
          sqlite:///                  → ambiguous (path_part==""), passthrough
        cross-platform absolute 判定不能依赖 Path.is_absolute() (Windows 上
        `/tmp/...` 返 False), 用文本规则手判.
        """
        # 用 regex 严格匹配 `sqlite[+driver]:///` 前缀, 拿剩余 path_part.
        # 旧 split-on-:// 逻辑 (find + sep+3) bug: `sqlite:///./x` 的 find 拿到
        # 第一个 :// 后 path_part 起始多吃一个 `/` 变 `/./x` → 误判 Linux 绝对.
        match = _SQLITE_FILE_URL_RE.match(value)
        if not match:
            return value
        scheme = match.group(1)
        path_part = value[len(scheme) :]
        # `sqlite:///` 后空 (e.g. URL 是 sqlite:/// 或 sqlite+aiosqlite:///) — 没意义,
        # passthrough 让 SQLAlchemy 自己抛错.
        if path_part == "":
            return value
        # /tmp/... 等绝对路径: 注意 SA `sqlite:////tmp/foo` 第 4 个 / 属于 path,
        # 经 regex 剥掉 sqlite:/// 后 path_part = `/tmp/foo` (起始 /, Linux abs).
        if _is_absolute_db_path(path_part):
            return value
        resolved = (_EXAM_API_ROOT / path_part).resolve()
        return f"{scheme}{resolved.as_posix()}"

    @field_validator("upload_dir", "import_tmp_dir", "assets_root", mode="after")
    @classmethod
    def normalize_relative_path_dirs(cls, value: Path) -> Path:
        """`.env` 上的 ./var/... 走 _EXAM_API_ROOT 解析, 跟 database_url 同思路.

        Default `Path("./var/uploads")` 在 Settings() 实例化时受 cwd 影响 —
        cwd 不在 services/api/src 时 mkdir 会写到调用者目录. 在 settings 层 absolutize.
        """
        return value if value.is_absolute() else (_EXAM_API_ROOT / value).resolve()

    @field_validator("llm_api_key", mode="after")
    @classmethod
    def _llm_api_key_fallback_to_file(
        cls, value: str | None, info: ValidationInfo
    ) -> str | None:
        """If LLM_API_KEY not set in env, fall back to <repo_root>/.env/apikey content.

        .env/ 是 gitignored 目录, lhr 把 DS apikey 放这. None if neither env
        var nor file present (LLM features unavailable until configured).
        """
        if value:
            return value
        if info.data.get("app_env") == "test":
            return None
        return _read_apikey_file_default()

    @field_validator("llm_config_enc_key", mode="after")
    @classmethod
    def _llm_config_enc_key_format(cls, value: str | None) -> str | None:
        """LLM_CONFIG_ENC_KEY format check (None passthrough).

        要求: 64 hex chars (= 32 bytes AES-256 key). 非法 hex / 长度错 → 启动
        fail-fast 而不是 use site (用户尝试 BYOM 时才发现 key 损坏 already 太晚).
        None passthrough 让 BYOM 是 optional feature (use site LLMConfigError).
        """
        if value is None or value == "":
            return None
        if len(value) != 64:
            raise ValueError(
                f"LLM_CONFIG_ENC_KEY must be 64 hex chars (32 bytes AES-256), "
                f"got {len(value)}"
            )
        try:
            bytes.fromhex(value)
        except ValueError as exc:
            raise ValueError(
                "LLM_CONFIG_ENC_KEY must be valid hex string"
            ) from exc
        return value

    @field_validator("llm_base_url", mode="after")
    @classmethod
    def _llm_base_url_scheme(cls, value: str) -> str:
        """LLM_BASE_URL 必须 https:// 起 (生产), 或 http://localhost / 127.0.0.1 (dev vLLM).

        拒 http://外部 IP (明文 key 泄露) / file:// / ftp:// / 等. Slice 0c BYOM
        的 user_llm_configs.base_url 还要走完整 SSRF check (拒 RFC1918 / cloud
        metadata / DNS rebind), 这里只做 system default 的 scheme 守门.

        子域名钓鱼防护: 'http://localhost.evil.com' / 'http://127.0.0.1.evil.com'
        startswith 检查会通过, 改用 regex 限定 host 后必须紧跟 ':port' / '/path'
        / 字符串结尾. 跟 services/llm/__init__.py::_is_acceptable_base_url_scheme
        keep in sync.
        """
        url = value.strip()
        if url.startswith("https://"):
            return url
        if _LOCAL_HOST_HTTP_RE.match(url):
            return url
        raise ValueError(
            f"LLM_BASE_URL must start with 'https://' or 'http://localhost' (dev), got: {url!r}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def root_dir(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def ensure_runtime_dirs(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.import_tmp_dir.mkdir(parents=True, exist_ok=True)
        self.assets_root.mkdir(parents=True, exist_ok=True)

    def validate_runtime(self) -> None:
        if self.app_env == "poc" and self.is_sqlite:
            raise RuntimeError("APP_ENV=poc requires PostgreSQL, not SQLite.")
        # Post-Phase D P2-2: prod 必须 cookie secure=True (https only). 漏配
        # AUTH_COOKIE_SECURE=true 在 prod 启动直接 fail-fast, 避免 cookie
        # 走 http 明文.
        if self.app_env == "prod" and not self.auth_cookie_secure:
            raise RuntimeError(
                "APP_ENV=prod requires AUTH_COOKIE_SECURE=true (cookies must be https-only)."
            )
        # Post-Phase D N2: prod 漏配 JWT_SECRET 启动 → 用 default "change-me"
        # 弱密钥, 任何人能伪造 token. fail-fast 拦截.
        if self.app_env == "prod" and self.jwt_secret == "change-me":
            raise RuntimeError(
                "APP_ENV=prod requires JWT_SECRET to be set (must NOT be the 'change-me' default)."
            )
        # Phase B P1-3: prod 误配 dev_expose_magic_link=True 会让 forgot-password
        # 在 response body 直接回 reset link, 任何匿名请求都拿到. fail-fast 兜底.
        if self.app_env in ("poc", "prod") and self.dev_expose_magic_link:
            raise RuntimeError(
                f"APP_ENV={self.app_env} forbids DEV_EXPOSE_MAGIC_LINK=true (leaks reset links)."
            )
        # email_provider=resend 必须配 api_key + from_email, 启动时 fail-fast 拦
        # 半配置 (启动通过, 第一次发邮件才炸 — 那时已晚).
        if self.email_provider == "resend":
            if not self.resend_api_key:
                raise RuntimeError("EMAIL_PROVIDER=resend requires RESEND_API_KEY.")
            if not self.resend_from_email:
                raise RuntimeError("EMAIL_PROVIDER=resend requires RESEND_FROM_EMAIL.")
        # Identity v2: prod 误配 dev_expose_magic_code=True 会让 SMS code 在
        # response 暴露, 任何匿名 send-code 请求都拿到 — fail-fast 兜底 (跟
        # dev_expose_magic_link 同模式).
        if self.app_env in ("poc", "prod") and self.dev_expose_magic_code:
            raise RuntimeError(
                f"APP_ENV={self.app_env} forbids DEV_EXPOSE_MAGIC_CODE=true (leaks SMS codes)."
            )
        # sms_provider=tencent 必须配齐 6 个字段 (secret_id/key/app_id/sign/
        # template_register/template_bind), 启动时 fail-fast 拦半配置.
        # template_login_otp 不强制 (Phase 1 不做 OTP 登录).
        if self.sms_provider == "tencent":
            required = (
                ("TENCENT_SMS_SECRET_ID", self.tencent_sms_secret_id),
                ("TENCENT_SMS_SECRET_KEY", self.tencent_sms_secret_key),
                ("TENCENT_SMS_APP_ID", self.tencent_sms_app_id),
                ("TENCENT_SMS_SIGN_NAME", self.tencent_sms_sign_name),
                ("TENCENT_SMS_TEMPLATE_REGISTER", self.tencent_sms_template_register),
                ("TENCENT_SMS_TEMPLATE_BIND", self.tencent_sms_template_bind),
            )
            for env_name, value in required:
                if not value:
                    raise RuntimeError(f"SMS_PROVIDER=tencent requires {env_name}.")
        # commit #6 限流: prod 必须配 REDIS_URL (fastapi-limiter Redis-backed),
        # 否则限流 silently noop — 攻击者爆破 + SMS 烧钱无防护. dev / test
        # 允许 None (走 noop, app/core/limiter.py 自动降级).
        if self.app_env == "prod" and self.redis_url is None:
            raise RuntimeError(
                "APP_ENV=prod requires REDIS_URL for rate limiting "
                "(fastapi-limiter; 阻爆破 + SMS 烧钱)."
            )


        meili_url_present = bool(self.meili_url)
        meili_key_present = bool(self.meili_master_key)
        if meili_url_present != meili_key_present:
            raise RuntimeError(
                "MEILI_URL and MEILI_MASTER_KEY must be configured together, or both left unset."
            )
        if self.meili_timeout_seconds < 1:
            raise RuntimeError("MEILI_TIMEOUT_SECONDS must be >= 1.")

    @field_validator("meili_url", "meili_master_key", mode="before")
    @classmethod
    def _normalize_blank_meili_values(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_runtime_dirs()
    settings.validate_runtime()
    return settings
