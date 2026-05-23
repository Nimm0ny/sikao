from __future__ import annotations
from pathlib import Path
from sqlalchemy.orm import Session
from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult
from sikao_api.modules.llm.application.question_generator import SourceQuestion
from sikao_api.modules.system.application.errors import LLMServiceError

def build_practice_llm_settings(tmp_path: Path, *, database_url: str) -> Settings:
    return Settings(  # type: ignore[call-arg]
        _env_file=None,
        app_env="test",
        llm_provider="mock",
        database_url=database_url,
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="llm-practice-service-secret",
        app_version="llm-practice-service",
        git_sha="llm-practice-service",
        image_tag="llm-practice-service",
        build_time="2026-05-23T00:00:00Z",
        schema_version="llm-practice-service",
    )
def seed_user(session: Session, *, name: str = "Practice LLM User") -> UserV2:
    user = UserV2(display_name=name)
    session.add(user)
    session.flush()
    return user
def practice_sources() -> list[SourceQuestion]:
    return [
        SourceQuestion(
            id=101,
            revision_id=11,
            subject_kind="xingce",
            type="single_choice",
            stem="Source question one asks about logical consistency in a short passage.",
            options={"A": "Choice one", "B": "Choice two", "C": "Choice three", "D": "Choice four"},
            correct_answer="B",
            explanation="Because choice B is the only option consistent with the passage.",
            category_l1="verbal", category_l2="logic_fill", year=2024,
            region="beijing", exam_type="provincial",
        ),
        SourceQuestion(
            id=202,
            revision_id=22,
            subject_kind="xingce",
            type="multi_choice",
            stem="Source question two asks for multiple valid policy trade-offs.",
            options={"A": "Trade-off A", "B": "Trade-off B", "C": "Trade-off C", "D": "Trade-off D"},
            correct_answer="AC",
            explanation="A and C are both supported by the material and the others are not.",
            category_l1="verbal", category_l2="reading", year=2023,
            region="shanghai", exam_type="municipal",
        ),
    ]
_REFERENCE_ANSWER_CONTENT = '{"content": "' + ("A" * 950) + '", "structure_outline": ["Opening thesis", "Body analysis", "Closing summary"], "key_points": ["Grounded in materials", "Clear argument", "Complete structure"], "estimated_score": 86.0}'
class ReferenceAuditFailProvider:
    def __init__(self) -> None:
        self._calls = 0

    async def chat_completion(self, **_kwargs: object) -> ChatCompletionResult:
        self._calls += 1
        if self._calls == 1:
            return ChatCompletionResult(
                content=_REFERENCE_ANSWER_CONTENT,
                prompt_tokens=120,
                prompt_cache_hit_tokens=0,
                prompt_cache_miss_tokens=120,
                completion_tokens=180,
                model="mock-model",
                finish_reason="stop",
            )
        raise LLMServiceError("audit unavailable", code="llm_service_unavailable")
class ReferenceAuditParseFailProvider:
    def __init__(self) -> None:
        self._calls = 0

    async def chat_completion(self, **_kwargs: object) -> ChatCompletionResult:
        self._calls += 1
        if self._calls == 1:
            return ChatCompletionResult(
                content=_REFERENCE_ANSWER_CONTENT,
                prompt_tokens=120,
                prompt_cache_hit_tokens=0,
                prompt_cache_miss_tokens=120,
                completion_tokens=180,
                model="mock-model",
                finish_reason="stop",
            )
        return ChatCompletionResult(
            content='{"passed": true, "confidence": "broken"}',
            prompt_tokens=90,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=90,
            completion_tokens=70,
            model="mock-model",
            finish_reason="stop",
        )
