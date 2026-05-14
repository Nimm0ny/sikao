import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@sikao/shared-utils';
import { formatTime } from '@sikao/answer-engine/grid-layout/gridLayout';

interface Props {
  written: number;
  minWords?: number;
  maxWords?: number;
  remaining: number;
  // PR3 D7=B 拦截 — 整卷模式下用户点交卷时, 若任何题答案为空, 列题号让用户
  // 知情后再决定提交 (而非 D7=A 静默跳过 → 用户以为交了 N 题实际只评了 M 题).
  //
  // 三态 prop 语义 (PR3 review P1 #2 文档化):
  //   - undefined (单题路径, 老 EssayPractice 不传 prop)
  //   - []        (整卷路径全题答了)
  //   - 非空      (整卷路径有未答题号, 例 ['第二题', '第四题'])
  // undefined 跟 [] 行为完全相同: 不渲染未答 banner, 黑底"确认交卷"按钮 (单题
  // 或全答都没拦截需求). 仅非空才显 danger banner + 红底按钮 + 列题号警示.
  unansweredQuestionNumbers?: readonly string[];
  onCancel: () => void;
  onConfirm: () => void;
}

// SubmitDialog — F6.3. Surfaces 字数 / 剩余时间 summary + an explicit warning
// when 字数 is short of the target. PR3 加 D7=B 弃考拦截: 整卷模式下未答题
// 不静默跳过, 列题号要二次确认.

export function SubmitDialog({
  written,
  minWords,
  maxWords,
  remaining,
  unansweredQuestionNumbers,
  onCancel,
  onConfirm,
}: Props) {
  const hasUnanswered =
    unansweredQuestionNumbers !== undefined && unansweredQuestionNumbers.length > 0;
  const targetWords = minWords ?? maxWords;
  if (targetWords === undefined) {
    throw new Error('submit dialog word limit missing');
  }
  const reached = minWords !== undefined && written >= minWords;
  const exceeded = maxWords !== undefined && written > maxWords;
  const wordsTone = exceeded ? 'text-err' : reached ? 'text-ok' : 'text-ink';
  const titleId = useId();
  // Initial focus goes to "再检查" — 提交是不可逆操作，默认聚焦最安全 action.
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  // Sync ref guards against double-click between React renders (state update
  // is async; a held-Enter or fast double-click could otherwise fire onConfirm
  // twice before the dialog unmounts).
  const inflightRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cancelBtnRef.current?.focus();
  }, []);

  // ESC = cancel — owned by the dialog itself so the listener is scoped to
  // the dialog's lifetime (vs. the ExamShell global handler which sat behind
  // the cmd-key gate and never fired on bare Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !inflightRef.current) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleConfirm = () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setSubmitting(true);
    onConfirm();
  };

  return (
    // a11y: modal backdrop with click-to-dismiss. role="dialog" 不算 interactive
    // element (dialog/alertdialog 是 region role 子类), 但仍允许 click-handler 因为
    // ESC keyboard fallback 由 useEffect 全局 listener 处理 (line 62-71). plugin
    // 不读 useEffect, 仍 warn, 行级 escape.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      onClick={onCancel}
      className={cn(
        'absolute inset-0 z-50',
        'bg-ink/40 backdrop-blur-[4px]', /* hardcode-allow: 4px modal backdrop blur per design v2 */
        'flex items-center justify-center',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="exam-submit-dialog"
    >
      {/* a11y: modal body 仅 stopPropagation 阻挡 backdrop click; body 内 button/textarea
          有自己的 a11y, 此层 div 不参与 keyboard interaction. plugin 仍 warn 因为
          挂了 onClick, 行级 escape. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-card-lg w-[400px] p-6 shadow-pop" /* hardcode-allow: 400px modal width is content-driven */
      >
        <div id={titleId} className="text-md font-bold text-ink mb-1">
          确认交卷？
        </div>
        <div className="text-xs text-ink-3 mb-4">交卷后进入评分流程,无法修改答案。</div>
        <div
          className={cn(
            'bg-surface-alt border border-line rounded-card-lg p-3 mb-4',
            'grid grid-cols-2 gap-3 text-xs text-ink-3',
          )}
        >
          <div>
            正文字数
            <div
              className={cn(
                'text-lg font-bold font-mono mt-1',
                wordsTone,
              )}
              data-testid="exam-submit-dialog-words"
            >
              {written}
              <span className="text-xs text-ink-4 ml-1">/ {targetWords}</span>
            </div>
          </div>
          <div>
            剩余时间
            <div className="text-lg font-bold font-mono mt-1 text-ink">
              {formatTime(remaining)}
            </div>
          </div>
        </div>
        {hasUnanswered && (
          <div
            role="alert"
            className={cn(
              'px-3 py-2 mb-4 rounded-tiny',
              'bg-bad-bg border border-err/40 text-xs text-err leading-relaxed',
            )}
            data-testid="exam-submit-dialog-unanswered"
          >
            <div className="font-bold mb-1">以下题目未作答</div>
            <div className="font-mono">
              {unansweredQuestionNumbers?.join(' / ')}
            </div>
            <div className="mt-1 text-err/80">
              提交后这些题不进入评分.
            </div>
          </div>
        )}
        {minWords !== undefined && !reached && (
          <div
            className={cn(
              'px-3 py-2 mb-4 rounded-tiny',
              'bg-warn-bg border border-warn/40 text-xs text-warn leading-relaxed',
            )}
            data-testid="exam-submit-dialog-warn"
          >
            字数不足 {minWords},可能影响评分。还差 {minWords - written} 字。
          </div>
        )}
        <div className="flex gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={cn(
              'flex-1 px-4 py-3 bg-surface border border-line text-ink-3 rounded-card text-sm font-semibold cursor-pointer',
              'transition-colors duration-base hover:bg-surface-alt',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            data-testid="exam-submit-dialog-cancel"
          >
            再检查
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={cn(
              'flex-1 px-4 py-3 rounded-card text-sm font-bold cursor-pointer',
              hasUnanswered
                ? 'bg-err text-surface'  // 未答题提交 = 不可逆, 红底视觉警示
                : 'bg-ink text-surface',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
            data-testid="exam-submit-dialog-confirm"
          >
            {submitting
              ? '提交中…'
              : hasUnanswered
              ? '提交未答题'
              : '确认交卷'}
          </button>
        </div>
      </div>
    </div>
  );
}
