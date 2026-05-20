from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AuthSessionV2, EmailContactV2, PasswordCredentialV2, PhoneContactV2, ProfileGoalV2, ProfileInfoV2, UserV2
from sikao_api.db.schemas_v2 import ActionLinkV2, ProfileGoalsResponseV2, ProfileGoalsUpdateRequestV2, ProfileInfoResponseV2, ProfileInfoUpdateRequestV2, ProfileOverviewResponseV2, ProfileSecurityResponseV2, ProfileSecurityUpdateRequestV2, SectionCardV2, SummaryMetricV2
from sikao_api.modules.identity.application.security_v2 import hash_password, verify_password


class ProfileServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def build_overview(self, *, user: UserV2) -> ProfileOverviewResponseV2:
        return ProfileOverviewResponseV2(
            summary=[
                SummaryMetricV2(key="user", label="User", value=user.display_name),
                SummaryMetricV2(key="state", label="State", value="active" if user.is_active else "inactive"),
            ],
            sections=[
                SectionCardV2(key="security", title="账号安全", description="管理密码、邮箱和手机。", status="ready", href="/profile/security"),
                SectionCardV2(key="goals", title="目标设置", description="管理目标考试和目标分数。", status="ready", href="/profile/goals"),
                SectionCardV2(key="info", title="个人信息", description="管理个人资料。", status="ready", href="/profile/info"),
            ],
            actions=[
                ActionLinkV2(key="security", label="账号安全", href="/profile/security"),
                ActionLinkV2(key="goals", label="目标设置", href="/profile/goals"),
                ActionLinkV2(key="info", label="个人信息", href="/profile/info"),
            ],
        )

    def get_security(self, *, user: UserV2) -> ProfileSecurityResponseV2:
        email_bound = self.session.scalar(
            select(func.count()).select_from(EmailContactV2).where(EmailContactV2.user_id == user.id)
        ) or 0
        phone_bound = self.session.scalar(
            select(func.count()).select_from(PhoneContactV2).where(PhoneContactV2.user_id == user.id)
        ) or 0
        active_sessions = self.session.scalar(
            select(func.count()).select_from(AuthSessionV2).where(
                AuthSessionV2.user_id == user.id,
                AuthSessionV2.revoked_at.is_(None),
                AuthSessionV2.expires_at > datetime.now(UTC).replace(tzinfo=None),
            )
        ) or 0
        password_set = self.session.scalar(
            select(func.count()).select_from(PasswordCredentialV2).where(PasswordCredentialV2.user_id == user.id)
        ) or 0
        return ProfileSecurityResponseV2(
            password_set=bool(password_set),
            email_bound=bool(email_bound),
            phone_bound=bool(phone_bound),
            active_sessions=int(active_sessions),
        )

    def update_security(self, *, user: UserV2, payload: ProfileSecurityUpdateRequestV2) -> ProfileSecurityResponseV2:
        credential = self.session.scalar(
            select(PasswordCredentialV2).where(PasswordCredentialV2.user_id == user.id)
        )
        if credential is None:
            credential = PasswordCredentialV2(user_id=user.id, password_hash=hash_password(payload.new_password))
            self.session.add(credential)
        else:
            if not verify_password(payload.current_password, credential.password_hash):
                from sikao_api.modules.system.application.errors import UnauthorizedError

                raise UnauthorizedError("current password mismatch", code="current_password_mismatch")
            credential.password_hash = hash_password(payload.new_password)
            self.session.add(credential)
        return self.get_security(user=user)

    def get_goals(self, *, user: UserV2) -> ProfileGoalsResponseV2:
        goal = self.session.scalar(select(ProfileGoalV2).where(ProfileGoalV2.user_id == user.id))
        if goal is None:
            return ProfileGoalsResponseV2()
        return ProfileGoalsResponseV2(
            target_exam=goal.target_exam,
            target_score=goal.target_score,
            weekly_target_hours=goal.weekly_target_hours,
        )

    def update_goals(self, *, user: UserV2, payload: ProfileGoalsUpdateRequestV2) -> ProfileGoalsResponseV2:
        goal = self.session.scalar(select(ProfileGoalV2).where(ProfileGoalV2.user_id == user.id))
        if goal is None:
            goal = ProfileGoalV2(user_id=user.id)
            self.session.add(goal)
            self.session.flush()
        goal.target_exam = payload.target_exam
        goal.target_score = payload.target_score
        goal.weekly_target_hours = payload.weekly_target_hours
        self.session.add(goal)
        return self.get_goals(user=user)

    def get_info(self, *, user: UserV2) -> ProfileInfoResponseV2:
        info = self.session.scalar(select(ProfileInfoV2).where(ProfileInfoV2.user_id == user.id))
        if info is None:
            return ProfileInfoResponseV2(display_name=user.display_name)
        return ProfileInfoResponseV2(
            display_name=user.display_name,
            real_name=info.real_name,
            region=info.region,
            bio=info.bio,
        )

    def update_info(self, *, user: UserV2, payload: ProfileInfoUpdateRequestV2) -> ProfileInfoResponseV2:
        info = self.session.scalar(select(ProfileInfoV2).where(ProfileInfoV2.user_id == user.id))
        if info is None:
            info = ProfileInfoV2(user_id=user.id)
            self.session.add(info)
            self.session.flush()
        user.display_name = payload.display_name
        info.real_name = payload.real_name
        info.region = payload.region
        info.bio = payload.bio
        self.session.add_all([user, info])
        return self.get_info(user=user)
