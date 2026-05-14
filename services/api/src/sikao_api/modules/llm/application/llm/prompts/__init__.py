"""LLM prompt SSOT package.

Slice 0a: only `_shared` module (调性 prefix).
Slice 1a / 2c / 3a 各自加 qa.py / essay_grading.py / study_plan.py.
"""

from sikao_api.modules.llm.application.llm.prompts._shared import SYSTEM_TONE_PREFIX, with_tone

__all__ = ["SYSTEM_TONE_PREFIX", "with_tone"]
