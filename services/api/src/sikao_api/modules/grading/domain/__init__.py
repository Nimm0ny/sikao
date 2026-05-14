"""Re-export domain ORM types used by `grading` module.

注：本轮 essay grading 已并入新建 `essay` module；本占位等 ADR
决定是否拆「申论评分 vs xingce 客观判分」边界。
"""
from sikao_api.db.models import EssayGradingRecord

__all__ = ["EssayGradingRecord"]
