"""Phone number normalization for Identity v2 (D2/D8).

大陆手机号 11 位纯数字 (`^1[3-9]\\d{9}$`). 用户输入可能带 `+86` / `86` 前缀
/ 空格 / 横线 — normalize_phone 全部清掉, 统一存 / 比对 / 限流 key 用 normalized.

Review fix #8: 不 normalize 会让 SMS 限流被绕开 — 同一真实号码以不同字符串
被 hash 进 limiter key, 绕过 1/min 闸. 必须 schema pre-validator + service
入口 + 限流 key 全部用 normalized.

跟 auth_recovery.normalize_email 同模式.
"""

from __future__ import annotations

import re

# 大陆手机号: 1 开头第二位 3-9, 共 11 位纯数字.
# 不放宽到 +86/国际号 (D2: 暂不支持; 公考国内市场).
_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")

# 允许出现的可读字符 (空格 / 横线 / 圆括号), 全部 strip.
_STRIP_CHARS_RE = re.compile(r"[\s\-()]+")

# 允许的国家码前缀 (大陆): +86 / 86. 严格匹配后剥离.
_CN_PREFIXES = ("+86", "86")


def normalize_phone(raw: str | None) -> str | None:
    """Strip 空白/横线/圆括号 + 去 +86/86 前缀 → 11 位纯数字.

    无法 normalize (格式不对 / 长度不对 / 1 后第二位 0-2) 返 None — 调用方
    raise ValidationError. 不在这里 raise (跟 normalize_email 行为对齐:
    pure helper, 不抛业务错误).

    Examples:
      "13800138000"        → "13800138000"
      "+86 138 0013 8000"  → "13800138000"
      "86-138-0013-8000"   → "13800138000"
      "  13800138000  "    → "13800138000"
      "12800138000"        → None (1 后第二位 2, 不合大陆段位规则)
      "1380013800"         → None (10 位, 长度不对)
      None / ""            → None
    """
    if not raw:
        return None
    cleaned = _STRIP_CHARS_RE.sub("", raw)
    for prefix in _CN_PREFIXES:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break
    if not _PHONE_RE.match(cleaned):
        return None
    return cleaned


def is_phone_format(value: str) -> bool:
    """是否能 normalize 成大陆手机号 — identifier 探测时用 (login D1)."""
    return normalize_phone(value) is not None
