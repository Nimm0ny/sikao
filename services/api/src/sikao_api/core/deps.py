from __future__ import annotations

from typing import cast

from fastapi import Request

from sikao_api.core.config import Settings


def get_app_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)
