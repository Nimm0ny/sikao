/**
 * SIKAO Wave 4 Phase 2D · 错题重做 (DetailB 分栏挑战模式).
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .split DetailB.
 *
 * 路由: /wrong-book/:questionId/redo.
 *
 * 主体: 左原题 + 右答题区 (空白重答 / 计时器 / 蒙对检测 / peek).
 * 蒙对检测: 耗时 > 均时 × 2 + 答对 → bluffDetected=true banner.
 * peek button: 扣 peek_count, peek_remaining=0 时 disabled.
 *
 * 关键 UX:
 *   - 进入时启动 ticker (1s 增).
 *   - 提交时 duration_ms = ticker × 1000 + selectedKey → BE submit-bluff.
 *   - peek button 点击调 peek mutation, 拿 PeekResult 后展示参考答案.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  Button,
  Card,
  EmptyState,
  IconBtn,
  Skeleton,
  Tooltip,
} from '@sikao/ui/ui';
import {
  AlertCircleIcon,
  ClockIcon,
  ToolEyeIcon,
  NavSubmitIcon,
  NavBackIcon,
} from '@sikao/ui/icons';
import { NoteCaptureLauncher } from '@/components/notes';
import {
  usePeekWrongQuestion,
  useSubmitWithBluff,
  type WrongBookSubmitResult,
} from '@sikao/api-client/queries/wrongBookQueries';
import { useWrongQuestionItem } from '@sikao/domain/wrong-book/useWrongQuestionItem';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { cn } from '@sikao/shared-utils';

const AVG_TIME_MS = 35 * 1000; // 均时 35s (元素稿 spec 默认)

function formatTimer(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// Wave 6E (2026-05-12): 题干 HTML → plain text 截 100 char 给 NoteCaptureLauncher
// 当 sourceQuote pre-fill. 不走 DOMPurify (那是渲染 sanitize), 这里只剥 tag +
// collapse whitespace, 入 BE sourceQuote 字段是纯文本.
function extractStemPlainText(html: string): string {
  if (html.length === 0) return '';
  const stripped = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length === 0) return '';
  if (stripped.length <= 100) return stripped;
  return `${stripped.slice(0, 100)}…`;
}

export default function WrongQuestionRedoView() {
  const params = useParams<{ questionId: string }>();
  const questionId = parseInt(params.questionId ?? '0', 10);
  const navigate = useNavigate();

  const { item, isLoading, isError } = useWrongQuestionItem(questionId);
  const peekMutation = usePeekWrongQuestion();
  const submitMutation = useSubmitWithBluff();

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [seconds, setSeconds] = useState(0);
  const [peeked, setPeeked] = useState(false);
  const [submitResult, setSubmitResult] = useState<WrongBookSubmitResult | null>(
    null,
  );
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ticker — 进入后 1s 增. 解卸时 clean.
  useEffect(() => {
    if (submitResult !== null) {
      if (tickerRef.current !== null) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      return undefined;
    }
    tickerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (tickerRef.current !== null) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };
  }, [submitResult]);

  const toggleOption = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        next.clear();
        next.add(key);
      }
      return next;
    });
  }, []);

  const onPeek = useCallback(() => {
    if (item === undefined) return;
    peekMutation.mutate(item.questionId, {
      onSuccess: () => {
        setPeeked(true);
        toast.info('已偷看一次', '将扣除一次毕业机会');
      },
      onError: (err) => {
        logger.error('wrong-book.peek.failed', { err: String(err) });
        toast.error('偷看失败', '请稍后重试');
      },
    });
  }, [item, peekMutation]);

  const onSubmit = useCallback(() => {
    if (item === undefined) return;
    if (selected.size === 0) {
      toast.warn('请先选择答案');
      return;
    }
    submitMutation.mutate(
      {
        questionId: item.questionId,
        payload: {
          selectedOptionKeys: Array.from(selected),
          durationMs: seconds * 1000,
        },
      },
      {
        onSuccess: (result) => {
          setSubmitResult(result);
          if (result.bluffDetected) {
            toast.warn('蒙对识破', '耗时异常 — 这次不计毕业');
          }
        },
        onError: (err) => {
          logger.error('wrong-book.submit-bluff.failed', { err: String(err) });
          toast.error('提交失败', '请稍后重试');
        },
      },
    );
  }, [item, selected, seconds, submitMutation]);

  useEffect(() => {
    if (!Number.isFinite(questionId) || questionId <= 0) {
      navigate('/wrong-book', { replace: true });
    }
  }, [questionId, navigate]);

  if (isLoading) {
    return (
      <div className="px-4 md:px-14 py-6 md:py-8 space-y-3">
        <Skeleton heightClass="h-10" />
        <Skeleton heightClass="h-96" />
      </div>
    );
  }

  if (isError || item === undefined) {
    return (
      <div className="px-4 md:px-14 py-6 md:py-8">
        <EmptyState
          title="未找到这道错题"
          description="可能已被移出错题本, 或链接已过期."
          action={
            <Button variant="primary" onClick={() => navigate('/wrong-book')}>
              返回错题本
            </Button>
          }
        />
      </div>
    );
  }

  const isTimeoutDanger = seconds * 1000 > AVG_TIME_MS * 2;
  const peekRemaining = peekMutation.data?.peekRemaining ?? 1;
  const canPeek = !peeked && peekRemaining > 0;

  return (
    <div
      className="px-4 md:px-14 py-6 md:py-8"
      data-testid="wrong-question-redo-view"
    >
      {/* 顶部 banner: 错次数 + 计时 + 目标 */}
      <Card
        padding="md"
        variant="muted"
        className="mb-6 grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center"
      >
        <div
          className="w-10 h-10 bg-ink text-white flex items-center justify-center"
          aria-hidden="true"
        >
          <AlertCircleIcon size={24} />
        </div>
        <div>
          <div className="font-serif text-sm text-ink leading-relaxed">
            这道题你已经错了{' '}
            <b className="text-err">{item.wrongCount} 次</b> · 这次目标:{' '}
            <b>不看答案做对</b>
          </div>
          <div className="font-mono text-xs text-ink-3 mt-1 tracking-loose">
            蒙对检测已开 · 耗时异常 (&gt; {Math.floor((AVG_TIME_MS * 2) / 1000)}s) 将判蒙对
          </div>
        </div>
        {/* Wave 6E (2026-05-12): 重做时灵感即时记 — 跨域 attached note. */}
        <NoteCaptureLauncher
          target={{
            kind: 'wrong_question',
            refId: item.questionId,
            sourceDomain: 'xingce',
            sourceRef: `错题 #${item.questionId}${item.subject !== null ? ` · ${item.subject}` : ''}`,
          }}
          sourceQuote={extractStemPlainText(item.stem)}
          defaultType="reflect"
          tooltip="添加错因笔记"
          testId="wrong-redo-capture"
        />
        <div
          className={cn(
            'font-mono text-xl font-semibold tabular-nums flex items-center gap-2',
            isTimeoutDanger ? 'text-exam-accent' : 'text-ink',
          )}
          data-testid="wrong-redo-timer"
        >
          <ClockIcon size={20} />
          {formatTimer(seconds)}
        </div>
      </Card>

      {/* 蒙对检测 banner (提交后展示) */}
      {submitResult?.bluffDetected === true ? (
        <Card
          padding="md"
          variant="muted"
          className="mb-4 border-l-2 border-l-exam-accent bg-exam-accent-50"
          data-testid="wrong-redo-bluff-banner"
        >
          <div className="font-serif text-md text-ink leading-relaxed">
            <b className="text-exam-accent">蒙对识破 · </b>
            耗时 {Math.round((seconds * 1000) / 1000)}s 超过均时 2 倍, AI 判定为蒙对.
            这次<b>不算</b>毕业.
          </div>
        </Card>
      ) : null}

      {/* 分栏 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-0 bg-surface border border-line">
        {/* 左栏 原题 */}
        <div className="px-7 py-7 lg:border-r lg:border-line">
          <div className="flex justify-between font-mono text-xs uppercase tracking-wider text-ink-3 mb-2">
            <span>
              {item.subject ?? '错题'} · #{item.questionId}
            </span>
            <span>第 {item.wrongCount + 1} 次重做</span>
          </div>
          <div
            className="font-serif text-md leading-relaxed text-ink mb-6"
            data-testid="wrong-redo-stem"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(item.stem),
            }}
          />

          <div className="flex flex-col gap-2 mb-4">
            {item.options.map((opt) => {
              const isSelected = selected.has(opt.key);
              const showCorrect = peeked && item.correctAnswerKeys.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleOption(opt.key)}
                  disabled={submitResult !== null}
                  className={cn(
                    'grid grid-cols-[32px_1fr] gap-3 items-center px-4 py-3 border font-serif text-sm text-left transition-colors duration-fast',
                    isSelected &&
                      'bg-exam-accent-50 border-exam-accent text-ink',
                    showCorrect && !isSelected &&
                      'bg-ok-bg border-ok text-ink',
                    !isSelected && !showCorrect &&
                      'bg-surface border-line text-ink-3 hover:bg-surface-alt',
                    submitResult !== null && 'cursor-default opacity-70',
                  )}
                  data-testid={`wrong-redo-option-${opt.key}`}
                  aria-label={`选择选项 ${opt.key}`}
                >
                  <span
                    className={cn(
                      'w-6 h-6 border flex items-center justify-center font-mono text-xs',
                      isSelected && 'bg-exam-accent text-white border-exam-accent',
                      showCorrect && !isSelected && 'bg-ok text-white border-ok',
                      !isSelected && !showCorrect && 'border-line text-ink-3',
                    )}
                  >
                    {opt.key}
                  </span>
                  <span
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(opt.text),
                    }}
                  />
                </button>
              );
            })}
          </div>

          {peeked ? (
            <div className="bg-surface-alt border border-dashed border-line-3 px-4 py-3 font-mono text-xs text-ink-3 tracking-loose mb-4">
              已偷看一次 · 这次不算毕业
            </div>
          ) : null}

          {/* CTA row */}
          <div className="flex gap-3 mt-6">
            <Tooltip label="返回错题列表" side="top">
              <IconBtn
                aria-label="返回错题列表"
                onClick={() => navigate('/wrong-book')}
                data-testid="wrong-redo-back"
              >
                <NavBackIcon size={18} />
              </IconBtn>
            </Tooltip>
            <Tooltip
              label={canPeek ? '偷看答案 (扣毕业机会)' : '已无偷看次数'}
              side="top"
            >
              <IconBtn
                aria-label="偷看答案"
                onClick={onPeek}
                disabled={!canPeek || peekMutation.isPending}
                data-testid="wrong-redo-peek"
              >
                <ToolEyeIcon size={18} />
              </IconBtn>
            </Tooltip>
            <span className="flex-1" />
            {submitResult !== null ? (
              <Button
                variant="primary"
                onClick={() => navigate('/wrong-book')}
                data-testid="wrong-redo-done"
              >
                <NavSubmitIcon size={18} />
                <span className="ml-2">完成</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                isLoading={submitMutation.isPending}
                disabled={selected.size === 0}
                onClick={onSubmit}
                data-testid="wrong-redo-submit"
              >
                {/* svg-only-allow: main-cta 主提交按钮允许 [svg + 文字] 双形态 */}
                <NavSubmitIcon size={18} />
                <span className="ml-2">
                  {submitMutation.isPending
                    ? '提交中…'
                    : `确认 ${Array.from(selected).join('') || '?'} · 提交`}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* 右栏 参考 / 解析 */}
        <div className="px-7 py-7 bg-surface-alt overflow-auto">
          <div className="font-mono text-xs uppercase tracking-wider text-ink-3 mb-3">
            参考 · 上次答题记录
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 font-serif text-sm">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-3">
              最近一次
            </span>
            <span className="text-ink">
              选{' '}
              <b className="text-err">
                {item.userLatestAnswerKeys.join('') || '-'}
              </b>{' '}
              · 错
            </span>
            <span className="font-mono text-xs uppercase tracking-wider text-ink-3">
              累计
            </span>
            <span className="text-ink">{item.wrongCount} 次</span>
            <span className="font-mono text-xs uppercase tracking-wider text-ink-3">
              连续答对
            </span>
            <span className="text-ink font-serif font-semibold">
              {item.consecutiveCorrectCount} / 3
            </span>
          </div>

          {submitResult !== null ? (
            <div className="mt-6 bg-surface border border-line-3 px-4 py-3 text-sm font-serif text-ink">
              <div className="font-mono text-xs uppercase tracking-wider mb-2">
                提交结果
              </div>
              <div>
                {submitResult.isCorrect ? '答对' : '答错'} · 蒙对检测:{' '}
                <b
                  className={
                    submitResult.bluffDetected ? 'text-exam-accent' : 'text-ok'
                  }
                >
                  {submitResult.bluffDetected ? '判蒙对' : '正常'}
                </b>
              </div>
              <div className="font-mono text-xs text-ink-3 mt-2 tracking-loose">
                连续答对 {submitResult.consecutiveCorrectCount}/3 · 累计蒙对{' '}
                {submitResult.bluffCount}
              </div>
            </div>
          ) : peeked && item.explanation !== '' ? (
            <div className="mt-6">
              <div className="font-mono text-xs uppercase tracking-wider text-ink-3 mb-2">
                解析 (已偷看)
              </div>
              <div
                className="font-serif text-sm leading-relaxed text-ink"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(item.explanation),
                }}
              />
            </div>
          ) : (
            <div className="mt-6 bg-surface border border-dashed border-line px-4 py-3 font-mono text-xs leading-relaxed text-ink-3 tracking-loose">
              提示已锁定 · 想看上次答案 / 解析, 点 <ToolEyeIcon size={12} className="inline" /> 偷看 (扣毕业机会).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
