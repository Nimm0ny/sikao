import type { CSSProperties } from 'react';
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CalendarDaysIcon, GripVerticalIcon, PlusIcon } from 'lucide-react';
import { Badge, Button, Card, Modal } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import type { DashboardFullPlanResponseV2, PlanEventReadV2 } from '@sikao/api-client/types/home';

import type { SelectedDateRange } from '@sikao/domain/plan/usePlanStore';

import {
  buildDayBuckets,
  computeColumnGeometry,
  enumerateDays,
  formatEventTime,
  type CalendarEventSlice,
  type DayBucket,
  type HomePlanView,
  type PracticeBlockSlice,
} from './planRuntime';

type PracticeBlockV2 = NonNullable<DashboardFullPlanResponseV2['practiceBlocks']>[number];

const HOUR_ROW_PX = 48;
const HOUR_LABELS = Array.from({ length: 24 }, (_, index) =>
  `${String(index).padStart(2, '0')}:00`,
);

interface PlanCalendarProps {
  readonly view: HomePlanView;
  readonly from: string;
  readonly to: string;
  readonly events: readonly PlanEventReadV2[];
  readonly practiceBlocks: readonly PracticeBlockV2[];
  readonly selectedRange: SelectedDateRange | null;
  readonly detailDay: string | null;
  readonly onSelectDay: (day: string) => void;
  readonly onOpenDayDetail: (day: string) => void;
  readonly onCloseDayDetail: () => void;
  readonly onCreateEvent: (day: string) => void;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
  readonly onMoveEvent: (event: PlanEventReadV2, fromDay: string, toDay: string) => void;
  readonly onResizeEvent: (event: PlanEventReadV2, deltaMinutes: number) => void;
}

export function PlanCalendar({
  view,
  from,
  to,
  events,
  practiceBlocks,
  selectedRange,
  detailDay,
  onSelectDay,
  onOpenDayDetail,
  onCloseDayDetail,
  onCreateEvent,
  onEditEvent,
  onMoveEvent,
  onResizeEvent,
}: PlanCalendarProps) {
  const days = enumerateDays(from, to);
  const buckets = buildDayBuckets({
    from,
    to,
    events,
    practiceBlocks,
  });
  const isMonth = view === 'month';
  const selectedDayDetail = buckets.find((bucket) => bucket.day === detailDay) ?? null;

  return (
    <>
      <DndContext onDragEnd={(event) => handleDragEnd(event, buckets, onMoveEvent)}>
        {isMonth ? (
          <MonthGrid
            buckets={buckets}
            selectedRange={selectedRange}
            onSelectDay={onSelectDay}
            onOpenDayDetail={onOpenDayDetail}
            onCreateEvent={onCreateEvent}
            onEditEvent={onEditEvent}
            onResizeEvent={onResizeEvent}
          />
        ) : (
          <TimeGrid
            view={view}
            days={days}
            buckets={buckets}
            selectedRange={selectedRange}
            onSelectDay={onSelectDay}
            onOpenDayDetail={onOpenDayDetail}
            onCreateEvent={onCreateEvent}
            onEditEvent={onEditEvent}
            onResizeEvent={onResizeEvent}
          />
        )}
      </DndContext>
      <DayDetailModal
        bucket={selectedDayDetail}
        open={detailDay != null}
        onClose={onCloseDayDetail}
        onEditEvent={onEditEvent}
      />
    </>
  );
}

function handleDragEnd(
  event: DragEndEvent,
  buckets: readonly DayBucket[],
  onMoveEvent: (event: PlanEventReadV2, fromDay: string, toDay: string) => void,
): void {
  const source = event.active.data.current as
    | { readonly event: PlanEventReadV2; readonly day: string }
    | undefined;
  const targetDay = typeof event.over?.id === 'string' ? event.over.id : null;
  if (!source || !targetDay || targetDay === source.day) return;
  const targetExists = buckets.some((bucket) => bucket.day === targetDay);
  if (!targetExists) return;
  onMoveEvent(source.event, source.day, targetDay);
}

function TimeGrid({
  view,
  days,
  buckets,
  selectedRange,
  onSelectDay,
  onOpenDayDetail,
  onCreateEvent,
  onEditEvent,
  onResizeEvent,
}: {
  readonly view: HomePlanView;
  readonly days: readonly string[];
  readonly buckets: readonly DayBucket[];
  readonly selectedRange: SelectedDateRange | null;
  readonly onSelectDay: (day: string) => void;
  readonly onOpenDayDetail: (day: string) => void;
  readonly onCreateEvent: (day: string) => void;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
  readonly onResizeEvent: (event: PlanEventReadV2, deltaMinutes: number) => void;
}) {
  const dayColumns = buckets.filter((bucket) => days.includes(bucket.day));
  return (
    <div className="grid gap-4 xl:grid-cols-[56px_minmax(0,1fr)]" data-testid={`plan-calendar-${view}`}>
      <div className="hidden xl:grid">
        {HOUR_LABELS.map((label) => (
          <div key={label} className="h-12 text-[11px] font-mono text-ink-4">
            {label}
          </div>
        ))}
      </div>
      <div
        className={cn(
          'grid gap-4 overflow-x-auto',
          view === 'today' ? 'grid-cols-1' : 'grid-cols-[repeat(7,minmax(220px,1fr))]',
        )}
      >
        {dayColumns.map((bucket) => (
          <TimeGridDay
            key={bucket.day}
            bucket={bucket}
            selected={isRangeSelected(bucket.day, selectedRange)}
            onSelectDay={onSelectDay}
            onOpenDayDetail={onOpenDayDetail}
            onCreateEvent={onCreateEvent}
            onEditEvent={onEditEvent}
            onResizeEvent={onResizeEvent}
          />
        ))}
      </div>
    </div>
  );
}

function TimeGridDay({
  bucket,
  selected,
  onSelectDay,
  onOpenDayDetail,
  onCreateEvent,
  onEditEvent,
  onResizeEvent,
}: {
  readonly bucket: DayBucket;
  readonly selected: boolean;
  readonly onSelectDay: (day: string) => void;
  readonly onOpenDayDetail: (day: string) => void;
  readonly onCreateEvent: (day: string) => void;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
  readonly onResizeEvent: (event: PlanEventReadV2, deltaMinutes: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.day });
  return (
    <Card
      padding="md"
      className={cn(
        'relative overflow-hidden border',
        selected && 'border-accent ring-2 ring-accent-50',
        isOver && 'border-accent bg-accent-50/30',
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-left"
            onClick={() => onSelectDay(bucket.day)}
            data-testid={`plan-day-select-${bucket.day}`}
          >
            <div className="font-serif text-lg text-ink">{bucket.day.slice(8, 10)}</div>
            <div className="text-xs font-mono uppercase tracking-wider text-ink-4">{bucket.day}</div>
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="quiet"
            leftIcon={<CalendarDaysIcon className="h-4 w-4" />}
            onClick={() => onOpenDayDetail(bucket.day)}
          >
            详情
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<PlusIcon className="h-4 w-4" />}
            onClick={() => onCreateEvent(bucket.day)}
          >
            新建
          </Button>
        </div>
      </header>
      <div ref={setNodeRef} className="relative h-[1152px] rounded-tiny border border-line bg-paper-2">
        {HOUR_LABELS.map((label, index) => (
          <div
            key={label}
            className="absolute inset-x-0 border-t border-line/70"
            style={{ top: index * HOUR_ROW_PX }}
          >
            <span className="absolute left-2 -top-2 bg-paper-2 px-1 text-[10px] font-mono text-ink-4 xl:hidden">
              {label}
            </span>
          </div>
        ))}
        {bucket.eventSlices.map((slice) => (
          <EventBlock
            key={`${slice.occurrenceRef}:${slice.day}`}
            slice={slice}
            onEditEvent={onEditEvent}
            onResizeEvent={onResizeEvent}
          />
        ))}
        {bucket.practiceBlocks.map((block) => (
          <PracticeBlock key={`${block.block.id}:${block.day}`} slice={block} />
        ))}
      </div>
    </Card>
  );
}

function MonthGrid({
  buckets,
  selectedRange,
  onSelectDay,
  onOpenDayDetail,
  onCreateEvent,
  onEditEvent,
  onResizeEvent,
}: {
  readonly buckets: readonly DayBucket[];
  readonly selectedRange: SelectedDateRange | null;
  readonly onSelectDay: (day: string) => void;
  readonly onOpenDayDetail: (day: string) => void;
  readonly onCreateEvent: (day: string) => void;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
  readonly onResizeEvent: (event: PlanEventReadV2, deltaMinutes: number) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="plan-calendar-month">
      {buckets.map((bucket) => (
        <MonthDayCard
          key={bucket.day}
          bucket={bucket}
          selected={isRangeSelected(bucket.day, selectedRange)}
          onSelectDay={onSelectDay}
          onOpenDayDetail={onOpenDayDetail}
          onCreateEvent={onCreateEvent}
          onEditEvent={onEditEvent}
          onResizeEvent={onResizeEvent}
        />
      ))}
    </div>
  );
}

function MonthDayCard({
  bucket,
  selected,
  onSelectDay,
  onOpenDayDetail,
  onCreateEvent,
  onEditEvent,
  onResizeEvent,
}: {
  readonly bucket: DayBucket;
  readonly selected: boolean;
  readonly onSelectDay: (day: string) => void;
  readonly onOpenDayDetail: (day: string) => void;
  readonly onCreateEvent: (day: string) => void;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
  readonly onResizeEvent: (event: PlanEventReadV2, deltaMinutes: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.day });
  return (
    <Card
      padding="md"
      className={cn(
        'border',
        selected && 'border-accent ring-2 ring-accent-50',
        isOver && 'border-accent bg-accent-50/30',
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectDay(bucket.day)}
          className="text-left"
          data-testid={`plan-day-select-${bucket.day}`}
        >
          <div className="font-serif text-lg text-ink">{bucket.day}</div>
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="quiet" onClick={() => onOpenDayDetail(bucket.day)}>
            详情
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onCreateEvent(bucket.day)}>
            新建
          </Button>
        </div>
      </header>
      <div ref={setNodeRef} className="space-y-2">
        {bucket.eventSlices.length === 0 && bucket.practiceBlocks.length === 0 ? (
          <div className="rounded-tiny border border-dashed border-line p-3 text-xs text-ink-4">
            当天暂无事件
          </div>
        ) : null}
        {bucket.eventSlices.map((slice) => (
          <CompactEventRow
            key={`${slice.occurrenceRef}:${slice.day}`}
            slice={slice}
            onEditEvent={onEditEvent}
            onResizeEvent={onResizeEvent}
          />
        ))}
        {bucket.practiceBlocks.map((practiceSlice) => {
          const block = practiceSlice.block;
          return (
            <div key={`${block.id}:${practiceSlice.day}`} className="rounded-tiny border border-accent-50 bg-accent-50/40 p-2">
            <div className="text-xs font-semibold text-accent">Practice</div>
            <div className="text-sm text-ink">{block.subject ?? block.category}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function EventBlock({
  slice,
  onEditEvent,
  onResizeEvent,
}: {
  readonly slice: CalendarEventSlice;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
  readonly onResizeEvent: (event: PlanEventReadV2, deltaMinutes: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${slice.event.id}:${slice.day}`,
    data: { event: slice.event, day: slice.day },
  });
  const dragAttributes = { ...attributes, role: undefined, tabIndex: undefined };
  const columnGeometry = computeColumnGeometry(
    slice.layout.column,
    slice.layout.totalColumns,
  );
  const style = {
    top: `${(slice.startMinutes / 60) * HOUR_ROW_PX}px`,
    height: `${Math.max(44, ((slice.endMinutes - slice.startMinutes) / 60) * HOUR_ROW_PX)}px`,
    left: `${columnGeometry.leftPercent}%`,
    width: `${columnGeometry.widthPercent}%`,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    zIndex: isDragging ? 10 : 1,
  } satisfies CSSProperties;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute rounded-tiny border border-accent bg-accent/10 p-2 text-left shadow-soft',
        isDragging && 'opacity-70',
      )}
      style={style}
      data-testid={`plan-event-${slice.event.id}`}
    >
      <button
        type="button"
        aria-label={`${slice.event.title} ${formatEventTime(slice.event.startAt, slice.event.timezone)} - ${formatEventTime(slice.event.endAt, slice.event.timezone)}`}
        className="w-full rounded-tiny text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => onEditEvent(slice.event)}
      >
        <div className="truncate text-xs font-mono uppercase tracking-wider text-accent">
          {formatEventTime(slice.event.startAt, slice.event.timezone)} - {formatEventTime(slice.event.endAt, slice.event.timezone)}
        </div>
        <div className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{slice.event.title}</div>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="拖动事件"
          className="inline-flex h-6 w-6 items-center justify-center rounded-tiny text-accent"
          {...listeners}
          {...dragAttributes}
        >
          <GripVerticalIcon className="h-4 w-4 shrink-0 text-accent" />
        </button>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="quiet"
            className="px-0"
            onClick={() => {
              onResizeEvent(slice.event, -15);
            }}
          >
            -15
          </Button>
          <Button
            size="sm"
            variant="quiet"
            className="px-0"
            onClick={() => {
              onResizeEvent(slice.event, 15);
            }}
          >
            +15
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompactEventRow({
  slice,
  onEditEvent,
  onResizeEvent,
}: {
  readonly slice: CalendarEventSlice;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
  readonly onResizeEvent: (event: PlanEventReadV2, deltaMinutes: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${slice.event.id}:${slice.day}`,
    data: { event: slice.event, day: slice.day },
  });
  const dragAttributes = { ...attributes, role: undefined, tabIndex: undefined };
  return (
    <div
      ref={setNodeRef}
      className="w-full rounded-tiny border border-line bg-paper-2 p-2 text-left"
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          aria-label={`${slice.event.title} ${formatEventTime(slice.event.startAt, slice.event.timezone)} - ${formatEventTime(slice.event.endAt, slice.event.timezone)}`}
          className="min-w-0 flex-1 rounded-tiny text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => onEditEvent(slice.event)}
        >
          <div className="text-sm font-semibold text-ink">{slice.event.title}</div>
          <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
            {formatEventTime(slice.event.startAt, slice.event.timezone)} - {formatEventTime(slice.event.endAt, slice.event.timezone)}
          </div>
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="拖动事件"
            className="inline-flex h-6 w-6 items-center justify-center rounded-tiny text-ink-4"
            {...listeners}
            {...dragAttributes}
          >
            <GripVerticalIcon className="h-4 w-4 shrink-0 text-ink-4" />
          </button>
          <Button
            size="sm"
            variant="quiet"
            className="px-0"
            onClick={() => {
              onResizeEvent(slice.event, -15);
            }}
          >
            -15
          </Button>
          <Button
            size="sm"
            variant="quiet"
            className="px-0"
            onClick={() => {
              onResizeEvent(slice.event, 15);
            }}
          >
            +15
          </Button>
        </div>
      </div>
    </div>
  );
}

function PracticeBlock({ slice }: { readonly slice: PracticeBlockSlice }) {
  const block = slice.block;
  return (
    <div
      data-testid={`practice-block-${slice.block.id}-${slice.day}`}
      className="absolute left-2 right-2 rounded-tiny border border-dashed border-ok bg-ok-bg/70 p-2"
      style={{
        top: `${(slice.startMinutes / 60) * HOUR_ROW_PX}px`,
        height: `${Math.max(32, ((slice.endMinutes - slice.startMinutes) / 60) * HOUR_ROW_PX)}px`,
      }}
    >
      <div className="text-xs font-mono uppercase tracking-wider text-ok">Practice</div>
      <div className="text-sm font-semibold text-ink">
        {block.subject ?? block.category} · {block.itemsCount} items
      </div>
    </div>
  );
}

function DayDetailModal({
  bucket,
  open,
  onClose,
  onEditEvent,
}: {
  readonly bucket: DayBucket | null;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onEditEvent: (event: PlanEventReadV2) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={bucket?.day ?? 'Day detail'} size="lg">
      <div className="space-y-4">
        <section>
          <h3 className="mb-2 text-sm font-mono uppercase tracking-wider text-ink-4">Events</h3>
          <div className="space-y-2">
            {bucket?.eventSlices.map((slice) => (
              <button
                key={`${slice.occurrenceRef}:${slice.day}`}
                type="button"
                className="w-full rounded-tiny border border-line bg-paper-2 p-3 text-left"
                onClick={() => onEditEvent(slice.event)}
              >
                <div className="text-sm font-semibold text-ink">{slice.event.title}</div>
                <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
                  {formatEventTime(slice.event.startAt, slice.event.timezone)} - {formatEventTime(slice.event.endAt, slice.event.timezone)}
                </div>
              </button>
            ))}
            {bucket?.eventSlices.length === 0 ? <p className="text-sm text-ink-4">当天暂无事件。</p> : null}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-mono uppercase tracking-wider text-ink-4">Practice blocks</h3>
          <div className="space-y-2">
            {bucket?.practiceBlocks.map((practiceSlice) => {
              const block = practiceSlice.block;
              return (
              <div key={`${block.id}:${practiceSlice.day}`} className="rounded-tiny border border-accent-50 bg-accent-50/40 p-3">
                <div className="text-sm font-semibold text-ink">
                  {block.subject ?? block.category} · {block.itemsCount} items
                </div>
                <div className="mt-1 flex gap-2">
                  <Badge tone={block.isInProgress ? 'warn' : 'success'} variant="chip">
                    {block.isInProgress ? 'In progress' : 'Completed'}
                  </Badge>
                  {block.accuracy ? <Badge tone="neutral">{block.accuracy}</Badge> : null}
                </div>
              </div>
              );
            })}
            {bucket?.practiceBlocks.length === 0 ? (
              <p className="text-sm text-ink-4">当天暂无 practice block。</p>
            ) : null}
          </div>
        </section>
      </div>
    </Modal>
  );
}

function isRangeSelected(day: string, selectedRange: SelectedDateRange | null): boolean {
  if (!selectedRange) return false;
  return day >= selectedRange.from && day <= selectedRange.to;
}
