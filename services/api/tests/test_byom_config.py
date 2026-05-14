"""BYOM AES-GCM encrypt/decrypt unit tests — Slice 0c.

Cover:
- encrypt → decrypt round-trip (返原文)
- AAD 绑定 user_id (用错 user_id decrypt → InvalidEncryptedBlob)
- ciphertext 篡改 → InvalidEncryptedBlob
- 错 master key → InvalidEncryptedBlob
- version byte 不识别 → UnsupportedKeyVersionError
- mask_api_key 边界 (短 key 全 mask, 长 key 部分 mask)
"""

from __future__ import annotations

import secrets

import pytest

from sikao_api.modules.llm.application.llm.byom_config import (
    InvalidEncryptedBlob,
    UnsupportedKeyVersionError,
    decrypt_api_key,
    encrypt_api_key,
    mask_api_key,
)


def _gen_master_key_hex() -> str:
    """Generate fresh AES-256 master key for tests."""
    return secrets.token_hex(32)


def test_encrypt_decrypt_round_trip() -> None:
    """encrypt(plaintext) → decrypt(blob) → 原 plaintext."""
    master = _gen_master_key_hex()
    plaintext = "sk-30c7456ee25148ec952f5e7fff318f3c"
    blob = encrypt_api_key(plaintext=plaintext, user_id=42, master_key_hex=master)
    decrypted = decrypt_api_key(blob=blob, user_id=42, master_key_hex=master)
    assert decrypted == plaintext


def test_encrypt_produces_different_ciphertext_each_call() -> None:
    """同 plaintext + 同 key + 同 user_id 两次 encrypt → 不同 blob (nonce 随机)."""
    master = _gen_master_key_hex()
    plaintext = "sk-test"
    blob1 = encrypt_api_key(plaintext=plaintext, user_id=1, master_key_hex=master)
    blob2 = encrypt_api_key(plaintext=plaintext, user_id=1, master_key_hex=master)
    assert blob1 != blob2  # 不同 nonce → 不同 blob
    # 但都能解出原文
    assert decrypt_api_key(blob=blob1, user_id=1, master_key_hex=master) == plaintext
    assert decrypt_api_key(blob=blob2, user_id=1, master_key_hex=master) == plaintext


def test_decrypt_wrong_user_id_raises() -> None:
    """AAD 绑定 user_id: 用错 user_id decrypt → InvalidEncryptedBlob.

    防 ciphertext 被剪贴到别人的 record (e.g. attacker 拿到 user A 的 blob
    塞到 user B row, decrypt 时 AAD 不匹配 → InvalidTag).
    """
    master = _gen_master_key_hex()
    blob = encrypt_api_key(plaintext="sk-test", user_id=1, master_key_hex=master)
    with pytest.raises(InvalidEncryptedBlob):
        decrypt_api_key(blob=blob, user_id=2, master_key_hex=master)


def test_decrypt_tampered_ciphertext_raises() -> None:
    """改 ciphertext 1 byte → AES-GCM auth tag 不匹配 → InvalidEncryptedBlob."""
    master = _gen_master_key_hex()
    blob = encrypt_api_key(plaintext="sk-test", user_id=1, master_key_hex=master)
    # 改 ciphertext 第一字节 (位置 13: version 1 + nonce 12 = 13 起 ct)
    tampered = bytearray(blob)
    tampered[13] ^= 0xFF
    with pytest.raises(InvalidEncryptedBlob):
        decrypt_api_key(blob=bytes(tampered), user_id=1, master_key_hex=master)


def test_decrypt_wrong_master_key_raises() -> None:
    """换 master key decrypt → InvalidEncryptedBlob."""
    master_a = _gen_master_key_hex()
    master_b = _gen_master_key_hex()
    blob = encrypt_api_key(plaintext="sk-test", user_id=1, master_key_hex=master_a)
    with pytest.raises(InvalidEncryptedBlob):
        decrypt_api_key(blob=blob, user_id=1, master_key_hex=master_b)


def test_decrypt_unsupported_version_byte_raises() -> None:
    """blob version byte != 0x01 → UnsupportedKeyVersionError (key rotation 留地)."""
    master = _gen_master_key_hex()
    blob = encrypt_api_key(plaintext="sk-test", user_id=1, master_key_hex=master)
    # 改 version byte 0x01 → 0x99 (假 future v2)
    bad_version = bytearray(blob)
    bad_version[0] = 0x99
    with pytest.raises(UnsupportedKeyVersionError):
        decrypt_api_key(blob=bytes(bad_version), user_id=1, master_key_hex=master)


def test_decrypt_short_blob_raises() -> None:
    """blob 长度 < 1 + 12 + 16 → InvalidEncryptedBlob (无法切 layout)."""
    master = _gen_master_key_hex()
    with pytest.raises(InvalidEncryptedBlob, match="too short"):
        decrypt_api_key(blob=b"\x01abc", user_id=1, master_key_hex=master)


def test_mask_api_key_long_keeps_prefix_suffix() -> None:
    """长 key (≥10 chars) 显前 5 + 后 4, 中间 ..."""
    masked = mask_api_key("sk-30c7456ee25148ec952f5e7fff318f3c")
    assert masked == "sk-30...8f3c"  # 前 5 chars 'sk-30' + 后 4 chars '8f3c'


def test_mask_api_key_short_full_mask() -> None:
    """短 key (<10 chars) 全 mask 成 '***' (异常配置, 不显部分)."""
    assert mask_api_key("short") == "***"
    assert mask_api_key("sk-x") == "***"
