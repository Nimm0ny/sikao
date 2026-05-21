from __future__ import annotations

import argparse

from sqlalchemy import select

from sikao_api.db.models import User
from sikao_api.db.models_v2 import EmailContactV2, PasswordCredentialV2, PhoneContactV2, UserV2
from sikao_api.modules.identity.application.security_v2 import normalize_email, normalize_phone
from sikao_api.scripts.backfill_v2_common import (
    BackfillStats,
    add_common_args,
    commit_or_rollback,
    iter_with_limit,
    legacy_public_id,
    open_session,
    trim_or_none,
)


def run(*, database_url: str | None, dry_run: bool, limit: int | None) -> int:
    session, _db = open_session(database_url=database_url)
    stats = BackfillStats()
    try:
        users = list(session.scalars(select(User).order_by(User.id.asc())))
        for legacy_user in iter_with_limit(users, limit=limit):
            stats.scanned += 1
            public_id = legacy_public_id(legacy_user.id)
            user_v2 = session.scalar(
                select(UserV2).where(UserV2.public_id == public_id)
            )
            if user_v2 is None:
                user_v2 = UserV2(
                    public_id=public_id,
                    display_name=legacy_user.display_name,
                    is_active=legacy_user.is_active,
                    created_at=legacy_user.created_at,
                    updated_at=legacy_user.updated_at,
                )
                session.add(user_v2)
                session.flush()
                stats.inserted += 1
            else:
                changed = False
                if user_v2.display_name != legacy_user.display_name:
                    user_v2.display_name = legacy_user.display_name
                    changed = True
                if user_v2.is_active != legacy_user.is_active:
                    user_v2.is_active = legacy_user.is_active
                    changed = True
                if changed:
                    session.add(user_v2)
                    stats.updated += 1
                else:
                    stats.skipped += 1

            credential = session.scalar(
                select(PasswordCredentialV2).where(
                    PasswordCredentialV2.user_id == user_v2.id
                )
            )
            if credential is None:
                session.add(
                    PasswordCredentialV2(
                        user_id=user_v2.id,
                        password_hash=legacy_user.password_hash,
                        created_at=legacy_user.created_at,
                        updated_at=legacy_user.updated_at,
                    )
                )
            elif credential.password_hash != legacy_user.password_hash:
                credential.password_hash = legacy_user.password_hash
                session.add(credential)

            email = trim_or_none(legacy_user.email)
            if email is not None:
                normalized_email = normalize_email(email)
                email_contact = session.scalar(
                    select(EmailContactV2).where(EmailContactV2.email == normalized_email)
                )
                if email_contact is None:
                    session.add(
                        EmailContactV2(
                            user_id=user_v2.id,
                            email=normalized_email,
                            is_primary=True,
                            is_verified=legacy_user.email_verified,
                            created_at=legacy_user.created_at,
                            updated_at=legacy_user.updated_at,
                        )
                    )
                elif email_contact.user_id != user_v2.id:
                    stats.conflicts += 1
                else:
                    changed = False
                    if email_contact.is_verified != legacy_user.email_verified:
                        email_contact.is_verified = legacy_user.email_verified
                        changed = True
                    if changed:
                        session.add(email_contact)

            phone = trim_or_none(legacy_user.phone)
            if phone is not None:
                normalized_phone = normalize_phone(phone)
                if normalized_phone:
                    phone_contact = session.scalar(
                        select(PhoneContactV2).where(
                            PhoneContactV2.phone == normalized_phone
                        )
                    )
                    if phone_contact is None:
                        session.add(
                            PhoneContactV2(
                                user_id=user_v2.id,
                                phone=normalized_phone,
                                is_primary=True,
                                is_verified=legacy_user.phone_verified,
                                created_at=legacy_user.created_at,
                                updated_at=legacy_user.updated_at,
                            )
                        )
                    elif phone_contact.user_id != user_v2.id:
                        stats.conflicts += 1
                    else:
                        changed = False
                        if phone_contact.is_verified != legacy_user.phone_verified:
                            phone_contact.is_verified = legacy_user.phone_verified
                            changed = True
                        if changed:
                            session.add(phone_contact)

        commit_or_rollback(session, dry_run=dry_run)
    finally:
        session.close()
    stats.emit(scope="identity", dry_run=dry_run)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="backfill_v2_identity",
        description="Backfill legacy users into users_v2 and identity contacts.",
    )
    add_common_args(parser)
    args = parser.parse_args()
    return run(
        database_url=args.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
    )


if __name__ == "__main__":
    raise SystemExit(main())
