"""LLM prompt SSOT package.

Slice 0a: only `_shared` module (调性 prefix).
Active prompts live beside `qa.py` / `essay_grading.py` and future Home prompts.
"""

from sikao_api.modules.llm.application.llm.prompts._shared import SYSTEM_TONE_PREFIX, with_tone

__all__ = ["SYSTEM_TONE_PREFIX", "with_tone"]
