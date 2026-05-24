from __future__ import annotations

from typing import Final, Literal


ConfidenceLevel = Literal["guess", "unsure", "likely", "certain"]

INTERVALS: Final[list[int]] = [1, 3, 7, 21]
GRADUATION_THRESHOLD: Final[int] = 4
PROBATION_DURATION_DAYS: Final[int] = 30
DEFAULT_TIMEZONE: Final[str] = "Asia/Shanghai"

ALGORITHM_VERSION_SIMPLE: Final[str] = "simple_v1"
ALGORITHM_VERSION_SM2: Final[str] = "sm2_v1"

CONFIDENCE_RECALL_MULTIPLIER: Final[dict[tuple[ConfidenceLevel, bool], float]] = {
    ("guess", False): 1.0,
    ("guess", True): 1.0,
    ("unsure", False): 0.5,
    ("unsure", True): 1.0,
    ("likely", False): 1.0,
    ("likely", True): 1.5,
    ("certain", False): 1.0,
    ("certain", True): 2.0,
}
