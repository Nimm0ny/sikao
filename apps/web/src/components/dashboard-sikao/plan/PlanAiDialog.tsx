import { useState, type HTMLInputTypeAttribute } from 'react';
import { SparklesIcon } from 'lucide-react';
import { Button, Modal } from '@sikao/ui/ui';
import type {
  HomePlanGenerateStreamFrame,
  HomePlanRegenerateStreamFrame,
  PlanAutoGenerateRequestV2,
} from '@sikao/api-client/types/home';

interface PlanAiDialogProps {
  readonly open: boolean;
  readonly mode: 'generate' | 'regenerate';
  readonly generateDefaults: PlanAutoGenerateRequestV2;
  readonly regenerateRange: { readonly from: string; readonly to: string } | null;
  readonly isRunning: boolean;
  readonly progressFrames: readonly (HomePlanGenerateStreamFrame | HomePlanRegenerateStreamFrame)[];
  readonly onClose: () => void;
  readonly onGenerate: (payload: PlanAutoGenerateRequestV2) => Promise<void>;
  readonly onRegenerate: (userNotes: string) => Promise<void>;
}

export function PlanAiDialog({
  open,
  mode,
  generateDefaults,
  regenerateRange,
  isRunning,
  progressFrames,
  onClose,
  onGenerate,
  onRegenerate,
}: PlanAiDialogProps) {
  const [name, setName] = useState(generateDefaults.name);
  const [targetExamId, setTargetExamId] = useState(generateDefaults.targetExamId);
  const [targetExamDate, setTargetExamDate] = useState(generateDefaults.targetExamDate);
  const [dailyMinutesTarget, setDailyMinutesTarget] = useState(String(generateDefaults.dailyMinutesTarget));
  const [style, setStyle] = useState(generateDefaults.style);
  const [focusSubjects, setFocusSubjects] = useState(generateDefaults.focusSubjects?.join(', ') ?? '');
  const [userNotes, setUserNotes] = useState(generateDefaults.userNotes);

  async function submit(): Promise<void> {
    if (mode === 'generate') {
      await onGenerate({
        ...generateDefaults,
        name,
        targetExamId,
        targetExamDate,
        dailyMinutesTarget: Number(dailyMinutesTarget),
        style,
        focusSubjects: focusSubjects
          .split(',')
          .map((subject) => subject.trim())
          .filter(Boolean),
        userNotes,
      });
      return;
    }
    await onRegenerate(userNotes);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'generate' ? 'AI 制定计划' : 'AI 局部重生成'}
      size="lg"
      footer={
        <div className="flex w-full justify-end">
          <Button
            variant="primary"
            leftIcon={<SparklesIcon className="h-4 w-4" />}
            isLoading={isRunning}
            onClick={() => void submit()}
          >
            {mode === 'generate' ? '开始生成' : '开始重生成'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {mode === 'generate' ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="计划名称" value={name} onChange={setName} />
              <Field label="目标考试 ID" value={targetExamId} onChange={setTargetExamId} />
              <Field label="目标考试日期" type="date" value={targetExamDate} onChange={setTargetExamDate} />
              <Field
                label="日目标分钟"
                type="number"
                value={dailyMinutesTarget}
                onChange={setDailyMinutesTarget}
              />
              <Field label="风格" value={style} onChange={setStyle} />
              <Field label="聚焦学科" value={focusSubjects} onChange={setFocusSubjects} />
            </div>
          </>
        ) : (
          <div className="rounded-tiny border border-line bg-paper-2 p-4 text-sm text-ink-3">
            当前重生成范围：{regenerateRange?.from ?? '—'} 至 {regenerateRange?.to ?? '—'}
          </div>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">用户备注</span>
          <textarea
            value={userNotes}
            onChange={(event) => setUserNotes(event.target.value)}
            aria-label="用户备注"
            className="min-h-32 w-full rounded-tiny border border-line bg-paper px-3 py-2 text-sm text-ink"
            placeholder="例如：周末要留出更多复盘时间，减少跨晚间的连续块。"
          />
        </label>
        <div className="rounded-tiny border border-line bg-paper-2 p-4">
          <div className="mb-2 text-sm font-semibold text-ink">SSE progress</div>
          {progressFrames.length === 0 ? (
            <p className="text-sm text-ink-4">尚未开始。</p>
          ) : (
            <ul className="space-y-2">
              {progressFrames.map((frame, index) => (
                <li key={`${frame.type}-${index}`} className="text-sm text-ink-3">
                  {frame.type === 'event'
                    ? `event: ${frame.event.title}`
                    : frame.type === 'done'
                      ? 'done'
                      : `error: ${frame.message}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: HTMLInputTypeAttribute;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink">{label}</span>
      <input
        type={type}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-tiny border border-line bg-paper px-3 text-sm text-ink"
      />
    </label>
  );
}
