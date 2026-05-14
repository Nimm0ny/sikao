from __future__ import annotations

from fastapi import Request

from sikao_api.core.config import Settings


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings
