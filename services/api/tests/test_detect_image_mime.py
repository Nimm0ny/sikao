"""Unit tests for `_detect_image_mime_from_bytes` helper.

Why this exists: fenbi 上游对没扩展名的资源 URL（最常见的是
`/api/planet/accessories/formulas?latex=...` 公式图）fallback 命名 `.bin`，
入库时 `mimetypes.guess_type(".bin")` 在 Windows 返回
`application/octet-stream`，导致 DB 数据脏（实际是 PNG）。本 helper 在 import
时按 magic-byte sniff 把 PNG/JPEG/GIF/WebP/BMP/SVG 还原成准确 MIME。
"""

from __future__ import annotations

from pathlib import Path

from sikao_api.modules.question_bank.application.exam_papers import _detect_image_mime_from_bytes


def _write(tmp_path: Path, name: str, data: bytes) -> Path:
    p = tmp_path / name
    p.write_bytes(data)
    return p


def test_detect_png(tmp_path: Path) -> None:
    p = _write(tmp_path, "0001.bin", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 32)
    assert _detect_image_mime_from_bytes(p) == "image/png"


def test_detect_jpeg(tmp_path: Path) -> None:
    p = _write(tmp_path, "0002.bin", b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 32)
    assert _detect_image_mime_from_bytes(p) == "image/jpeg"


def test_detect_gif87(tmp_path: Path) -> None:
    p = _write(tmp_path, "0003.bin", b"GIF87a" + b"\x00" * 32)
    assert _detect_image_mime_from_bytes(p) == "image/gif"


def test_detect_gif89(tmp_path: Path) -> None:
    p = _write(tmp_path, "0004.bin", b"GIF89a" + b"\x00" * 32)
    assert _detect_image_mime_from_bytes(p) == "image/gif"


def test_detect_webp(tmp_path: Path) -> None:
    # RIFF....WEBP: 4 bytes "RIFF" + 4 bytes size + 4 bytes "WEBP"
    p = _write(tmp_path, "0005.bin", b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 16)
    assert _detect_image_mime_from_bytes(p) == "image/webp"


def test_detect_bmp(tmp_path: Path) -> None:
    p = _write(tmp_path, "0006.bin", b"BM" + b"\x00" * 32)
    assert _detect_image_mime_from_bytes(p) == "image/bmp"


def test_detect_svg_xml_decl(tmp_path: Path) -> None:
    p = _write(tmp_path, "0007.bin", b'<?xml version="1.0"?><svg xmlns="..."></svg>')
    assert _detect_image_mime_from_bytes(p) == "image/svg+xml"


def test_detect_svg_bare_root(tmp_path: Path) -> None:
    p = _write(tmp_path, "0008.bin", b'<svg xmlns="...">...</svg>')
    assert _detect_image_mime_from_bytes(p) == "image/svg+xml"


def test_detect_svg_leading_whitespace(tmp_path: Path) -> None:
    p = _write(tmp_path, "0009.bin", b"  \n\t<svg></svg>")
    assert _detect_image_mime_from_bytes(p) == "image/svg+xml"


def test_xml_without_svg_root_returns_none(tmp_path: Path) -> None:
    # `<?xml ...?>` 也用于 RSS / SOAP / XSLT — 没 <svg> 根元素就不是 SVG
    p = _write(tmp_path, "0009b.bin", b'<?xml version="1.0"?>\n<rss version="2.0"><channel></channel></rss>')
    assert _detect_image_mime_from_bytes(p) is None


def test_xml_decl_then_svg_returns_svg(tmp_path: Path) -> None:
    # `<?xml ...?>` 之后 buffer 里出现 <svg> → 真 SVG
    p = _write(tmp_path, "0009c.bin", b'<?xml version="1.0"?>\n<!-- comment -->\n<svg xmlns="..."></svg>')
    assert _detect_image_mime_from_bytes(p) == "image/svg+xml"


def test_unknown_bytes_returns_none(tmp_path: Path) -> None:
    p = _write(tmp_path, "0010.bin", b"\x00\x01\x02not-an-image" + b"\x00" * 32)
    assert _detect_image_mime_from_bytes(p) is None


def test_empty_file_returns_none(tmp_path: Path) -> None:
    p = _write(tmp_path, "0011.bin", b"")
    assert _detect_image_mime_from_bytes(p) is None


def test_missing_file_returns_none(tmp_path: Path) -> None:
    p = tmp_path / "does-not-exist.bin"
    assert _detect_image_mime_from_bytes(p) is None
