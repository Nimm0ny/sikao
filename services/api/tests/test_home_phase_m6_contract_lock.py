from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
import sys

from sikao_api.main import create_app


REPO_ROOT = Path(__file__).resolve().parents[3]
OPENAPI_SPEC_PATH = REPO_ROOT / "services" / "api" / "spec" / "openapi.json"
GENERATED_TYPES_PATH = REPO_ROOT / "packages" / "api-client" / "src" / "types" / "api.generated.ts"
GENERATE_TYPES_SCRIPT_PATH = REPO_ROOT / "scripts" / "generate-api-types.sh"


def test_home_m6_checked_in_openapi_matches_live_app_and_removes_records_shim() -> None:
    checked_in = json.loads(OPENAPI_SPEC_PATH.read_text(encoding="utf-8"))
    live_schema = create_app().openapi()

    assert checked_in == live_schema
    assert "/api/v2/profile/records" in checked_in["paths"]
    assert "/api/v2/dashboard/records" not in checked_in["paths"]


def test_home_m6_generated_types_only_expose_canonical_records_route() -> None:
    text = GENERATED_TYPES_PATH.read_text(encoding="utf-8")

    assert '"/api/v2/profile/records"' in text
    assert '"/api/v2/dashboard/records"' not in text
    assert "get_profile_records_api_v2_profile_records_get" in text
    assert "get_dashboard_records_api_v2_dashboard_records_get" not in text


def test_home_m6_typegen_script_reuses_backend_openapi_export_entrypoint() -> None:
    text = GENERATE_TYPES_SCRIPT_PATH.read_text(encoding="utf-8")

    assert "services/api/scripts/export_openapi.py" in text
    assert "services/api/spec/openapi.json" in text
    assert "openapi-typescript services/api/spec/openapi.json" in text


def test_home_m6_regenerated_spec_and_types_match_checked_in_artifacts(tmp_path: Path) -> None:
    regenerated_spec_path = tmp_path / "openapi.regenerated.json"
    regenerated_types_path = tmp_path / "api.generated.regenerated.ts"
    npx_command = shutil.which("npx.cmd") or shutil.which("npx")
    assert npx_command is not None

    subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "services" / "api" / "scripts" / "export_openapi.py"),
            "--out",
            str(regenerated_spec_path),
        ],
        cwd=REPO_ROOT,
        check=True,
    )
    assert regenerated_spec_path.read_text(encoding="utf-8") == OPENAPI_SPEC_PATH.read_text(encoding="utf-8")

    subprocess.run(
        [
            npx_command,
            "openapi-typescript",
            str(regenerated_spec_path),
            "-o",
            str(regenerated_types_path),
        ],
        cwd=REPO_ROOT,
        check=True,
    )
    assert regenerated_types_path.read_text(encoding="utf-8") == GENERATED_TYPES_PATH.read_text(encoding="utf-8")
