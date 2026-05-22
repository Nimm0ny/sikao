import { useState } from 'react';

import { Button, Modal, Select } from '@sikao/ui/ui';

import type { RecommendationReadV2 } from '@sikao/api-client/types/home';

import {
  asRecommendationActionType,
  buildTargetDateOptions,
} from './recommendRuntime';

interface AcceptOptionMenuProps {
  readonly recommendation: RecommendationReadV2;
  readonly isSubmitting: boolean;
  readonly onAcceptSession: () => Promise<void>;
  readonly onAcceptPlan: (targetDate: string) => Promise<void>;
}

export function AcceptOptionMenu({
  recommendation,
  isSubmitting,
  onAcceptSession,
  onAcceptPlan,
}: AcceptOptionMenuProps) {
  const actionType = asRecommendationActionType(recommendation.actionType);
  const targetDateOptions = buildTargetDateOptions();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [targetDate, setTargetDate] = useState(targetDateOptions[0]?.value ?? '');

  const sessionSupported = actionType !== 'rest';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          isLoading={isSubmitting}
          onClick={() => {
            if (sessionSupported) {
              void onAcceptSession();
              return;
            }
            setPlanModalOpen(true);
          }}
        >
          {sessionSupported ? recommendation.cta : '安排到计划'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setPlanModalOpen(true)}
          disabled={isSubmitting}
        >
          加入计划
        </Button>
      </div>

      <Modal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title="加入计划"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="quiet" onClick={() => setPlanModalOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              isLoading={isSubmitting}
              onClick={async () => {
                await onAcceptPlan(targetDate);
                setPlanModalOpen(false);
              }}
            >
              确认加入
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-ink-3">
            选择这条推荐要落到哪一天的计划中。
          </div>
          <Select
            aria-label="recommendation target date"
            value={targetDate}
            onChange={setTargetDate}
            options={targetDateOptions}
          />
        </div>
      </Modal>
    </>
  );
}
