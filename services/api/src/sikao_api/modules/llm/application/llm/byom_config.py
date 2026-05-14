"""BYOM api_key 加密 — Slice 0c (plan §3.2.1).

AES-256-GCM AEAD 加密用户 api_key 存 user_llm_configs.api_key_encrypted BYTEA.

Layout (BYTEA 单列): `version (1 byte) || nonce (12 bytes) || ciphertext_with_tag (var)`
- version=0x01 给后续 key rotation 留迁移地 (e.g. 0x02 表示用 v2 master key)
- nonce: 12 bytes per NIST GCM 推荐, secrets.token_bytes(12) 生成, **绝不重用**
- ciphertext_with_tag: AESGCM auto append 16-byte tag at end
- decrypt 时按 layout 切片: `version=blob[0:1]; nonce=blob[1:13]; ct=blob[13:]`

AAD (Additional Authenticated Data): `f"user:{user_id}"` 绑定 user_id, 防
ciphertext 被剪贴到别人的 record (e.g. attacker 拿到 user A 的 ciphertext
塞到 user B 的 row, decrypt 时 AAD 不匹配 → InvalidTag).

Master key: 32 bytes AES-256, hex 存 settings.llm_config_enc_key.
"""

from __future__ import annotations

import secrets

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Layout constants
_VERSION_V1 = 0x01
_NONCE_BYTES = 12
_VERSION_OFFSET = 0
_NONCE_OFFSET = 1
_CT_OFFSET = 13


class InvalidEncryptedBlob(Exception):
    """Decrypt 失败: blob 损坏 / version 不支持 / AAD 不匹配 / wrong master key."""


class UnsupportedKeyVersionError(InvalidEncryptedBlob):
    """blob version 字节不是已知 version. 触发条件: 升级了 master key 但忘记
    迁移老 record, 或 DB blob 被截断 / 损坏. ops 接 alert 排查."""


def _build_aad(user_id: int) -> bytes:
    """绑定 user_id 防 ciphertext 被剪贴到别人的 record."""
    return f"user:{user_id}".encode()


def _master_key_bytes(master_key_hex: str) -> bytes:
    """settings.llm_config_enc_key (hex) → 32 bytes. 长度由 config validator 守门."""
    return bytes.fromhex(master_key_hex)


def encrypt_api_key(
    *, plaintext: str, user_id: int, master_key_hex: str
) -> bytes:
    """Encrypt api_key for storage. plaintext='sk-xxx' → blob bytes.

    Layout: version (0x01) || nonce (12B) || ciphertext_with_tag.
    每次调用生成新 nonce (secrets.token_bytes), GCM 重用 nonce 可恢复明文.
    """
    aesgcm = AESGCM(_master_key_bytes(master_key_hex))
    nonce = secrets.token_bytes(_NONCE_BYTES)
    aad = _build_aad(user_id)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), aad)
    return bytes([_VERSION_V1]) + nonce + ct


def decrypt_api_key(
    *, blob: bytes, user_id: int, master_key_hex: str
) -> str:
    """Decrypt blob → plaintext api_key. Raises InvalidEncryptedBlob on
    tampering / wrong master key / wrong user_id (AAD mismatch).

    业务层处理 (按 5th-review P1 #3 + #A 分场景):
    - factory build_llm_provider: catch + logger.warning + fallback system
      default (BYOM optional layer, master key 漂移不让全站 AI 500).
    - test endpoint: catch + update_test_status='unreachable' + ops 接
      logger.warn 看 root cause.
    - service.serialize_masked: catch + mask='***' (graceful degrade list,
      让 user 看到 row 但 mask 全隐藏, 引导重填 api_key).
    """
    if len(blob) < _CT_OFFSET + 16:  # 1 (version) + 12 (nonce) + ≥16 (tag)
        raise InvalidEncryptedBlob(
            f"blob too short ({len(blob)} bytes), need ≥{_CT_OFFSET + 16}"
        )
    version = blob[_VERSION_OFFSET]
    if version != _VERSION_V1:
        raise UnsupportedKeyVersionError(
            f"unknown encrypted blob version: 0x{version:02x}"
        )
    nonce = blob[_NONCE_OFFSET:_CT_OFFSET]
    ct = blob[_CT_OFFSET:]
    aesgcm = AESGCM(_master_key_bytes(master_key_hex))
    aad = _build_aad(user_id)
    try:
        plaintext = aesgcm.decrypt(nonce, ct, aad)
    except InvalidTag as exc:
        raise InvalidEncryptedBlob(
            "AES-GCM authentication failed (wrong key / tampered blob / wrong user_id)"
        ) from exc
    return plaintext.decode("utf-8")


def mask_api_key(plaintext: str) -> str:
    """API key UI display: 'sk-30...c8f3'. Never return raw to frontend.

    保留前 5 chars + 后 4 chars 中间 '...'. 短 key (<16 chars) 全 mask 成
    '***' — 5th-review P2 #D fix: 阈值 < 16 才显部分, 让 mask 至少隐藏
    7 chars (16 - 5 - 4 = 7), 12-char key 隐藏 3 chars 仍嫌少.
    OpenAI / DeepSeek / 通义 / Anthropic 真实 key 都 ≥ 36 chars 不撞此阈值.
    """
    if len(plaintext) < 16:
        return "***"
    return f"{plaintext[:5]}...{plaintext[-4:]}"
