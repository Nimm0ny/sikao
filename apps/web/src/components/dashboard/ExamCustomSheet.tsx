/**
 * SIKAO Wave 8 Phase C · 自定义考试 sheet (bottom-sheet mobile / drawer desktop).
 *
 * 触发: Home block 3 "编辑考试" / "添加考试目标" CTA.
 * 内容:
 *   - list user_exams (name / date / D-N / 删除按钮)
 *   - "新增考试" button → 表单 (name input / date picker / linked study_plan_id
 *     select optional + notes textarea)
 *
 * BE Phase B (a16e13c...) 已 ship POST/PATCH/DELETE /api/v2/user-exams.
 * Phase C 用 mock 数据 + mock callbacks (caller stub mutation). Phase D wire
 * useMutation + 真 endpoint.
 *
 * 复用 Drawer primitive (frontend/src/components/ui/Drawer.tsx) — bottom-sheet
 * mobile + side drawer desktop, 同份组件两态. ESC 关闭 + scrim 点击关闭已内置.
 *
 * 表单状态: 本地 useState (sheet 关闭即 reset). Wave 8 Phase D 改 react-hook-form
 * + zod schema (跟其他 form view 对齐).
 */

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { BottomDrawer } from '@sikao/ui/ui';
import type { UserExamRead } from '@sikao/domain/dashboard/useHomeData';

export interface ExamCustomSheetProps {
  /** Sheet 开关. */
  readonly open: boolean;
  /** 关 sheet callback. */
  readonly onClose: () => void;
  /** 现有 exam list. */
  readonly exams: readonly UserExamRead[];
  /** 新增 callback — Phase D wire mutation. */
  readonly onCreate: (input: ExamFormInput) => void;
  /** 删除 callback — Phase D wire mutation. */
  readonly onDelete: (examId: number) => void;
}

export interface ExamFormInput {
  readonly name: string;
  readonly examDate: string; // YYYY-MM-DD
  readonly notes: string | null;
}

const INITIAL_FORM: ExamFormInput = {
  name: '',
  examDate: '',
  notes: null,
};

export function ExamCustomSheet({
  open,
  onClose,
  exams,
  onCreate,
  onDelete,
}: ExamCustomSheetProps) {
  const [form, setForm] = useState<ExamFormInput>(INITIAL_FORM);
  const [showForm, setShowForm] = useState<boolean>(false);

  function resetForm(): void {
    setForm(INITIAL_FORM);
    setShowForm(false);
  }

  function handleNameChange(e: ChangeEvent<HTMLInputElement>): void {
    setForm({ ...form, name: e.target.value });
  }

  function handleDateChange(e: ChangeEvent<HTMLInputElement>): void {
    setForm({ ...form, examDate: e.target.value });
  }

  function handleNotesChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    const v = e.target.value;
    setForm({ ...form, notes: v.length > 0 ? v : null });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // 表单基本校验 (name / date 必填)
    if (form.name.trim().length === 0 || form.examDate.length === 0) {
      return;
    }
    onCreate(form);
    resetForm();
  }

  function handleSheetClose(): void {
    resetForm();
    onClose();
  }

  return (
    <BottomDrawer
      open={open}
      onToggle={(next) => {
        if (!next) handleSheetClose();
      }}
      ariaLabel="自定义考试"
      header={
        <div
          className="flex items-baseline justify-between w-full"
          data-testid="exam-custom-sheet-header"
        >
          <h3 className="font-serif text-h-card font-medium m-0">自定义考试</h3>
          <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
            {exams.length} 场
          </span>
        </div>
      }
    >
      <div
        className="flex flex-col gap-4"
        data-testid="exam-custom-sheet-body"
      >
        {/* 现有考试列表 */}
        {exams.length === 0 ? (
          <p className="text-sm text-ink-3 leading-relaxed">
            还没添加任何考试。先加一场, 看到倒计时更有节奏。
          </p>
        ) : (
          <ul
            className="flex flex-col gap-2"
            data-testid="exam-custom-sheet-list"
          >
            {exams.map((e) => {
              const isPast = e.daysUntil < 0;
              return (
                <li
                  key={e.id}
                  className="rounded-card border border-line bg-surface p-3 flex items-start gap-3"
                  data-testid={`exam-custom-row-${e.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-base text-ink m-0 truncate">
                      {e.name}
                    </p>
                    <p className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase mt-1">
                      {e.examDate} ·{' '}
                      {isPast
                        ? `已过 ${Math.abs(e.daysUntil)} 天`
                        : e.daysUntil === 0
                          ? '今天'
                          : `还有 ${e.daysUntil} 天`}
                    </p>
                    {e.notes != null ? (
                      <p className="text-sm text-ink-3 mt-2 leading-relaxed">
                        {e.notes}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(e.id)}
                    aria-label={`删除 ${e.name}`}
                    className="shrink-0 rounded-tiny border border-line text-ink-3 px-2 py-1 text-sm hover:border-err hover:text-err transition-colors duration-fast"
                    data-testid={`exam-custom-delete-${e.id}`}
                  >
                    删除
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* 新增表单 (折叠态, 点 "新增" 展开) */}
        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3"
            data-testid="exam-custom-sheet-form"
          >
            <label className="flex flex-col gap-1">
              <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
                考试名称
              </span>
              {/* a11y: nested <label> 包 <span> 标签 + <input> 是 W3C 合法 pattern;
                  plugin 不识别 sibling text node 当 label, 行级 escape. */}
              {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
              <input
                type="text"
                value={form.name}
                onChange={handleNameChange}
                placeholder="e.g. 省考 / 国考"
                required
                maxLength={120}
                className="rounded-tiny border border-line bg-surface text-ink px-3 py-2 text-sm focus:outline-none focus:border-ink"
                data-testid="exam-custom-form-name"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
                考试日期
              </span>
              {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
              <input
                type="date"
                value={form.examDate}
                onChange={handleDateChange}
                required
                className="rounded-tiny border border-line bg-surface text-ink px-3 py-2 text-sm focus:outline-none focus:border-ink"
                data-testid="exam-custom-form-date"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
                备注 (可选)
              </span>
              {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
              <textarea
                value={form.notes ?? ''}
                onChange={handleNotesChange}
                rows={2}
                placeholder="复习重点 / 报名号 / 注意事项 ..."
                className="rounded-tiny border border-line bg-surface text-ink px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none"
                data-testid="exam-custom-form-notes"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-tiny border border-line text-ink-3 px-3 py-2 text-sm hover:border-ink hover:text-ink transition-colors duration-fast"
                data-testid="exam-custom-form-cancel"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-tiny bg-ink text-paper px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity duration-fast"
                data-testid="exam-custom-form-submit"
              >
                保存
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="self-start rounded-tiny bg-surface text-ink border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-white transition-colors duration-fast"
            data-testid="exam-custom-add-new"
          >
            新增考试 →
          </button>
        )}
      </div>
    </BottomDrawer>
  );
}
