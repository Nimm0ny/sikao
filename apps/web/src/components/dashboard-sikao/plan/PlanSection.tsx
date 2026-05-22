import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  CalendarRangeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react';
import { Button, Card, Chip, EmptyState, Modal, Tabs } from '@sikao/ui/ui';
import {
  acceptAdjustment,
  deleteEvent,
  rejectAdjustment,
  restoreEvent,
  updateEvent,
  useAdjustmentsPending,
  useAutoGeneratePlan,
  useAutoRegenerateRange,
  useBulkDeleteEvents,
  useCreateEvent,
  useDashboardFullPlan,
  usePlansList,
  useProfileGoals,
  useProfileInfo,
} from '@sikao/api-client';
import type {
  DashboardFullPlanResponseV2,
  HomePlanGenerateStreamFrame,
  HomePlanRegenerateStreamFrame,
  PlanAutoGenerateRequestV2,
  PlanEventCreateRequestV2,
  PlanEventReadV2,
  PlanEventUpdateRequestV2,
  PlanReadV2,
} from '@sikao/api-client/types/home';
import { useAdjustmentBannerStore } from '@sikao/domain/dashboard/useAdjustmentBannerStore';
import { usePlanStore, type SelectedDateRange } from '@sikao/domain/plan/usePlanStore';

import { MvpPage } from '@/components/mvp';

import { PlanAdjustmentBanner } from './PlanAdjustmentBanner';
import { PlanAiDialog } from './PlanAiDialog';
import { PlanCalendar } from './PlanCalendar';
import {
  PlanEventDrawer,
  RecurringScopeDialog,
  type RecurringScope,
} from './PlanEventDrawer';
import {
  buildDraftConflicts,
  buildEventDraft,
  buildGeneratePayload,
  buildRegeneratePayload,
  formatAnchorLabel,
  mergeOptimisticEvents,
  moveEventByDays,
  normalizeRange,
  resizeEventByMinutes,
  shiftAnchorDate,
  toEventPayload,
  visibleAdjustment,
  type EventDraftValues,
  type HomePlanView,
} from './planRuntime';

type StreamFrame = HomePlanGenerateStreamFrame | HomePlanRegenerateStreamFrame;
type QuickActionKind = 'move' | 'resize';

interface PendingScopedQuickAction {
  readonly event: PlanEventReadV2;
  readonly payload: PlanEventUpdateRequestV2;
  readonly kind: QuickActionKind;
}

export function PlanSection() {
  const queryClient = useQueryClient();
  const currentPlanId = usePlanStore((state) => state.currentPlanId);
  const currentView = usePlanStore((state) => state.currentView);
  const currentDate = usePlanStore((state) => state.currentDate);
  const selectedRange = usePlanStore((state) => state.selectedRange);
  const optimisticEvents = usePlanStore((state) => state.optimisticEvents);
  const setCurrentPlanId = usePlanStore((state) => state.setCurrentPlanId);
  const setCurrentView = usePlanStore((state) => state.setCurrentView);
  const setCurrentDate = usePlanStore((state) => state.setCurrentDate);
  const setSelectedRange = usePlanStore((state) => state.setSelectedRange);
  const upsertOptimisticEvent = usePlanStore((state) => state.upsertOptimisticEvent);
  const removeOptimisticEvent = usePlanStore((state) => state.removeOptimisticEvent);
  const dismissedByAdjustmentId = useAdjustmentBannerStore(
    (state) => state.dismissedByAdjustmentId,
  );
  const dismissAdjustment = useAdjustmentBannerStore((state) => state.dismiss);

  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PlanEventReadV2 | null>(null);
  const [eventValues, setEventValues] = useState<EventDraftValues>(
    buildEventDraft(null, currentDate),
  );
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [detailDay, setDetailDay] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'generate' | 'regenerate' | null>(null);
  const [streamFrames, setStreamFrames] = useState<readonly StreamFrame[]>([]);
  const [pendingScopedQuickAction, setPendingScopedQuickAction] =
    useState<PendingScopedQuickAction | null>(null);

  const plansQuery = usePlansList();
  const profileGoalsQuery = useProfileGoals();
  const profileInfoQuery = useProfileInfo();
  const planWindowQuery = useDashboardFullPlan({
    view: currentView,
    anchorDate: currentDate,
  });
  const adjustmentsQuery = useAdjustmentsPending();

  const createEventMutation = useCreateEvent();
  const bulkDeleteMutation = useBulkDeleteEvents();
  const autoGenerateMutation = useAutoGeneratePlan();
  const autoRegenerateMutation = useAutoRegenerateRange();

  const updateEventMutation = useMutation({
    mutationFn: ({
      eventId,
      payload,
      scope,
    }: {
      readonly eventId: string;
      readonly payload: PlanEventUpdateRequestV2;
      readonly scope?: string;
    }) => updateEvent(eventId, payload, scope ? { scope } : {}),
    onSettled: () => invalidateHomeQueries(queryClient),
  });
  const deleteEventMutation = useMutation({
    mutationFn: ({ eventId, scope }: { readonly eventId: string; readonly scope?: string }) =>
      deleteEvent(eventId, scope ? { scope } : {}),
    onSettled: () => invalidateHomeQueries(queryClient),
  });
  const restoreEventMutation = useMutation({
    mutationFn: (eventId: string) => restoreEvent(eventId),
    onSettled: () => invalidateHomeQueries(queryClient),
  });
  const acceptAdjustmentMutation = useMutation({
    mutationFn: (adjustmentId: number) => acceptAdjustment(adjustmentId),
    onSettled: () => invalidateHomeQueries(queryClient),
  });
  const rejectAdjustmentMutation = useMutation({
    mutationFn: ({
      adjustmentId,
      reason,
    }: {
      readonly adjustmentId: number;
      readonly reason: string;
    }) => rejectAdjustment(adjustmentId, { reason }),
    onSettled: () => invalidateHomeQueries(queryClient),
  });

  const activePlan =
    plansQuery.data?.items.find((plan) => plan.status === 'active') ??
    plansQuery.data?.items[0] ??
    null;

  useEffect(() => {
    const nextPlanId = activePlan?.id ?? null;
    if (currentPlanId !== nextPlanId) {
      setCurrentPlanId(nextPlanId);
    }
  }, [activePlan?.id, currentPlanId, setCurrentPlanId]);

  const mergedEvents = useMemo(
    () => mergeOptimisticEvents(planWindowQuery.data?.events, optimisticEvents),
    [optimisticEvents, planWindowQuery.data?.events],
  );
  const currentAdjustment = useMemo(
    () => visibleAdjustment(adjustmentsQuery.data?.items, dismissedByAdjustmentId),
    [adjustmentsQuery.data?.items, dismissedByAdjustmentId],
  );
  const conflicts = useMemo(
    () => buildDraftConflicts(mergedEvents, selectedEvent?.id ?? null, eventValues),
    [eventValues, mergedEvents, selectedEvent?.id],
  );
  const selectedOrWindowRange = useMemo(() => {
    if (selectedRange) return selectedRange;
    if (!planWindowQuery.data) return null;
    return {
      from: planWindowQuery.data.from,
      to: planWindowQuery.data.to,
    };
  }, [planWindowQuery.data, selectedRange]);
  const generateDefaults = useMemo(
    () => buildGeneratePayload(activePlan, profileGoalsQuery.data),
    [activePlan, profileGoalsQuery.data],
  );

  function openCreateDrawer(day: string): void {
    setSelectedEvent(null);
    setEventValues(buildEventDraft(null, day));
    setSurfaceError(null);
    setDrawerMode('create');
  }

  function openEditDrawer(event: PlanEventReadV2): void {
    setSelectedEvent(event);
    setEventValues(buildEventDraft(event, event.startAt.slice(0, 10)));
    setSurfaceError(null);
    setDrawerMode('edit');
  }

  function toggleRangeDay(day: string): void {
    if (!selectedRange) {
      setSelectedRange({ from: day, to: day });
      return;
    }
    if (selectedRange.from === selectedRange.to && selectedRange.from !== day) {
      setSelectedRange(normalizeRange(selectedRange.from, day));
      return;
    }
    setSelectedRange({ from: day, to: day });
  }

  async function saveEvent(scope?: RecurringScope): Promise<void> {
    setSurfaceError(null);
    const planId = currentPlanId ?? activePlan?.id ?? planWindowQuery.data?.planId ?? null;
    if (planId == null) {
      setSurfaceError('保存事件前必须先有 active plan。');
      return;
    }

    let payload: ReturnType<typeof toEventPayload>;
    try {
      payload = toEventPayload(eventValues);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
      return;
    }
    if (
      new Date(payload.update.endAt ?? '').getTime() <=
      new Date(payload.update.startAt ?? '').getTime()
    ) {
      setSurfaceError('结束时间必须晚于开始时间。');
      return;
    }
    if (conflicts.length > 0) {
      setSurfaceError('当前草稿存在时间冲突，请先调整后再保存。');
      return;
    }

    if (drawerMode === 'create') {
      const createPayload: PlanEventCreateRequestV2 = {
        planId,
        title: eventValues.title,
        category: eventValues.category,
        notes: eventValues.notes,
        startAt: payload.create.startAt,
        endAt: payload.create.endAt,
        timezone: eventValues.timezone,
        source: 'user_manual',
        recurringRule: payload.create.recurringRule,
        targetId: null,
      };
      try {
        await createEventMutation.mutateAsync(createPayload);
        setDrawerMode(null);
      } catch (error) {
        setSurfaceError(asErrorMessage(error));
      }
      return;
    }

    if (!selectedEvent) {
      setSurfaceError('编辑事件前必须先选择一个事件。');
      return;
    }

    try {
      await commitQuickEventMutation(selectedEvent, payload.update, scope);
      setDrawerMode(null);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function removeEvent(scope?: RecurringScope): Promise<void> {
    if (!selectedEvent) {
      setSurfaceError('删除事件前必须先选择一个事件。');
      return;
    }
    setSurfaceError(null);
    try {
      await deleteEventMutation.mutateAsync({ eventId: selectedEvent.id, scope });
      setDrawerMode(null);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function restoreSelectedEvent(): Promise<void> {
    if (!selectedEvent) {
      setSurfaceError('恢复事件前必须先选择一个事件。');
      return;
    }
    setSurfaceError(null);
    try {
      await restoreEventMutation.mutateAsync(selectedEvent.id);
      setDrawerMode(null);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function moveEvent(
    event: PlanEventReadV2,
    fromDay: string,
    toDay: string,
  ): Promise<void> {
    const patch = moveEventByDays(event, fromDay, toDay);
    if (requiresRecurringScope(event)) {
      setPendingScopedQuickAction({ event, payload: patch, kind: 'move' });
      return;
    }
    setSurfaceError(null);
    try {
      await commitQuickEventMutation(event, patch);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function resizeEvent(event: PlanEventReadV2, deltaMinutes: number): Promise<void> {
    const patch = resizeEventByMinutes(event, deltaMinutes);
    if (patch.endAt == null || new Date(patch.endAt).getTime() <= new Date(event.startAt).getTime()) {
      return;
    }
    if (requiresRecurringScope(event)) {
      setPendingScopedQuickAction({ event, payload: patch, kind: 'resize' });
      return;
    }
    setSurfaceError(null);
    try {
      await commitQuickEventMutation(event, patch);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function confirmScopedQuickAction(scope: RecurringScope): Promise<void> {
    const pendingAction = pendingScopedQuickAction;
    if (!pendingAction) return;
    setSurfaceError(null);
    try {
      await commitQuickEventMutation(
        pendingAction.event,
        pendingAction.payload,
        scope,
      );
      setPendingScopedQuickAction(null);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function submitBulkDelete(): Promise<void> {
    setSurfaceError(null);
    const planId = currentPlanId ?? activePlan?.id ?? planWindowQuery.data?.planId ?? null;
    if (!selectedOrWindowRange || planId == null) {
      setSurfaceError('Bulk reset 前必须先有有效范围和 active plan。');
      return;
    }
    try {
      await bulkDeleteMutation.mutateAsync({
        planId,
        from: selectedOrWindowRange.from,
        to: selectedOrWindowRange.to,
        source: 'user_manual',
        dryRun: false,
      });
      setBulkDeleteOpen(false);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function runGenerate(payload: PlanAutoGenerateRequestV2): Promise<void> {
    setSurfaceError(null);
    setStreamFrames([]);
    try {
      const doneFrame = await autoGenerateMutation.mutateAsync({
        payload,
        onProgress: (frame) => {
          setStreamFrames((current) => [...current, frame]);
        },
      });
      setCurrentPlanId(doneFrame.plan.id);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function runRegenerate(userNotes: string): Promise<void> {
    const range = selectedOrWindowRange;
    const planId = currentPlanId ?? activePlan?.id ?? planWindowQuery.data?.planId ?? null;
    setSurfaceError(null);
    if (!range || planId == null) {
      setSurfaceError('AI 重生成前必须先有有效范围和 active plan。');
      return;
    }
    setStreamFrames([]);
    try {
      await autoRegenerateMutation.mutateAsync({
        payload: {
          ...buildRegeneratePayload(planId, range),
          userNotes,
        },
        onProgress: (frame) => {
          setStreamFrames((current) => [...current, frame]);
        },
      });
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function acceptCurrentAdjustment(): Promise<void> {
    if (!currentAdjustment) return;
    setSurfaceError(null);
    try {
      await acceptAdjustmentMutation.mutateAsync(currentAdjustment.id);
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function rejectCurrentAdjustment(reason: string): Promise<void> {
    if (!currentAdjustment) return;
    setSurfaceError(null);
    try {
      await rejectAdjustmentMutation.mutateAsync({
        adjustmentId: currentAdjustment.id,
        reason,
      });
    } catch (error) {
      setSurfaceError(asErrorMessage(error));
    }
  }

  async function commitQuickEventMutation(
    event: PlanEventReadV2,
    payload: PlanEventUpdateRequestV2,
    scope?: RecurringScope,
  ): Promise<void> {
    const optimisticPatch = toOptimisticPatch(payload);
    upsertOptimisticEvent(event.id, optimisticPatch);
    try {
      await updateEventMutation.mutateAsync({
        eventId: event.id,
        payload,
        scope,
      });
    } finally {
      removeOptimisticEvent(event.id);
    }
  }

  return (
    <MvpPage
      title="首页"
      eyebrow="Home Phase M9"
      subtitle="Section A 临时挂在 /dashboard；Today / Week / Month、事件编辑、AI 生成和 adjustment 全部从这里进入。"
      action={
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            leftIcon={<ChevronLeftIcon className="h-4 w-4" />}
            onClick={() => setCurrentDate(shiftAnchorDate(currentDate, currentView, -1))}
          >
            上一段
          </Button>
          <Button
            variant="secondary"
            rightIcon={<ChevronRightIcon className="h-4 w-4" />}
            onClick={() => setCurrentDate(shiftAnchorDate(currentDate, currentView, 1))}
          >
            下一段
          </Button>
          <Button
            variant="secondary"
            leftIcon={<CalendarRangeIcon className="h-4 w-4" />}
            onClick={() => setSelectedRange(null)}
          >
            清空圈选
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Trash2Icon className="h-4 w-4" />}
            onClick={() => setBulkDeleteOpen(true)}
          >
            Bulk reset
          </Button>
          <Button
            variant="primary"
            leftIcon={<SparklesIcon className="h-4 w-4" />}
            onClick={() => setAiMode('generate')}
          >
            AI 制定计划
          </Button>
          <Button
            variant="accent"
            leftIcon={<RefreshCwIcon className="h-4 w-4" />}
            onClick={() => setAiMode('regenerate')}
          >
            AI 重生成范围
          </Button>
        </div>
      }
      testId="dashboard-home-plan-view"
    >
      <div className="space-y-5">
        <PlanAdjustmentBanner
          adjustment={currentAdjustment}
          isSubmitting={acceptAdjustmentMutation.isPending || rejectAdjustmentMutation.isPending}
          onAccept={acceptCurrentAdjustment}
          onReject={rejectCurrentAdjustment}
          onDismiss={() => {
            if (currentAdjustment) dismissAdjustment(currentAdjustment.id);
          }}
        />

        <Card padding="md" className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
                Section A host
              </div>
              <div className="mt-1 font-serif text-3xl text-ink">
                {activePlan?.name ?? 'Home plan runtime'}
              </div>
              <div className="mt-2 text-sm text-ink-3">
                {planWindowQuery.data
                  ? formatAnchorLabel(currentView, planWindowQuery.data.from, planWindowQuery.data.to)
                  : currentDate}
              </div>
            </div>
            <Tabs
              value={currentView}
              onChange={(next) => setCurrentView(next as HomePlanView)}
              variant="pill"
              ariaLabel="Plan calendar views"
              items={[
                { value: 'today', label: 'Today', testId: 'plan-view-today' },
                { value: 'week', label: 'Week', testId: 'plan-view-week' },
                { value: 'month', label: 'Month', testId: 'plan-view-month' },
              ]}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {activePlan ? (
              <>
                <Chip>{`目标 ${activePlan.targetExamId}`}</Chip>
                <Chip>{`考试日 ${activePlan.targetExamDate}`}</Chip>
                <Chip>{`日目标 ${activePlan.dailyMinutesTarget} min`}</Chip>
              </>
            ) : null}
            {selectedOrWindowRange ? (
              <Chip>{`当前范围 ${selectedOrWindowRange.from} - ${selectedOrWindowRange.to}`}</Chip>
            ) : null}
            {profileInfoQuery.data ? (
              <Chip>
                {profileInfoQuery.data.aiAdjustEnabled ? 'AI adjust on' : 'AI adjust off'}
              </Chip>
            ) : null}
          </div>

          {surfaceError ? (
            <div className="rounded-tiny border border-err bg-err-bg p-3 text-sm text-err">
              {surfaceError}
            </div>
          ) : null}

          {renderWindowState({
            activePlan,
            query: planWindowQuery,
            events: mergedEvents,
            currentView,
            selectedRange,
            detailDay,
            onSelectDay: toggleRangeDay,
            onOpenDayDetail: setDetailDay,
            onCloseDayDetail: () => setDetailDay(null),
            onCreateEvent: openCreateDrawer,
            onEditEvent: openEditDrawer,
            onMoveEvent: (event, fromDay, toDay) => void moveEvent(event, fromDay, toDay),
            onResizeEvent: (event, delta) => void resizeEvent(event, delta),
          })}
        </Card>
      </div>

      {drawerMode ? (
        <PlanEventDrawer
          open
          mode={drawerMode}
          values={eventValues}
          selectedEvent={selectedEvent}
          conflicts={conflicts}
          isSaving={createEventMutation.isPending || updateEventMutation.isPending}
          isDeleting={deleteEventMutation.isPending}
          isRestoring={restoreEventMutation.isPending}
          onChange={(patch) => setEventValues((current) => ({ ...current, ...patch }))}
          onClose={() => setDrawerMode(null)}
          onSubmit={(scope) => void saveEvent(scope)}
          onDelete={(scope) => void removeEvent(scope)}
          onRestore={() => void restoreSelectedEvent()}
        />
      ) : null}

      {aiMode ? (
        <PlanAiDialog
          open
          mode={aiMode}
          generateDefaults={generateDefaults}
          regenerateRange={selectedOrWindowRange}
          isRunning={autoGenerateMutation.isPending || autoRegenerateMutation.isPending}
          progressFrames={streamFrames}
          onClose={() => setAiMode(null)}
          onGenerate={runGenerate}
          onRegenerate={runRegenerate}
        />
      ) : null}

      <RecurringScopeDialog
        open={pendingScopedQuickAction !== null}
        action="save"
        onClose={() => setPendingScopedQuickAction(null)}
        onConfirm={(scope) => void confirmScopedQuickAction(scope)}
      />

      <BulkDeleteModal
        open={bulkDeleteOpen}
        range={selectedOrWindowRange}
        isRunning={bulkDeleteMutation.isPending}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void submitBulkDelete()}
      />
    </MvpPage>
  );
}

function renderWindowState({
  activePlan,
  query,
  events,
  currentView,
  selectedRange,
  detailDay,
  onSelectDay,
  onOpenDayDetail,
  onCloseDayDetail,
  onCreateEvent,
  onEditEvent,
  onMoveEvent,
  onResizeEvent,
}: {
  readonly activePlan: PlanReadV2 | null;
  readonly query: UseQueryResult<DashboardFullPlanResponseV2>;
  readonly events: readonly PlanEventReadV2[];
  readonly currentView: HomePlanView;
  readonly selectedRange: SelectedDateRange | null;
  readonly detailDay: string | null;
  readonly onSelectDay: (day: string) => void;
  readonly onOpenDayDetail: (day: string) => void;
  readonly onCloseDayDetail: () => void;
  readonly onCreateEvent: (day: string) => void;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
  readonly onMoveEvent: (event: PlanEventReadV2, fromDay: string, toDay: string) => void;
  readonly onResizeEvent: (event: PlanEventReadV2, deltaMinutes: number) => void;
}) {
  if (query.isLoading) {
    return (
      <div className="rounded-card border border-line bg-paper p-6 text-sm text-ink-4">
        Loading plan window...
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        tone="error"
        title="Section A 加载失败"
        description="当前 Home plan window 无法加载，请先检查接口或重试。"
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            重试
          </Button>
        }
      />
    );
  }

  if (!activePlan || query.data?.planId == null) {
    return (
      <EmptyState
        title="还没有 active plan"
        description="当前 `M9` host 已经可用，但需要先创建或 AI 生成一份 active plan 才能进入 Today / Week / Month runtime。"
      />
    );
  }

  return (
    <PlanCalendar
      view={currentView}
      from={query.data.from}
      to={query.data.to}
      events={events}
      practiceBlocks={query.data.practiceBlocks ?? []}
      selectedRange={selectedRange}
      detailDay={detailDay}
      onSelectDay={onSelectDay}
      onOpenDayDetail={onOpenDayDetail}
      onCloseDayDetail={onCloseDayDetail}
      onCreateEvent={onCreateEvent}
      onEditEvent={onEditEvent}
      onMoveEvent={onMoveEvent}
      onResizeEvent={onResizeEvent}
    />
  );
}

function BulkDeleteModal({
  open,
  range,
  isRunning,
  onClose,
  onConfirm,
}: {
  readonly open: boolean;
  readonly range: { readonly from: string; readonly to: string } | null;
  readonly isRunning: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk reset"
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button variant="quiet" onClick={onClose}>
            取消
          </Button>
          <Button variant="danger" isLoading={isRunning} onClick={onConfirm}>
            删除范围内事件
          </Button>
        </div>
      }
    >
      <div className="text-sm text-ink-3">
        将删除当前范围内的 user-manual 事件：
        <div className="mt-2 font-mono text-xs text-ink">
          {range?.from ?? '—'} - {range?.to ?? '—'}
        </div>
      </div>
    </Modal>
  );
}

function invalidateHomeQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['home-v2'] });
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected mutation failure';
}

function requiresRecurringScope(event: PlanEventReadV2): boolean {
  return event.recurringRule != null || event.isRecurringInstance === true;
}

function toOptimisticPatch(payload: PlanEventUpdateRequestV2): Partial<PlanEventReadV2> {
  const patch: Partial<PlanEventReadV2> = {};
  if (payload.category != null) patch.category = payload.category;
  if (payload.endAt != null) patch.endAt = payload.endAt;
  if (payload.notes != null) patch.notes = payload.notes;
  if (payload.recurringRule !== undefined) patch.recurringRule = payload.recurringRule;
  if (payload.startAt != null) patch.startAt = payload.startAt;
  if (payload.status != null) patch.status = payload.status;
  if (payload.targetId !== undefined) patch.targetId = payload.targetId;
  if (payload.timezone != null) patch.timezone = payload.timezone;
  if (payload.title != null) patch.title = payload.title;
  return patch;
}
