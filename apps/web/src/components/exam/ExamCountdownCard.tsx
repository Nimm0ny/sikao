import { useCallback, useState } from 'react';
import { SubjectPlanIcon } from '@sikao/ui/icons';
import { Badge, Button, Card } from '@sikao/ui/ui';
import {
  daysUntil,
  phaseOf,
  urgencyOf,
  type ExamEvent,
  type ExamPhase,
} from '@sikao/domain/study-record/exam-calendar';
import { isTrackedExam, toggleTrackedExam } from '@sikao/domain/study-record/exam-tracking';
import { cn } from '@sikao/shared-utils';

// Phase 7.x — 单 exam 倒计时卡片. dumb 组件, props-only.
//
// tone 选择按 urgency:
//   imminent (≤7 天)  → border-err + 大数字 danger
//   soon (≤30 天)     → border-warn + 大数字 warn
//   distant / past    → 中性 line + ink-muted
//
// P0-3 registration-open phase 主大数字改"报名剩 X 天"+ 副字"考试还有 Y 天"
// (audit #13). 其他 phase 保持现状.

const PHASE_COPY: Record<ExamPhase, { label: string; tone: 'neutral' | 'warn' | 'danger' | 'success' }> = {
  'before-registration': { label: '报名未开始', tone: 'neutral' },
  'registration-open': { label: '正在报名', tone: 'warn' },
  preparation: { label: '备考中', tone: 'neutral' },
  imminent: { label: '即将开考', tone: 'danger' },
  past: { label: '已结束', tone: 'success' },
};

const CATEGORY_LABEL: Record<ExamEvent['category'], string> = {
  national: '国考',
  provincial: '省考',
  institution: '事业单位',
  other: '其他',
};

export interface ExamCountdownCardProps {
  readonly event: ExamEvent;
  /** Optional override for testing — defaults to `new Date()`. */
  readonly now?: Date;
  readonly className?: string;
  /** P0-2: 显隐 "跟踪" / "+ 日历" 按钮 (Home next exam 复用时不显示). */
  readonly showActions?: boolean;
}

// RFC 5545 §3.3.11 TEXT escape: backslash / 逗号 / 分号 全 escape, newline →
// \n. SUMMARY / DESCRIPTION / LOCATION 等 TEXT-typed properties 必须 escape,
// 否则用户 notes 里写个英文逗号 / 分号就会被外部日历软件解析成多值, 出错.
// (规范官 P1-2 2026-05-08).
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function buildIcsBlob(event: ExamEvent): Blob {
  // 手写 RFC 5545 ICS - 不引外部 lib. 仅 VEVENT 主事件 (报名/考试).
  const dtStart = event.examDate.replace(/-/g, ''); // YYYYMMDD
  const exam = new Date(`${event.examDate}T00:00:00`);
  const next = new Date(exam.getTime() + 24 * 60 * 60 * 1000);
  const dtEnd = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const summary = escapeIcsText(`${CATEGORY_LABEL[event.category]} · ${event.name}`);
  const desc: string[] = [];
  if (event.registrationStart !== undefined && event.registrationEnd !== undefined) {
    desc.push(`报名期: ${event.registrationStart} ~ ${event.registrationEnd}`);
  }
  if (event.notes !== undefined) desc.push(event.notes);
  if (event.precision === 'estimate') desc.push('日期为估算值, 以官方公告为准.');
  // desc 数组拼接前各段单独 escape, 用 literal \n (RFC 5545) 分行.
  const description = desc.length > 0
    ? desc.map(escapeIcsText).join('\\n')
    : escapeIcsText('公考考试日');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIKAO//ExamCalendar//ZH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.slug}@sikao.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
}

function downloadIcs(event: ExamEvent): void {
  if (typeof window === 'undefined') return;
  const blob = buildIcsBlob(event);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // revoke 异步, 避免 chrome 在 click 之前清空.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExamCountdownCard({
  event,
  now = new Date(),
  className,
  showActions = true,
}: ExamCountdownCardProps) {
  const days = daysUntil(event.examDate, now);
  const urgency = urgencyOf(days);
  const phase = phaseOf(event, now);
  const phaseCopy = PHASE_COPY[phase];

  // P0-2: tracking state. 用 useState 持本地副本而非每 render readSet, 让按钮
  // toggle 后立刻视觉反馈.
  const [tracked, setTracked] = useState(() => isTrackedExam(event.slug));
  const onToggleTrack = useCallback(() => {
    const next = toggleTrackedExam(event.slug);
    setTracked(next);
  }, [event.slug]);

  const isPast = urgency === 'past';
  const borderClass =
    urgency === 'imminent'
      ? 'border-err'
      : urgency === 'soon'
        ? 'border-warn'
        : 'border-line';

  const numberClass =
    urgency === 'imminent'
      ? 'text-err'
      : urgency === 'soon'
        ? 'text-warn'
        : isPast
          ? 'text-ink-4'
          : 'text-ink';

  // 显示数字: past 显示绝对值 + "天前", upcoming 显示 days + "天后".
  const displayDays = Math.abs(days);
  const dayLabel = isPast ? '天前' : days === 0 ? '今天' : '天';

  // P0-3: registration-open 主数字切换为报名倒计时.
  const isRegistrationOpen = phase === 'registration-open' && event.registrationEnd !== undefined;
  const regDays = isRegistrationOpen
    ? daysUntil(event.registrationEnd as string, now)
    : 0;
  const showRegMain = isRegistrationOpen && regDays >= 0;

  return (
    <Card
      padding="md"
      className={cn(
        'border transition-colors duration-base',
        borderClass,
        isPast && 'opacity-60',
        tracked && !isPast && 'ring-1 ring-ink/20',
        className,
      )}
      data-testid={`exam-countdown-${event.slug}`}
      data-tracked={tracked ? 'true' : 'false'}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <SubjectPlanIcon className="w-4 h-4 text-ink-4 shrink-0" />
          <span
            className="text-tiny font-mono font-semibold tracking-eyebrow text-ink-4 truncate"
            data-testid={`exam-category-${event.slug}`}
          >
            {CATEGORY_LABEL[event.category]}
          </span>
          {event.precision === 'estimate' ? (
            <Badge variant="hairline" tone="neutral">估</Badge>
          ) : null}
        </div>
        <Badge variant="hairline" tone={phaseCopy.tone}>
          {phaseCopy.label}
        </Badge>
      </div>

      <div className="font-bold text-ink truncate" data-testid={`exam-name-${event.slug}`}>
        {event.name}
      </div>
      <div className="text-xs text-ink-3 mt-1">
        笔试日：{event.examDate}
        {event.registrationEnd !== undefined && phase === 'registration-open' ? (
          <span> · 报名截止 {event.registrationEnd}</span>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        {showRegMain ? (
          <>
            <span className="text-tiny font-mono font-semibold tracking-eyebrow text-warn shrink-0">
              报名剩
            </span>
            <span
              className={cn('font-serif italic font-bold tabular-nums text-h-section text-warn')}
              data-testid={`exam-reg-days-${event.slug}`}
            >
              {regDays}
            </span>
            <span className="text-sm text-ink-3">天</span>
            <span className="text-xs text-ink-4 ml-2 self-baseline">
              · 考试还有
              <span className="font-mono tabular-nums text-ink mx-1">{displayDays}</span>
              天
            </span>
          </>
        ) : days === 0 ? (
          <span
            className={cn('font-bold text-h-section text-ink', numberClass)}
            data-testid={`exam-days-${event.slug}`}
          >
            就在今天
          </span>
        ) : (
          <>
            <span
              className={cn('font-serif italic font-bold tabular-nums text-h-section', numberClass)}
              data-testid={`exam-days-${event.slug}`}
            >
              {displayDays}
            </span>
            <span className={cn('text-sm', isPast ? 'text-ink-4' : 'text-ink-3')}>
              {dayLabel}
            </span>
          </>
        )}
      </div>

      {event.notes !== undefined ? (
        <div className="mt-3 text-xs text-ink-4 leading-relaxed">{event.notes}</div>
      ) : null}

      {showActions && !isPast ? (
        <div className="mt-4 flex items-center gap-2 pt-3 border-t border-line">
          <button
            type="button"
            onClick={onToggleTrack}
            className={cn(
              'inline-flex items-center gap-1 text-xs px-3 py-1 rounded-tiny border font-semibold transition-colors duration-fast motion-safe:hover:-translate-y-0.5',
              tracked
                ? 'border-ink bg-ink text-surface'
                : 'border-line text-ink-3 hover:text-ink hover:border-ink',
            )}
            data-testid={`exam-track-${event.slug}`}
            aria-pressed={tracked}
            aria-label={tracked ? `已跟踪 ${event.name}` : `跟踪 ${event.name}`}
          >
            <span aria-hidden="true">{tracked ? '✓' : '+'}</span>
            <span>{tracked ? '已跟踪' : '跟踪'}</span>
          </button>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => downloadIcs(event)}
            data-testid={`exam-ics-${event.slug}`}
            aria-label={`下载 ${event.name} 日历提醒`}
          >
            + 日历
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
