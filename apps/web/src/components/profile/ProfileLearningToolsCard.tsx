import { useNavigate } from 'react-router-dom';
import {
  ChatIcon,
  ChevronRightIcon,
  FileTextIcon,
  SubjectDashboardIcon,
  SubjectPlanIcon,
} from '@sikao/ui/icons';
import type { IconProps } from '@sikao/ui/icons';
import { Card } from '@sikao/ui/ui';
import type { ComponentType } from 'react';
import { PROFILE_COPY } from '@/lib/ui-copy';

interface LearningToolEntry {
  readonly path: string;
  readonly label: string;
  readonly description: string;
  readonly testId: string;
  readonly icon: ComponentType<IconProps>;
}

const ENTRIES: readonly LearningToolEntry[] = [
  {
    path: '/dashboard',
    label: PROFILE_COPY.analyticsLabel,
    description: PROFILE_COPY.rowAnalyticsSubtitle,
    testId: 'profile-dashboard-entry',
    icon: SubjectDashboardIcon,
  },
  {
    path: '/plan',
    label: PROFILE_COPY.planLabel,
    description: PROFILE_COPY.rowPlanSubtitle,
    testId: 'profile-study-plan-entry',
    icon: SubjectPlanIcon,
  },
  {
    path: '/essay/history',
    label: PROFILE_COPY.essayLabel,
    description: PROFILE_COPY.rowEssaySubtitle,
    testId: 'profile-essay-history-entry',
    icon: FileTextIcon,
  },
  {
    path: '/conversations',
    label: PROFILE_COPY.conversationsLabel,
    description: PROFILE_COPY.rowConversationsSubtitle,
    testId: 'profile-conversations-entry',
    icon: ChatIcon,
  },
] as const;

export function ProfileLearningToolsCard() {
  const navigate = useNavigate();

  return (
    <Card padding="md" data-testid="profile-learning-tools-card">
      <div className="mb-3">
        <h2 className="font-serif text-h-card font-medium text-ink">
          {PROFILE_COPY.studyToolsHeader}
        </h2>
        <p className="mt-1 text-sm text-ink-3">
          {PROFILE_COPY.studyToolsSubtitle}
        </p>
      </div>
      <div className="divide-y divide-line">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.path}
              type="button"
              onClick={() => navigate(entry.path)}
              className="flex w-full items-center justify-between gap-3 rounded-card py-3 text-left first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid={entry.testId}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="h-5 w-5 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{entry.label}</span>
                  <span className="block text-sm text-ink-3">{entry.description}</span>
                </span>
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-3" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
