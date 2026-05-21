from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AccountDeletionJobV2, AuthSessionV2, EmailContactV2, PasswordCredentialV2, PhoneContactV2, ProfileGoalV2, ProfileInfoV2, UserV2
from sikao_api.db.schemas_v2 import (
    AccountDeletionRequestV2,
    AccountDeletionResponseV2,
    ActionLinkV2,
    BindPhoneRequestV2,
    ExamTargetV2,
    ProfileGoalsResponseV2,
    ProfileGoalsUpdateRequestV2,
    ProfileInfoResponseV2,
    ProfileInfoUpdateRequestV2,
    ProfileOverviewResponseV2,
    ProfilePreferencesResponseV2,
    ProfilePreferencesUpdateRequestV2,
    ProfileSecurityResponseV2,
    ProfileSecurityUpdateRequestV2,
    ProfileSettingsResponseV2,
    ProfileSettingsUpdateRequestV2,
    SectionCardV2,
    SummaryMetricV2,
)
from sikao_api.modules.identity.application.security_v2 import hash_password, verify_password
from sikao_api.modules.system.application.errors import ConflictError, UnauthorizedError, ValidationError


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
                SectionCardV2(
                    key="security",
                    title="Account security",
                    description="Password and bound contact methods.",
                    status="ready",
                    href="/profile/security",
                ),
                SectionCardV2(
                    key="goals",
                    title="Goal settings",
                    description="Exam targets and study goals.",
                    status="ready",
                    href="/profile/goals",
                ),
                SectionCardV2(
                    key="info",
                    title="Profile info",
                    description="Personal info and Home preferences.",
                    status="ready",
                    href="/profile/info",
                ),
            ],
            actions=[
                ActionLinkV2(key="security", label="Account security", href="/profile/security"),
                ActionLinkV2(key="goals", label="Goal settings", href="/profile/goals"),
                ActionLinkV2(key="info", label="Profile info", href="/profile/info"),
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
        credential = self.session.scalar(select(PasswordCredentialV2).where(PasswordCredentialV2.user_id == user.id))
        if credential is None:
            credential = PasswordCredentialV2(user_id=user.id, password_hash=hash_password(payload.new_password))
            self.session.add(credential)
        else:
            if not verify_password(payload.current_password, credential.password_hash):
                raise UnauthorizedError("current password mismatch", code="current_password_mismatch")
            credential.password_hash = hash_password(payload.new_password)
            self.session.add(credential)
        return self.get_security(user=user)

    def get_goals(self, *, user: UserV2) -> ProfileGoalsResponseV2:
        goal = self.session.scalar(select(ProfileGoalV2).where(ProfileGoalV2.user_id == user.id))
        if goal is None:
            return ProfileGoalsResponseV2(exam_targets=[])
        return ProfileGoalsResponseV2(
            target_exam=goal.target_exam,
            target_score=goal.target_score,
            weekly_target_hours=goal.weekly_target_hours,
            exam_targets=[ExamTargetV2.model_validate(item) for item in goal.exam_targets],
        )

    def update_goals(self, *, user: UserV2, payload: ProfileGoalsUpdateRequestV2) -> ProfileGoalsResponseV2:
        goal = self.session.scalar(select(ProfileGoalV2).where(ProfileGoalV2.user_id == user.id))
        if goal is None:
            goal = ProfileGoalV2(user_id=user.id)
            self.session.add(goal)
            self.session.flush()
        if payload.target_exam is not None:
            goal.target_exam = payload.target_exam
        if payload.target_score is not None:
            goal.target_score = payload.target_score
        if payload.weekly_target_hours is not None:
            goal.weekly_target_hours = payload.weekly_target_hours
        if payload.exam_targets is not None:
            self._validate_exam_targets(payload.exam_targets)
            goal.exam_targets = [item.model_dump(mode="json") for item in payload.exam_targets]
        self.session.add(goal)
        return self.get_goals(user=user)

    def get_info(self, *, user: UserV2) -> ProfileInfoResponseV2:
        info = self.session.scalar(select(ProfileInfoV2).where(ProfileInfoV2.user_id == user.id))
        if info is None:
            return ProfileInfoResponseV2(
                display_name=user.display_name,
                ai_adjust_enabled=True,
                dashboard_preferences={},
                recommender_preferences={},
            )
        return ProfileInfoResponseV2(
            display_name=user.display_name,
            real_name=info.real_name,
            region=info.region,
            bio=info.bio,
            ai_adjust_enabled=info.ai_adjust_enabled,
            dashboard_preferences=info.dashboard_preferences,
            recommender_preferences=info.recommender_preferences,
        )

    def update_info(self, *, user: UserV2, payload: ProfileInfoUpdateRequestV2) -> ProfileInfoResponseV2:
        info = self.session.scalar(select(ProfileInfoV2).where(ProfileInfoV2.user_id == user.id))
        if info is None:
            info = ProfileInfoV2(user_id=user.id)
            self.session.add(info)
            self.session.flush()
        if payload.display_name is not None:
            user.display_name = payload.display_name
        if payload.real_name is not None:
            info.real_name = payload.real_name
        if payload.region is not None:
            info.region = payload.region
        if payload.bio is not None:
            info.bio = payload.bio
        if payload.ai_adjust_enabled is not None:
            info.ai_adjust_enabled = payload.ai_adjust_enabled
        if payload.dashboard_preferences is not None:
            info.dashboard_preferences = payload.dashboard_preferences
        if payload.recommender_preferences is not None:
            info.recommender_preferences = payload.recommender_preferences
        self.session.add_all([user, info])
        return self.get_info(user=user)

    def _validate_exam_targets(self, items: list[ExamTargetV2]) -> None:
        if len(items) > 5:
            raise ValidationError("exam_targets length must be <= 5", code="invalid_exam_targets")
        seen_ids: set[str] = set()
        today = (datetime.now(UTC) + timedelta(hours=8)).date()
        for item in items:
            if item.exam_id in seen_ids:
                raise ValidationError("exam_targets exam_id must be unique", code="invalid_exam_targets")
            seen_ids.add(item.exam_id)
            if item.exam_date < today:
                raise ValidationError("exam_targets exam_date must be today or later", code="invalid_exam_targets")

    # --- PR-P1: Settings ---

    def _get_or_create_info(self, user: UserV2) -> ProfileInfoV2:
        info = self.session.scalar(
            select(ProfileInfoV2).where(ProfileInfoV2.user_id == user.id)
        )
        if info is None:
            info = ProfileInfoV2(user_id=user.id)
            self.session.add(info)
            self.session.flush()
        return info

    def get_settings(self, *, user: UserV2) -> ProfileSettingsResponseV2:
        info = self._get_or_create_info(user)
        return ProfileSettingsResponseV2(
            ai_adjust_enabled=info.ai_adjust_enabled,
            llm_enabled=info.ai_adjust_enabled,
        )

    def update_settings(
        self, *, user: UserV2, payload: ProfileSettingsUpdateRequestV2
    ) -> ProfileSettingsResponseV2:
        info = self._get_or_create_info(user)
        info.ai_adjust_enabled = payload.ai_adjust_enabled
        self.session.add(info)
        return self.get_settings(user=user)

    # --- PR-P2: Preferences ---

    def get_preferences(self, *, user: UserV2) -> ProfilePreferencesResponseV2:
        info = self._get_or_create_info(user)
        return ProfilePreferencesResponseV2(
            dashboard_preferences=info.dashboard_preferences,
        )

    def update_preferences(
        self, *, user: UserV2, payload: ProfilePreferencesUpdateRequestV2
    ) -> ProfilePreferencesResponseV2:
        info = self._get_or_create_info(user)
        info.dashboard_preferences = payload.dashboard_preferences
        self.session.add(info)
        return self.get_preferences(user=user)

    # --- PR-P3: Account Deletion ---

    def request_deletion(
        self, *, user: UserV2, payload: AccountDeletionRequestV2
    ) -> AccountDeletionResponseV2:
        if user.deleted_at is not None:
            raise ConflictError(
                "account already scheduled for deletion",
                code="already_deleting",
            )
        if payload.confirmation != "确认注销":
            raise ValidationError(
                "confirmation text must be '确认注销'",
                code="invalid_confirmation",
            )

        now = datetime.now(UTC).replace(tzinfo=None)
        hard_delete_at = now + timedelta(days=7)

        user.deleted_at = now
        user.deletion_reason = payload.reason
        user.is_active = False
        self.session.add(user)

        from sqlalchemy import update

        self.session.execute(
            update(AuthSessionV2)
            .where(
                AuthSessionV2.user_id == user.id,
                AuthSessionV2.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )

        job = AccountDeletionJobV2(
            user_id=user.id,
            requested_at=now,
            hard_delete_at=hard_delete_at,
            status="pending",
            reason=payload.reason,
        )
        self.session.add(job)

        return AccountDeletionResponseV2(
            message="账号已注销，将在 7 天后永久删除。",
            hard_delete_at=hard_delete_at,
        )

    # --- PR-P4: Bind Phone stub ---

    def bind_phone_stub(
        self, *, user: UserV2, payload: BindPhoneRequestV2
    ) -> None:
        raise NotImplementedError("bind-phone not yet implemented")
