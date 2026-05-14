/**
 * SIKAO Wave 8 Phase C · Home block 3 — 临考冲刺 (多 exam 自定义).
 *
 * 数据源: useUpcomingExams() → UserExamList (exams: UserExamRead[]).
 * 显示: 最近 1 场 exam (按 daysUntil 升序) + chip 切换其他 exam.
 * "编辑考试" CTA → open ExamCustomSheet.
 * Empty 态: "添加考试目标 →" CTA → open sheet.
 *
 * Dumb by contract: 不 fetch / 不写 store; props 接数据 + onOpenSheet callback.
 * caller (Dashboard.tsx) 控制 sheet open state + mutation.
 *
 * Wave 8 Phase B BE 已 ship POST/PATCH/DELETE /api/v2/user-exams (sheet 内调用),
 * 当前 Phase C 用 mock 数据先 build view, Phase D wire 真 endpoint.
 */

import { useState } from 'react';
import type { UserExamRead } from '@sikao/domain/dashboard/useHomeData';

export interface HomeUpcomingExamsBlockProps {
  /** 用户考试列表 (按 daysUntil 升序 caller 排好). */
  readonly exams: readonly UserExamRead[];
  /** 触发 sheet open (Add / Edit 都走同一入口, sheet 内分态). */
  readonly onOpenSheet: () => void;
}

export function HomeUpcomingExamsBlock({
  exams,
  onOpenSheet,
}: HomeUpcomingExamsBlockProps) {
  // 当前选中的 exam id (默认第一场, 即最近的). 用户点 chip 切换.
  const [activeExamId, setActiveExamId] = useState<number | null>(
    exams.length > 0 ? exams[0].id : null,
  );

  // Empty 态: 无考试目标
  if (exams.length === 0) {
    return (
      <section
        className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card min-h-[150px]"
        data-testid="home-upcoming-exams-block"
      >
        <header className="flex items-baseline justify-between pb-3 border-b border-line">
          <h4 className="font-serif text-h-card font-medium m-0">临考冲刺</h4>
          <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
            03 / 04
          </span>
        </header>
        <p className="text-sm text-ink-3 leading-relaxed flex-1">
          还没设置考试目标。加一个，看到倒计时更有节奏。
        </p>
        <button
          type="button"
          onClick={onOpenSheet}
          className="self-start rounded-tiny bg-surface text-ink border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-white transition-colors duration-fast"
          data-testid="home-upcoming-exams-add"
        >
          添加考试目标 →
        </button>
      </section>
    );
  }

  // Happy 态: 至少 1 场考试
  const active =
    exams.find((e) => e.id === activeExamId) ?? exams[0];
  const isPast = active.daysUntil < 0;

  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card min-h-[150px]"
      data-testid="home-upcoming-exams-block"
    >
      <header className="flex items-baseline justify-between pb-3 border-b border-line">
        <h4 className="font-serif text-h-card font-medium m-0">临考冲刺</h4>
        <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          03 / 04
        </span>
      </header>

      <div className="flex-1 flex flex-col gap-2">
        <p
          className="font-serif text-base text-ink m-0 truncate"
          title={active.name}
          data-testid="home-upcoming-active-name"
        >
          {active.name}
        </p>
        <p className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          {active.examDate} ·{' '}
          {isPast
            ? `已过 ${Math.abs(active.daysUntil)} 天`
            : active.daysUntil === 0
              ? '今天'
              : `还有 ${active.daysUntil} 天`}
        </p>

        {/* 多 exam chip 切换 — 至少 2 场才显 */}
        {exams.length > 1 ? (
          <ul
            className="flex flex-wrap gap-2"
            data-testid="home-upcoming-exam-chips"
          >
            {exams.map((e) => {
              const isActive = e.id === active.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setActiveExamId(e.id)}
                    aria-pressed={isActive}
                    className={`rounded-tiny border px-2 py-1 font-mono text-tiny tracking-eyebrow uppercase transition-colors duration-fast ${
                      isActive
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-transparent text-ink-3 border-line hover:text-ink hover:border-ink'
                    }`}
                    data-testid={`home-upcoming-exam-chip-${e.id}`}
                  >
                    {e.name}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onOpenSheet}
        className="self-start rounded-tiny bg-surface text-ink border border-line px-3 py-2 text-sm font-medium hover:border-ink transition-colors duration-fast"
        data-testid="home-upcoming-exams-edit"
      >
        编辑考试 →
      </button>
    </section>
  );
}
