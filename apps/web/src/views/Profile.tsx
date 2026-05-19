import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogoutIcon } from '@sikao/ui/icons';
import { Button } from '@sikao/ui/ui';
import { AccountSecuritySection } from '@/components/profile/AccountSecuritySection';
import { EmailPanel } from '@/components/profile/EmailPanel';
import { ProfileBasicInfo } from '@/components/profile/ProfileBasicInfo';
import { ProfileLearningToolsCard } from '@/components/profile/ProfileLearningToolsCard';
import {
  ProfileSidePanel,
  type ProfileStatsData,
} from '@/components/profile/ProfileSidePanel';
import { ProfilePreferences } from '@/components/profile/ProfilePreferences';
import { ProfileSubscriptionCard } from '@/components/profile/ProfileSubscriptionCard';
import { api } from '@sikao/api-client/request';
import {
  dashboardKeys,
  fetchDashboardSummary,
} from '@sikao/api-client/apiQueries';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { PROFILE_COPY } from '@/lib/ui-copy';

const PROFILE_MOCK = {
  examTarget: null,
  examRegion: null,
  dailyReminder: null,
  fontSizeLabel: PROFILE_COPY.preferencesFontDefault,
  shortcutsOn: true,
  subscription: {
    tierLabel: PROFILE_COPY.subscriptionTierPremium,
    billingCycle: PROFILE_COPY.subscriptionBillingMonthly,
    renewDate: null,
    perks: PROFILE_COPY.subscriptionDefaultPerks,
    priceLabel: PROFILE_COPY.subscriptionPriceLabel,
    priceCycle: PROFILE_COPY.subscriptionPriceCycle,
  },
} as const;

function useProfileStats(): ProfileStatsData {
  const query = useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: fetchDashboardSummary,
    staleTime: 30_000,
  });

  return {
    currentStreakDays: query.data?.currentStreakDays ?? null,
    totalAnswered: query.data?.totalAnswered ?? null,
    totalWrongQuestions: query.data?.totalWrongQuestions ?? null,
    cumulativeHours: null,
    membershipTier: null,
  };
}

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const stats = useProfileStats();

  const handleLogout = async (): Promise<void> => {
    // FAIL-FAST EXCEPTION (lhr authorized 2026-05-11): logout backend 失败也要本地 clearSession.
    // Registered: docs/engineering/fail-fast-exceptions.md#auth-logout-graceful-clear
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      logger.warn('auth.logout.backend_failed', { err: String(err) });
    }
    clearSession();
    navigate('/login');
  };

  if (user === null) {
    return null;
  }

  return (
    <div
      className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10"
      data-testid="profile-view"
    >
      <div
        className="grid grid-cols-1 gap-8 md:grid-cols-[280px_1fr] md:gap-12"
        data-testid="profile-identity-card"
      >
        <ProfileSidePanel user={user} stats={stats} memberSince={null} />

        <main className="min-w-0 space-y-12">
          <ProfileBasicInfo
            user={user}
            examTarget={PROFILE_MOCK.examTarget}
            examRegion={PROFILE_MOCK.examRegion}
          />

          <div className="space-y-4">
            <AccountSecuritySection />
            <EmailPanel />
            <ProfileLearningToolsCard />
          </div>

          <ProfilePreferences
            themeKey="quiet"
            dailyReminder={PROFILE_MOCK.dailyReminder}
            fontSizeLabel={PROFILE_MOCK.fontSizeLabel}
            shortcutsOn={PROFILE_MOCK.shortcutsOn}
          />

          <ProfileSubscriptionCard
            tierLabel={PROFILE_MOCK.subscription.tierLabel}
            billingCycle={PROFILE_MOCK.subscription.billingCycle}
            renewDate={PROFILE_MOCK.subscription.renewDate}
            perks={PROFILE_MOCK.subscription.perks}
            priceLabel={PROFILE_MOCK.subscription.priceLabel}
            priceCycle={PROFILE_MOCK.subscription.priceCycle}
            onManage={() => {
              logger.info('profile.subscription.manage_click', {});
            }}
          />
        </main>
      </div>

      <div className="mt-12 border-t border-line pt-6">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<LogoutIcon className="h-4 w-4" />}
          onClick={() => {
            void handleLogout();
          }}
          data-testid="profile-logout-btn"
        >
          {PROFILE_COPY.logoutAction}
        </Button>
      </div>
    </div>
  );
}
