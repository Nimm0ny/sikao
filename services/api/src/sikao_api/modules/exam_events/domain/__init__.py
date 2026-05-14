"""Re-export domain ORM types used by `exam_events` module."""
from sikao_api.db.models import ExamEvent, utc_now

__all__ = ["ExamEvent", "utc_now"]
