"""Re-export domain ORM types used by `favorite` module.

注：本轮 NoteFavorite 跟 notes 一起留在 notes module，favorite 暂为占位。
后续若拆 "题目收藏 / 笔记收藏" 独立模块再补。
"""
from sikao_api.db.models import NoteFavorite

__all__ = ["NoteFavorite"]
