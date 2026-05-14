from __future__ import annotations

import argparse

from sikao_api.core.config import get_settings
from sikao_api.db.session import DatabaseManager
from sikao_api.db.models import User
from sikao_api.modules.auth.application.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(prog="exam-api")
    subparsers = parser.add_subparsers(dest="command")
    parser.add_argument("--version", action="store_true")

    create_user_parser = subparsers.add_parser("create-user")
    create_user_parser.add_argument("--username", required=True)
    create_user_parser.add_argument("--password", required=True)
    create_user_parser.add_argument("--display-name", required=False)

    args = parser.parse_args()
    if args.version:
        print("exam-api 0.1.0")
        return

    if args.command == "create-user":
        settings = get_settings()
        db = DatabaseManager(settings)
        if settings.is_sqlite:
            db.create_all()
        session = db.session_factory()
        try:
            username = args.username.strip()
            display_name = (args.display_name or username).strip()
            user = session.query(User).filter(User.username == username).one_or_none()
            if user is None:
                user = User(username=username, display_name=display_name, password_hash=hash_password(args.password))
                session.add(user)
            else:
                user.display_name = display_name
                user.password_hash = hash_password(args.password)
                user.is_active = True
            session.commit()
            print(f"user ready: {username}")
        finally:
            session.close()


# Phase 5.6 E2E fix —— 加 entry guard 让 `python -m sikao_api.cli.main` 也能跑（之前
# 只能通过 pyproject 注册的 `sikao-api` console_script 跑，缺这一行 module
# 加载完后 main() 不被调用，命令静默退出）。
if __name__ == "__main__":
    main()
