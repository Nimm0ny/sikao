"""Re-export domain ORM types used by `paper` module.

注：本轮迁移 paper 内容已合并到 `question_bank`（papers_v2 → question_bank）。
此 module 保留占位待 ADR 决定是否拆 paper/question-bank 边界。
"""
from sikao_api.db.models import Paper, PaperBlock, PaperRevision, PaperSection

__all__ = ["Paper", "PaperBlock", "PaperRevision", "PaperSection"]
