"""Sync fenbi paper data from host VPS to local mirror.

按 CLAUDE.md §12 「数据导入设计规范」 mirror 层实现：
- SSH 连接 host VPS，远程列举 papers/<id_name>/ 目录
- 对每个 paper 比较本地 size 决定是否下载（缺失 / size 不匹配则 SCP）
- 已完整下载的 paper 跳过（rsync-like 增量）
- 写 manifest.json 作为 reporting：synced_at / paper count / new / skipped / failed

CLI:
    python -m scripts.import.sync_fenbi_mirror \\
        --host 8.163.20.252 --user root --password '...' \\
        --remote /root/fenbi_scraper/fenbi_output \\
        --local D:/py_pj/backend_data/xingce

SIKAO 2026-05-13: sikao 改 mirror 落点为 `backend_data/xingce/`（脱离 .claude 单仓约束）。
backend_data 是 sikao 之外的冷存路径，gitignored 体积无上限。

环境变量替代 CLI（避免密码进 shell history）：
    FENBI_HOST / FENBI_USER / FENBI_PASSWORD / FENBI_REMOTE / FENBI_LOCAL
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import paramiko

logger = logging.getLogger(__name__)

DEFAULT_REMOTE = "/root/fenbi_scraper/fenbi_output"
DEFAULT_LOCAL = "D:/py_pj/backend_data/xingce"

# ARCH §7.3 P3 修: paramiko 单 SSH 连接持续 240+ 套 paper sync 中约 23 套
# 触发 "Socket is closed" (sshd 超时 / 连接复用过久). 加 reconnect interval —
# 每 sync N 套就 close-then-reopen sftp transport. 50 套是经验值: 没失败时
# overhead 微小, 失败时把 burst 限制在 50 套内.
RECONNECT_EVERY_N_PAPERS = 50


def sync(
    *,
    host: str,
    user: str,
    password: str,
    remote_root: str,
    local_root: Path,
    expected_fingerprint: str,
    timeout: int = 30,
) -> dict[str, Any]:
    """Pull all fenbi papers from host VPS into local mirror.

    expected_fingerprint: 形如 'SHA256:rmA+dO7/...'。连接后立即校验，不一致 abort
    （CLAUDE.md §8 VPS 铁律 — 不允许静默信任未知 host key）。

    Returns a manifest dict (also written to <local_root>/manifest.json).
    """
    local_root = local_root.resolve()
    local_papers = local_root / "papers"
    local_papers.mkdir(parents=True, exist_ok=True)

    # connect_factory 给 _do_sync 当 reconnect 用 — 每 RECONNECT_EVERY_N_PAPERS
    # 套就重建 sftp/transport, 防长连接超时 ("Socket is closed").
    def connect_factory() -> tuple[paramiko.Transport, paramiko.SFTPClient]:
        return _establish_sftp(
            host=host,
            user=user,
            password=password,
            expected_fingerprint=expected_fingerprint,
            timeout=timeout,
        )

    transport, sftp = connect_factory()
    try:
        return _do_sync(
            sftp=sftp,
            transport=transport,
            connect_factory=connect_factory,
            remote_root=remote_root,
            local_papers=local_papers,
            local_root=local_root,
        )
    finally:
        try:
            sftp.close()
        except Exception:  # noqa: BLE001 — close best-effort, sftp may already be dead
            pass
        try:
            transport.close()
        except Exception:  # noqa: BLE001
            pass


def _establish_sftp(
    *,
    host: str,
    user: str,
    password: str,
    expected_fingerprint: str,
    timeout: int,
) -> tuple[paramiko.Transport, paramiko.SFTPClient]:
    """Open a fresh SSH transport + SFTP channel. Reusable for reconnect.

    RejectPolicy + 手动 fingerprint 校验 — 第一次连接就拒绝未知 host key,
    避免 AutoAddPolicy 静默 trust on first use 留下的 MITM 空窗.
    """
    transport = paramiko.Transport((host, 22))
    transport.start_client(timeout=timeout)
    actual_fp = _server_fingerprint(transport)
    if actual_fp != expected_fingerprint:
        transport.close()
        raise RuntimeError(
            f"host key fingerprint mismatch: expected {expected_fingerprint}, got {actual_fp}"
        )
    transport.auth_password(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    if sftp is None:
        transport.close()
        raise RuntimeError("failed to open SFTP channel")
    return transport, sftp


def _server_fingerprint(transport: paramiko.Transport) -> str:
    key = transport.get_remote_server_key()
    digest = hashlib.sha256(key.asbytes()).digest()
    return "SHA256:" + base64.b64encode(digest).decode().rstrip("=")


def _do_sync(
    *,
    sftp: paramiko.SFTPClient,
    transport: paramiko.Transport,
    connect_factory: Any,  # callable returning (transport, sftp)
    remote_root: str,
    local_papers: Path,
    local_root: Path,
) -> dict[str, Any]:
    remote_papers_root = f"{remote_root.rstrip('/')}/papers"
    paper_dirs = _safe_listdir(sftp, remote_papers_root)
    if not paper_dirs:
        raise RuntimeError(f"no paper directories found under {remote_papers_root}")

    new_papers: list[str] = []
    skipped_papers: list[str] = []
    failed_papers: list[tuple[str, str]] = []

    for idx, paper_dir in enumerate(sorted(paper_dirs)):
        # 每 RECONNECT_EVERY_N_PAPERS 套主动 reconnect, 防长连接 sshd 超时.
        # 不在第 0 套 reconnect (启动连接刚建好). idx > 0 是关键 guard.
        if idx > 0 and idx % RECONNECT_EVERY_N_PAPERS == 0:
            print(f"  [RECONN ] reconnecting after {idx} papers...")
            try:
                sftp.close()
                transport.close()
            except Exception:  # noqa: BLE001 — old session may be dead, OK
                pass
            transport, sftp = connect_factory()
        try:
            status = _sync_one_paper(
                sftp=sftp,
                remote_paper_dir=f"{remote_papers_root}/{paper_dir}",
                local_paper_dir=local_papers / paper_dir,
            )
            if status == "new":
                new_papers.append(paper_dir)
            else:
                skipped_papers.append(paper_dir)
            print(f"  [{status:7s}] {paper_dir[:60]}")
        except Exception as exc:
            err_msg = str(exc)
            failed_papers.append((paper_dir, err_msg))
            print(f"  [FAILED ] {paper_dir[:60]}: {err_msg}")
            # "Socket is closed" / EOFError 等连接级错误 — 立即 reconnect 让
            # 后续 paper 从新 session 跑, 不至于全爆.
            if "Socket is closed" in err_msg or "EOF" in err_msg:
                print("  [RECONN ] connection-level error detected, reconnecting...")
                try:
                    sftp.close()
                    transport.close()
                except Exception:  # noqa: BLE001
                    pass
                try:
                    transport, sftp = connect_factory()
                except Exception as reconn_exc:  # noqa: BLE001
                    print(f"  [FATAL  ] reconnect failed: {reconn_exc}")
                    break  # 重连不上, 后续无意义

    manifest: dict[str, Any] = {
        "synced_at": datetime.now(UTC).isoformat(),
        "host": "fenbi-host",
        "remote_root": remote_root,
        "paper_count": len(paper_dirs),
        "new_count": len(new_papers),
        "skipped_count": len(skipped_papers),
        "failed_count": len(failed_papers),
        "new_papers": new_papers,
        "failed": [{"paper": p, "error": e} for p, e in failed_papers],
    }
    _write_atomic(local_root / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    return manifest


def _write_atomic(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def _sync_one_paper(*, sftp: paramiko.SFTPClient, remote_paper_dir: str, local_paper_dir: Path) -> str:
    """Sync a single paper directory. Returns 'new' (downloaded) or 'skipped' (already complete)."""
    remote_paper_json = f"{remote_paper_dir}/paper.json"
    remote_assets_dir = f"{remote_paper_dir}/assets"

    remote_paper_stat = sftp.stat(remote_paper_json)
    remote_asset_files = _safe_listdir(sftp, remote_assets_dir)
    remote_asset_total_size = sum(
        sftp.stat(f"{remote_assets_dir}/{name}").st_size for name in remote_asset_files
    )

    local_paper_json = local_paper_dir / "paper.json"
    local_assets_dir = local_paper_dir / "assets"

    # 一致性判定：size 一致只能保证字节长度，远端覆盖同长度文件不会被发现 →
    # 用 (size, mtime) 复合判定，二者都吻合才信任本地副本（CLAUDE.md §12 mirror
    # 层 dedupe 的安全锚）。assets 也按 数量+总长 + paper.json 自身的 mtime 兜底。
    if (
        local_paper_json.is_file()
        and local_paper_json.stat().st_size == remote_paper_stat.st_size
        and int(local_paper_json.stat().st_mtime) == int(remote_paper_stat.st_mtime or 0)
        and local_assets_dir.is_dir()
    ):
        local_asset_files = [f for f in local_assets_dir.iterdir() if f.is_file()]
        local_total_size = sum(f.stat().st_size for f in local_asset_files)
        if len(local_asset_files) == len(remote_asset_files) and local_total_size == remote_asset_total_size:
            return "skipped"

    # 不一致 → 全量下载到 .tmp 再 rename，避免半文件被下次跑误判完整。
    local_paper_dir.mkdir(parents=True, exist_ok=True)
    local_assets_dir.mkdir(parents=True, exist_ok=True)
    _download_atomic(sftp, remote_paper_json, local_paper_json)
    if remote_paper_stat.st_mtime is not None:
        os.utime(local_paper_json, (remote_paper_stat.st_mtime, remote_paper_stat.st_mtime))
    for name in remote_asset_files:
        _download_atomic(sftp, f"{remote_assets_dir}/{name}", local_assets_dir / name)
    return "new"


def _download_atomic(sftp: paramiko.SFTPClient, remote: str, local: Path) -> None:
    tmp = local.with_suffix(local.suffix + ".tmp")
    sftp.get(remote, str(tmp))
    os.replace(tmp, local)


def _safe_listdir(sftp: paramiko.SFTPClient, remote_dir: str) -> list[str]:
    try:
        return sftp.listdir(remote_dir)
    except FileNotFoundError:
        return []


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    # 凭据 + fingerprint 全走 env：CLI 形式残留 shell history（CLAUDE.md §12 安全），
    # 且 fingerprint 是 strict required（不允许"信任未知 host key"）。
    parser.add_argument("--host", default=os.environ.get("FENBI_HOST"), help="VPS host (env: FENBI_HOST)")
    parser.add_argument("--user", default=os.environ.get("FENBI_USER"), help="SSH user (env: FENBI_USER)")
    parser.add_argument(
        "--fingerprint",
        default=os.environ.get("FENBI_FINGERPRINT"),
        help="Expected SHA256 host key fingerprint, e.g. SHA256:rmA+dO7/... (env: FENBI_FINGERPRINT)",
    )
    parser.add_argument("--remote", default=os.environ.get("FENBI_REMOTE", DEFAULT_REMOTE))
    parser.add_argument("--local", default=os.environ.get("FENBI_LOCAL", DEFAULT_LOCAL), type=Path)
    args = parser.parse_args(argv)

    password = os.environ.get("FENBI_PASSWORD")
    if not (args.host and args.user and password and args.fingerprint):
        parser.error(
            "missing required: FENBI_HOST / FENBI_USER / FENBI_PASSWORD / FENBI_FINGERPRINT must all be set in env"
        )

    print(f"Sync fenbi mirror: {args.host} → {args.local}")
    manifest = sync(
        host=args.host,
        user=args.user,
        password=password,
        remote_root=args.remote,
        local_root=args.local,
        expected_fingerprint=args.fingerprint,
    )
    print()
    print(f"Done: {manifest['paper_count']} papers total — "
          f"{manifest['new_count']} new, {manifest['skipped_count']} skipped, {manifest['failed_count']} failed")
    print(f"Manifest written to {args.local}/manifest.json")
    return 0 if manifest["failed_count"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
