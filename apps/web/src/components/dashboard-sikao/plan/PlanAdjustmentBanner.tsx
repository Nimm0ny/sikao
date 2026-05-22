import { useState } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { Button, Card, Modal } from '@sikao/ui/ui';
import type { PlanAdjustmentReadV2 } from '@sikao/api-client/types/home';

interface PlanAdjustmentBannerProps {
  readonly adjustment: PlanAdjustmentReadV2 | null;
  readonly isSubmitting: boolean;
  readonly onAccept: () => Promise<void>;
  readonly onReject: (reason: string) => Promise<void>;
  readonly onDismiss: () => void;
}

export function PlanAdjustmentBanner({
  adjustment,
  isSubmitting,
  onAccept,
  onReject,
  onDismiss,
}: PlanAdjustmentBannerProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!adjustment) return null;

  return (
    <>
      <Card padding="md" className="border-accent-50 bg-accent-50/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-accent">Adjustment</div>
            <div className="mt-1 font-serif text-xl text-ink">{adjustment.reason}</div>
            <div className="mt-2 text-sm text-ink-3">
              提案于 {adjustment.proposedAt}，状态 {adjustment.status}。
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setDetailOpen(true)}>
              查看详情
            </Button>
            <Button
              variant="primary"
              leftIcon={<CheckIcon className="h-4 w-4" />}
              isLoading={isSubmitting}
              onClick={() => void onAccept()}
            >
              接受
            </Button>
            <Button
              variant="danger"
              leftIcon={<XIcon className="h-4 w-4" />}
              isLoading={isSubmitting}
              onClick={() => setDetailOpen(true)}
            >
              拒绝
            </Button>
            <Button variant="quiet" onClick={onDismiss}>
              暂时隐藏
            </Button>
          </div>
        </div>
      </Card>
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="AI 调整详情"
        size="lg"
        footer={
          <div className="flex w-full justify-between gap-3">
            <Button variant="quiet" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" isLoading={isSubmitting} onClick={() => void onAccept()}>
                接受
              </Button>
              <Button
                variant="danger"
                isLoading={isSubmitting}
                onClick={() => void onReject(rejectReason)}
              >
                提交拒绝
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <section className="rounded-tiny border border-line bg-paper-2 p-4">
            <div className="text-sm font-semibold text-ink">Reason</div>
            <p className="mt-2 text-sm text-ink-3">{adjustment.reason}</p>
          </section>
          <section className="rounded-tiny border border-line bg-paper-2 p-4">
            <div className="text-sm font-semibold text-ink">Changes</div>
            <pre className="mt-2 overflow-x-auto text-xs text-ink-3">
              {JSON.stringify(adjustment.changes ?? [], null, 2)}
            </pre>
          </section>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink">拒绝原因</span>
            <textarea
              value={rejectReason}
              aria-label="拒绝原因"
              onChange={(event) => setRejectReason(event.target.value)}
              className="min-h-28 w-full rounded-tiny border border-line bg-paper px-3 py-2 text-sm text-ink"
              placeholder="例如：这周晚间档需要留给真题套卷。"
            />
          </label>
        </div>
      </Modal>
    </>
  );
}
