import { useState } from 'react';
import { AlertTriangleIcon, RotateCcwIcon, SaveIcon, TrashIcon } from 'lucide-react';
import { Button, Drawer, EmptyState, Select } from '@sikao/ui/ui';
import type { ConflictItem } from '@sikao/calendar-engine';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

import type { EventDraftValues } from './planRuntime';

export type RecurringScope = 'this' | 'future' | 'all';

interface PlanEventDrawerProps {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly values: EventDraftValues;
  readonly selectedEvent: PlanEventReadV2 | null;
  readonly conflicts: readonly ConflictItem[];
  readonly isSaving: boolean;
  readonly isDeleting: boolean;
  readonly isRestoring: boolean;
  readonly onChange: (patch: Partial<EventDraftValues>) => void;
  readonly onClose: () => void;
  readonly onSubmit: (scope?: RecurringScope) => void;
  readonly onDelete: (scope?: RecurringScope) => void;
  readonly onRestore: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'review', label: '复盘' },
  { value: 'xingce', label: '行测' },
  { value: 'essay', label: '申论' },
  { value: 'practice', label: 'Practice' },
] as const;

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'skipped', label: 'Skipped' },
] as const;

export function PlanEventDrawer({
  open,
  mode,
  values,
  selectedEvent,
  conflicts,
  isSaving,
  isDeleting,
  isRestoring,
  onChange,
  onClose,
  onSubmit,
  onDelete,
  onRestore,
}: PlanEventDrawerProps) {
  const [scopeDialogAction, setScopeDialogAction] = useState<'save' | 'delete' | null>(null);
  const isRecurring =
    selectedEvent?.recurringRule != null ||
    selectedEvent?.isRecurringInstance === true ||
    values.recurringRule.length > 0;

  function requestSubmit(): void {
    if (isRecurring && mode === 'edit') {
      setScopeDialogAction('save');
      return;
    }
    onSubmit();
  }

  function requestDelete(): void {
    if (isRecurring && mode === 'edit') {
      setScopeDialogAction('delete');
      return;
    }
    onDelete();
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={mode === 'create' ? '新建事件' : '编辑事件'}
        aria-label={mode === 'create' ? '新建事件抽屉' : '编辑事件抽屉'}
      >
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink">标题</span>
            <input
              value={values.title}
              aria-label="标题"
              onChange={(event) => onChange({ title: event.target.value })}
              className="h-11 w-full rounded-tiny border border-line bg-paper px-3 text-sm text-ink"
              placeholder="例如：Morning drill"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">分类</span>
              <Select
                value={values.category}
                onChange={(value) => onChange({ category: value })}
                options={[...CATEGORY_OPTIONS]}
                aria-label="事件分类"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">状态</span>
              <Select
                value={values.status}
                onChange={(value) => onChange({ status: value })}
                options={[...STATUS_OPTIONS]}
                aria-label="事件状态"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">开始日期</span>
              <input
                type="date"
                value={values.startDay}
                aria-label="开始日期"
                onChange={(event) => onChange({ startDay: event.target.value })}
                className="h-11 w-full rounded-tiny border border-line bg-paper px-3 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">开始时间</span>
              <input
                type="time"
                value={values.startTime}
                aria-label="开始时间"
                onChange={(event) => onChange({ startTime: event.target.value })}
                className="h-11 w-full rounded-tiny border border-line bg-paper px-3 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">结束日期</span>
              <input
                type="date"
                value={values.endDay}
                aria-label="结束日期"
                onChange={(event) => onChange({ endDay: event.target.value })}
                className="h-11 w-full rounded-tiny border border-line bg-paper px-3 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">结束时间</span>
              <input
                type="time"
                value={values.endTime}
                aria-label="结束时间"
                onChange={(event) => onChange({ endTime: event.target.value })}
                className="h-11 w-full rounded-tiny border border-line bg-paper px-3 text-sm text-ink"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink">Recurring rule</span>
            <input
              value={values.recurringRule}
              aria-label="Recurring rule"
              onChange={(event) => onChange({ recurringRule: event.target.value })}
              className="h-11 w-full rounded-tiny border border-line bg-paper px-3 text-sm text-ink"
              placeholder="例如：FREQ=WEEKLY;COUNT=6"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink">备注</span>
            <textarea
              value={values.notes}
              aria-label="备注"
              onChange={(event) => onChange({ notes: event.target.value })}
              className="min-h-28 w-full rounded-tiny border border-line bg-paper px-3 py-2 text-sm text-ink"
              placeholder="补充说明、AI 指令或复盘目标"
            />
          </label>

          {conflicts.length > 0 ? (
            <EmptyState
              tone="error"
              icon={<AlertTriangleIcon className="h-6 w-6" />}
              title="时间冲突"
              description={`当前草稿和 ${conflicts.length} 个事件存在重叠，请调整时间后再保存。`}
            />
          ) : null}

          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <Button
              variant="primary"
              leftIcon={<SaveIcon className="h-4 w-4" />}
              isLoading={isSaving}
              onClick={requestSubmit}
            >
              {mode === 'create' ? '创建事件' : '保存修改'}
            </Button>
            {mode === 'edit' ? (
              <Button
                variant="danger"
                leftIcon={<TrashIcon className="h-4 w-4" />}
                isLoading={isDeleting}
                onClick={requestDelete}
              >
                删除事件
              </Button>
            ) : null}
            {selectedEvent?.deletedAt ? (
              <Button
                variant="secondary"
                leftIcon={<RotateCcwIcon className="h-4 w-4" />}
                isLoading={isRestoring}
                onClick={onRestore}
              >
                恢复事件
              </Button>
            ) : null}
          </div>
        </div>
      </Drawer>
      <RecurringScopeDialog
        open={scopeDialogAction !== null}
        action={scopeDialogAction}
        onClose={() => setScopeDialogAction(null)}
        onConfirm={(scope) => {
          if (scopeDialogAction === 'save') onSubmit(scope);
          if (scopeDialogAction === 'delete') onDelete(scope);
          setScopeDialogAction(null);
        }}
      />
    </>
  );
}

export function RecurringScopeDialog({
  open,
  action,
  onClose,
  onConfirm,
}: {
  readonly open: boolean;
  readonly action: 'save' | 'delete' | null;
  readonly onClose: () => void;
  readonly onConfirm: (scope: RecurringScope) => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Recurring scope" aria-label="Recurring scope dialog">
      <div className="space-y-3">
        <p className="text-sm text-ink-3">
          {action === 'delete' ? '删除' : '保存'} recurring 事件时，需要明确作用范围。
        </p>
        {([
          ['this', '仅当前实例'],
          ['future', '当前及未来实例'],
          ['all', '整个系列'],
        ] as const).map(([scope, label]) => (
          <Button
            key={scope}
            variant="secondary"
            fullWidth
            className="justify-start"
            onClick={() => onConfirm(scope)}
          >
            {label}
          </Button>
        ))}
      </div>
    </Drawer>
  );
}
