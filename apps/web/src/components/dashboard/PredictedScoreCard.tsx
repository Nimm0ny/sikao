import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircleIcon, NoteEditIcon, RefreshIcon } from '@sikao/ui/icons';
import { Badge, Button, Card, EmptyState, FormField, Modal, Skeleton } from '@sikao/ui/ui';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import {
  fetchPredictedScore,
  fetchUserGoal,
  meKeys,
  putUserGoal,
} from '@sikao/api-client/apiQueries';
import { ERROR_COPY } from '@/lib/ui-copy';
import type { UserGoalV2 } from '@sikao/api-client/types/api';

// Phase 5.2 + 5.5 fenbi-merge — 用户中心预测分卡 (含目标分编辑入口).
// 算法 D4: 0.85^i 加权 + 归一. sample_size < 3 标 "参考值 · 样本少".
// 目标分 D5 minimal: 用户首次进来 hasGoal=false → CTA 引导设, 设了显差距.
//
// 不挂在 TrendLineChart 上 — 趋势 y 轴是正确率 (0-1), 目标是分数 (0-150),
// 单位不一致强 overlay 会误导. 目标线只在本卡内体现 (差距 chip).

const TARGET_SCORE_MIN = 0;
const TARGET_SCORE_MAX = 150;

export function PredictedScoreCard() {
  const [editing, setEditing] = useState(false);
  // review-fix #4 follow-up: input 状态提升到父级, "打开 modal" 时同步设
  // initial value. 这样 GoalEditModal 不需要 useEffect→setState (React 19
  // lint react-hooks/set-state-in-effect 禁该模式), 也不破坏 Modal exit
  // 动画 (条件 mount 会跳过 framer-motion 退出帧).
  const [goalInput, setGoalInput] = useState('');
  const openGoalEdit = (current: number | null) => {
    setGoalInput(current == null ? '' : String(current));
    setEditing(true);
  };

  const predicted = useQuery({
    queryKey: meKeys.predictedScore,
    queryFn: fetchPredictedScore,
  });
  const goal = useQuery({
    queryKey: meKeys.goal,
    queryFn: fetchUserGoal,
  });

  // 两路都 fail 才整卡降级 (review #5: 部分降级 — 任一成功就给能给的).
  if (predicted.isError && goal.isError) {
    return (
      <Card padding="md" data-testid="predicted-score-card-error">
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-6 h-6" aria-hidden="true" />}
          title={ERROR_COPY.dashboardCard.title}
          description={ERROR_COPY.dashboardCard.description}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void predicted.refetch();
                void goal.refetch();
              }}
              data-testid="predicted-score-retry"
            >
              <RefreshIcon className="w-4 h-4 mr-2" aria-hidden="true" />
              重试
            </Button>
          }
        />
      </Card>
    );
  }

  // review #6: 不再 return null — 占位骨架卡防 layout shift, 数据回来时
  // 同尺寸真卡接管.
  if (predicted.isLoading || goal.isLoading) {
    return (
      <Card padding="lg" data-testid="predicted-score-card-skeleton">
        <Skeleton heightClass="h-6" widthClass="w-24" />
        <div className="mt-4">
          <Skeleton heightClass="h-12" widthClass="w-32" />
        </div>
        <div className="mt-4">
          <Skeleton heightClass="h-4" widthClass="w-48" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <PredictedScoreView
        predicted={predicted.data?.predictedScore ?? null}
        sampleSize={predicted.data?.sampleSize ?? 0}
        isReferenceOnly={predicted.data?.isReferenceOnly ?? true}
        predictedFailed={predicted.isError}
        goal={goal.data ?? { hasGoal: false, targetScore: null }}
        goalFailed={goal.isError}
        onEditGoal={() => openGoalEdit(goal.data?.targetScore ?? null)}
        onRetryPredicted={() => { void predicted.refetch(); }}
      />
      <GoalEditModal
        open={editing}
        value={goalInput}
        onValueChange={setGoalInput}
        onClose={() => setEditing(false)}
      />
    </>
  );
}

interface PredictedScoreViewProps {
  readonly predicted: number | null;
  readonly sampleSize: number;
  readonly isReferenceOnly: boolean;
  readonly predictedFailed: boolean;
  readonly goal: UserGoalV2;
  readonly goalFailed: boolean;
  readonly onEditGoal: () => void;
  readonly onRetryPredicted: () => void;
}

function PredictedScoreView({
  predicted,
  sampleSize,
  isReferenceOnly,
  predictedFailed,
  goal,
  goalFailed,
  onEditGoal,
  onRetryPredicted,
}: PredictedScoreViewProps) {
  return (
    <Card padding="lg" data-testid="predicted-score-card">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <span className="text-tiny font-semibold text-ink-3">预测分</span>
          <h2 className="mt-1 text-h-card font-bold text-ink">
            {predictedFailed ? '加载失败' : `基于近 ${sampleSize} 套估算`}
          </h2>
        </div>
        {/* goalFailed 时禁编辑 — 否则 PUT 后无法 setQueryData 到准确状态. */}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<NoteEditIcon className="w-4 h-4" />}
          onClick={onEditGoal}
          disabled={goalFailed}
          data-testid="predicted-score-edit-goal"
        >
          {goal.hasGoal ? '修改目标' : '设置目标'}
        </Button>
      </header>

      {predictedFailed ? (
        <div
          className="flex items-center gap-3"
          data-testid="predicted-score-partial-error"
        >
          <span className="text-5xl font-bold text-ink-3 tabular-nums">—</span>
          <Button variant="secondary" size="sm" onClick={onRetryPredicted}>
            <RefreshIcon className="w-4 h-4 mr-2" aria-hidden="true" />
            重试
          </Button>
        </div>
      ) : (
        <div className="flex items-baseline gap-3">
          <span
            className="text-5xl font-bold text-ink tabular-nums"
            data-testid="predicted-score-value"
          >
            {predicted == null ? '—' : predicted.toFixed(1)}
          </span>
          <span className="text-sm text-ink-3">/ 100</span>
          {isReferenceOnly && sampleSize > 0 ? (
            <Badge tone="warn" variant="hairline" data-testid="predicted-score-reference-chip">
              参考值 · 样本少
            </Badge>
          ) : null}
        </div>
      )}

      <GoalDeltaRow predicted={predicted} goal={goal} goalFailed={goalFailed} />

      {!predictedFailed && predicted == null ? (
        <p className="mt-4 text-sm text-ink-3" data-testid="predicted-score-empty-hint">
          完成 1 套整卷后这里会显示预测分.
        </p>
      ) : null}
    </Card>
  );
}

interface GoalDeltaRowProps {
  readonly predicted: number | null;
  readonly goal: UserGoalV2;
  readonly goalFailed: boolean;
}

function GoalDeltaRow({ predicted, goal, goalFailed }: GoalDeltaRowProps) {
  if (goalFailed) {
    return (
      <p className="mt-4 text-sm text-ink-3" data-testid="predicted-score-goal-error">
        目标分加载失败.
      </p>
    );
  }
  if (!goal.hasGoal || goal.targetScore == null) {
    return (
      <p className="mt-4 text-sm text-ink-3" data-testid="predicted-score-no-goal">
        设置目标分后, 这里会显示与目标的差距.
      </p>
    );
  }
  if (predicted == null) {
    return (
      <p className="mt-4 text-sm text-ink-3" data-testid="predicted-score-goal-only">
        目标 <span className="font-bold text-ink tabular-nums">{goal.targetScore}</span> 分.
      </p>
    );
  }
  const delta = predicted - goal.targetScore;
  const reachedGoal = delta >= 0;
  return (
    <div
      className="mt-4 flex items-center gap-3 text-sm text-ink-3"
      data-testid="predicted-score-goal-delta"
    >
      <span>
        目标{' '}
        <span className="font-bold text-ink tabular-nums">{goal.targetScore}</span> 分
      </span>
      <Badge
        tone={reachedGoal ? 'success' : 'warn'}
        data-testid="predicted-score-delta-chip"
      >
        {reachedGoal ? `已超 ${delta.toFixed(1)}` : `差 ${(-delta).toFixed(1)}`}
      </Badge>
    </div>
  );
}

interface GoalEditModalProps {
  readonly open: boolean;
  readonly value: string;
  readonly onValueChange: (v: string) => void;
  readonly onClose: () => void;
}

function GoalEditModal({ open, value, onValueChange, onClose }: GoalEditModalProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (targetScore: number) => putUserGoal({ targetScore }),
    onSuccess: (data) => {
      queryClient.setQueryData(meKeys.goal, data);
      toast.info('目标已更新');
      onClose();
    },
    onError: (err) => {
      logger.error('me.goal.put.failed', { err: String(err) });
      toast.error('保存失败', '检查输入或网络后重试');
    },
  });

  const submit = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < TARGET_SCORE_MIN || n > TARGET_SCORE_MAX) {
      toast.warn('请输入 0–150 之间的整数');
      return;
    }
    mutation.mutate(n);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设置目标分"
      description="按你的备考方向选 (国考副省 68 / 国考地市 65 / 省考 65 仅供参考)."
      size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            isLoading={mutation.isPending}
            data-testid="goal-edit-save"
          >
            保存
          </Button>
        </div>
      }
    >
      <FormField
        label="目标总分"
        type="number"
        inputMode="numeric"
        min={TARGET_SCORE_MIN}
        max={TARGET_SCORE_MAX}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid="goal-edit-input"
      />
    </Modal>
  );
}
