import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpenCheck,
  Bot,
  ChevronRight,
  ClipboardList,
  NotebookPen,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { api } from '@sikao/api-client/request';
import { logger, toast } from '@sikao/shared-utils';
import type { PracticeSessionResultV2 } from '@sikao/api-client/types/api';
import { ChatPanel } from '@/components/llm/ChatPanel';
import {
  buildWrongItems,
  calcDurationSeconds,
  pickTitle,
} from '@/components/result/_resultHelpers';
import {
  WRONG_REASON_OPTIONS,
  type WrongReasonCode,
} from '@/components/result/wrongReason';
import { ERROR_COPY } from '@/lib/ui-copy';
import { MvpActionCard, MvpButton, MvpCard, MvpChip, MvpPage, MvpProgressRing } from '@/components/mvp';

interface UseResultActionsArgs {
  readonly sessionData: PracticeSessionResultV2 | undefined;
  readonly navigate: (to: string) => void;
}

function useResultActions({ sessionData, navigate }: UseResultActionsArgs) {
  const onBackHome = useCallback(() => navigate('/'), [navigate]);
  const paperCode = sessionData?.session?.paperCode ?? null;
  const onRetry = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/practice/${paperCode}/start`);
  }, [paperCode, navigate]);
  const onViewWrong = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/review?paperCode=${encodeURIComponent(paperCode)}`);
  }, [paperCode, navigate]);

  return {
    onBackHome,
    onRetry,
    onViewWrong,
    retryDisabled: paperCode === null,
    viewWrongDisabled: paperCode === null,
  } as const;
}

export default function Result() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const query = useQuery<PracticeSessionResultV2>({
    queryKey: ['practiceResult', sessionId],
    queryFn: () => api.get<PracticeSessionResultV2>(`/practice/sessions/${sessionId ?? ''}/result`),
    enabled: sessionId !== undefined,
  });
  const actions = useResultActions({ sessionData: query.data, navigate });

  if (query.isLoading) return <ResultSkeleton />;
  if (query.isError || query.data === undefined) {
    return (
      <ResultError
        onRetry={() => {
          void query.refetch();
        }}
        onBackHome={actions.onBackHome}
      />
    );
  }

  return (
    <ResultBody
      result={query.data}
      onBackHome={actions.onBackHome}
      onRetry={actions.onRetry}
      onViewWrong={actions.onViewWrong}
      retryDisabled={actions.retryDisabled}
      viewWrongDisabled={actions.viewWrongDisabled}
    />
  );
}

function ResultSkeleton() {
  return (
    <MvpPage title="练习结果" hideHeading testId="result-loading">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MvpCard className="p-6">
          <div className="h-4 w-28 animate-pulse rounded bg-[#E5EAF3]" />
          <div className="mt-5 h-20 w-40 animate-pulse rounded bg-[#E5EAF3]" />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="h-24 animate-pulse rounded-lg bg-[#F1F4F9]" />
            <div className="h-24 animate-pulse rounded-lg bg-[#F1F4F9]" />
            <div className="h-24 animate-pulse rounded-lg bg-[#F1F4F9]" />
          </div>
        </MvpCard>
        <MvpCard className="p-6">
          <div className="h-4 w-24 animate-pulse rounded bg-[#E5EAF3]" />
          <div className="mt-5 h-40 animate-pulse rounded-lg bg-[#F1F4F9]" />
        </MvpCard>
      </div>
    </MvpPage>
  );
}

function ResultError({
  onRetry,
  onBackHome,
}: {
  readonly onRetry: () => void;
  readonly onBackHome: () => void;
}) {
  return (
    <MvpPage title="结果加载失败" hideHeading testId="result-error-view">
      <MvpCard className="mx-auto max-w-xl p-6" testId="result-error-card">
        <div className="flex items-start gap-4" role="alert" data-tone="error">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#FEF2F2] text-[#DC2626]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-[#111827]">{ERROR_COPY.result.title}</h2>
            <p className="mt-1 text-sm text-[#4B5563]">{ERROR_COPY.result.description}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <MvpButton
                variant="primary"
                icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                onClick={onRetry}
                data-testid="result-retry"
              >
                重试
              </MvpButton>
              <MvpButton variant="secondary" onClick={onBackHome} data-testid="result-error-home">
                回首页
              </MvpButton>
            </div>
          </div>
        </div>
      </MvpCard>
    </MvpPage>
  );
}

interface ResultBodyProps {
  readonly result: PracticeSessionResultV2;
  readonly onBackHome: () => void;
  readonly onRetry: () => void;
  readonly onViewWrong: () => void;
  readonly retryDisabled: boolean;
  readonly viewWrongDisabled: boolean;
}

function ResultBody({
  result,
  onBackHome,
  onRetry,
  onViewWrong,
  retryDisabled,
  viewWrongDisabled,
}: ResultBodyProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);
  const [savingAnswerId, setSavingAnswerId] = useState<number | null>(null);
  const syncedWrongReasonIdsRef = useRef<Set<number>>(new Set());
  const resultSessionId = result.sessionId ?? result.session?.sessionId ?? null;
  const wrongItems = useMemo(() => buildWrongItems(result), [result]);
  const weakRows = useMemo(() => buildWeakRows(result), [result]);
  const title = pickTitle(result);
  const totalQuestionCount = result.totalQuestions || result.correctCount + result.incorrectCount + result.unansweredCount;
  const accuracy = totalQuestionCount > 0 ? Math.round((result.correctCount / totalQuestionCount) * 100) : 0;
  const durationSeconds =
    result.session !== undefined
      ? calcDurationSeconds(result.session.startedAt, result.session.completedAt)
      : undefined;

  const mergeWrongReasonIntoCache = useCallback(
    (answerId: number, wrongReasonCode: WrongReasonCode, source: 'ai' | 'user') => {
      if (resultSessionId === null) return;
      queryClient.setQueryData<PracticeSessionResultV2>(
        ['practiceResult', String(resultSessionId)],
        (previous) => {
          if (previous?.answers === undefined) return previous;
          return {
            ...previous,
            answers: previous.answers.map((answer) =>
              Number(answer.id) === answerId
                ? { ...answer, wrongReasonCode, wrongReasonSource: source }
                : answer,
            ),
          };
        },
      );
    },
    [queryClient, resultSessionId],
  );

  const saveWrongReason = useCallback(
    async (answerId: number, wrongReasonCode: WrongReasonCode, source: 'ai' | 'user') => {
      if (resultSessionId === null) return;
      await api.patch(`/practice/sessions/${resultSessionId}/answers/${answerId}/diagnosis`, {
        wrongReasonCode,
        source,
      });
      mergeWrongReasonIntoCache(answerId, wrongReasonCode, source);
    },
    [mergeWrongReasonIntoCache, resultSessionId],
  );

  useEffect(() => {
    wrongItems.forEach((item) => {
      if (
        item.answerId === undefined ||
        item.wrongReasonCode === undefined ||
        item.needsDiagnosisSync !== true ||
        syncedWrongReasonIdsRef.current.has(item.answerId)
      ) {
        return;
      }
      syncedWrongReasonIdsRef.current.add(item.answerId);
      void saveWrongReason(item.answerId, item.wrongReasonCode, 'ai').catch((err) => {
        logger.error('result.auto_wrong_reason_failed', {
          answerId: item.answerId,
          err: String(err),
        });
      });
    });
  }, [saveWrongReason, wrongItems]);

  const handleSetWrongReason = useCallback(
    (answerId: number, wrongReasonCode: WrongReasonCode): void => {
      setSavingAnswerId(answerId);
      void saveWrongReason(answerId, wrongReasonCode, 'user')
        .catch((err) => {
          logger.error('result.wrong_reason_save_failed', {
            answerId,
            err: String(err),
          });
          toast.error('错因保存失败', '请稍后重试');
        })
        .finally(() => {
          setSavingAnswerId((current) => (current === answerId ? null : current));
        });
    },
    [saveWrongReason],
  );

  return (
    <MvpPage title="练习结果" hideHeading testId="result-view">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MvpCard className="p-6 md:p-8" testId="result-score-card">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <MvpChip tone="blue">结果</MvpChip>
                {result.session?.paperCode ? <MvpChip>{result.session.paperCode}</MvpChip> : null}
              </div>
              <h1 className="mt-4 truncate text-2xl font-bold tracking-normal text-[#111827] md:text-3xl" title={title}>
                {title}
              </h1>
            </div>
            <MvpProgressRing value={accuracy} label="正确率" />
          </div>

          <div className="mt-8 flex items-end gap-3">
            <span className="text-6xl font-bold leading-none text-[#111827]" data-testid="result-score-value">
              {result.score}
            </span>
            <span className="pb-2 text-sm font-semibold text-[#4B5563]">分</span>
            {durationSeconds !== undefined ? (
              <MvpChip>{formatDuration(durationSeconds)}</MvpChip>
            ) : null}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <ResultMetric label="正确" value={result.correctCount} tone="green" />
            <ResultMetric label="错误" value={result.incorrectCount} tone="red" />
            <ResultMetric label="未答" value={result.unansweredCount} tone="amber" />
            <ResultMetric label="总题" value={totalQuestionCount} tone="blue" />
          </div>
        </MvpCard>

        <MvpCard className="p-6" testId="result-next-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">下一步</h2>
              <p className="text-sm text-[#4B5563]">{wrongItems.length > 0 ? `${wrongItems.length} 道待复盘` : '本次无错题'}</p>
            </div>
            <MvpButton variant="primary" onClick={onViewWrong} disabled={viewWrongDisabled} data-testid="result-view-wrong">
              错题本
            </MvpButton>
          </div>
          <div className="mt-5 grid gap-2">
            <CompactAction
              label="再做一次"
              icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
              disabled={retryDisabled}
              onClick={onRetry}
              testId="result-retry"
            />
            <CompactAction
              label="学习计划"
              icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
              onClick={() => navigate('/')}
              testId="result-go-plan"
            />
            <CompactAction
              label="回首页"
              icon={<BookOpenCheck className="h-4 w-4" aria-hidden="true" />}
              onClick={onBackHome}
              testId="result-back-home"
            />
          </div>
        </MvpCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MvpCard className="p-6" testId="result-wrong-card">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-[#111827]">复盘</h2>
            <MvpChip tone={wrongItems.length > 0 ? 'amber' : 'green'}>
              {wrongItems.length > 0 ? `${wrongItems.length} 错` : '清零'}
            </MvpChip>
          </div>
          <div className="mt-4 divide-y divide-[#E1E6F0]">
            {wrongItems.length === 0 ? (
              <div className="rounded-lg bg-[#F7F8FB] p-4 text-sm font-semibold text-[#4B5563]" data-testid="result-no-wrong">
                没有错题
              </div>
            ) : (
              wrongItems.slice(0, 5).map((item) => (
                <WrongRow
                  key={String(item.question.questionId)}
                  item={item}
                  onSetWrongReason={handleSetWrongReason}
                  savingAnswerId={savingAnswerId}
                />
              ))
            )}
          </div>
        </MvpCard>

        <MvpCard className="p-6" testId="result-weak-card">
          <h2 className="text-base font-bold text-[#111827]">薄弱项</h2>
          <div className="mt-4 space-y-3">
            {weakRows.length === 0 ? (
              <div className="rounded-lg bg-[#F7F8FB] p-4 text-sm font-semibold text-[#4B5563]">暂无分类数据</div>
            ) : (
              weakRows.map((row) => (
                <div key={`${row.label}-${row.accuracy}`} className="rounded-lg border border-[#E1E6F0] bg-[#F7F8FB] p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-[#111827]" title={row.label}>
                      {row.label}
                    </span>
                    <span className="shrink-0 font-bold text-[#2563EB]">{Math.round(row.accuracy)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5EAF3]">
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.max(0, Math.min(100, row.accuracy))}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </MvpCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MvpActionCard
          icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
          title="沉淀"
          description="保存本次复盘入口"
          actionLabel="去笔记"
          onAction={() => navigate('/notes')}
          testId="result-notes-action"
        />
        <MvpActionCard
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          title="计划"
          description="把薄弱项放入计划"
          actionLabel="调整计划"
          onAction={() => navigate('/')}
          testId="result-plan-action"
        />
        <MvpActionCard
          icon={<Bot className="h-5 w-5" aria-hidden="true" />}
          title="AI 问答"
          description="围绕本次结果提问"
          actionLabel="打开"
          onAction={() => setChatOpen(true)}
          testId="result-ai-action"
        />
      </div>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        contextKind="session_result"
        contextId={typeof resultSessionId === 'number' ? resultSessionId : Number(resultSessionId)}
      />
    </MvpPage>
  );
}

function ResultMetric({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly tone: 'green' | 'red' | 'amber' | 'blue';
}) {
  const color =
    tone === 'green'
      ? 'text-[#15803D]'
      : tone === 'red'
        ? 'text-[#DC2626]'
        : tone === 'amber'
          ? 'text-[#B45309]'
          : 'text-[#2563EB]';
  return (
    <div className="rounded-lg border border-[#E1E6F0] bg-[#F7F8FB] p-4">
      <p className="text-xs font-semibold text-[#4B5563]">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function CompactAction({
  label,
  icon,
  onClick,
  disabled = false,
  testId,
}: {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly testId: string;
}) {
  return (
    <button
      type="button"
      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[#E1E6F0] bg-white px-3 text-sm font-semibold text-[#111827] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-[#4B5563]" aria-hidden="true" />
    </button>
  );
}

function WrongRow({
  item,
  onSetWrongReason,
  savingAnswerId,
}: {
  readonly item: ReturnType<typeof buildWrongItems>[number];
  readonly onSetWrongReason: (answerId: number, code: WrongReasonCode) => void;
  readonly savingAnswerId: number | null;
}) {
  const answerId = item.answerId;
  const value = item.wrongReasonCode ?? 'other';
  return (
    <div className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_180px] md:items-center" data-testid={`wrong-review-${item.questionNo}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <MvpChip>第 {item.questionNo} 题</MvpChip>
          {item.categoryLabel ? <MvpChip tone="blue">{item.categoryLabel}</MvpChip> : null}
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-[#111827]" title={plainStem(item.question.content.stem)}>
          {plainStem(item.question.content.stem)}
        </p>
        <p className="mt-1 text-xs font-semibold text-[#4B5563]">
          选 {item.userKeys.join('') || '-'} / 对 {item.correctKeys.join('') || '-'}
        </p>
      </div>
      {answerId !== undefined ? (
        <select
          value={value}
          disabled={savingAnswerId === answerId}
          onChange={(event) => onSetWrongReason(answerId, event.target.value as WrongReasonCode)}
          className="min-h-10 rounded-lg border border-[#D7DFEC] bg-white px-3 text-sm font-semibold text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          aria-label={`第 ${item.questionNo} 题错因`}
          data-testid={`wrong-reason-select-${answerId}`}
        >
          {WRONG_REASON_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {reasonLabel(option.code)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function buildWeakRows(result: PracticeSessionResultV2): readonly { label: string; accuracy: number }[] {
  const source = result.subtypeSummaries?.length ? result.subtypeSummaries : result.subjectSummaries ?? [];
  return [...source]
    .map((item) => ({
      label: 'subtype' in item ? `${item.subject ?? '综合'} · ${item.subtype}` : item.subject ?? '综合',
      accuracy: item.accuracyRate,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} 分钟`;
}

function plainStem(stem: string): string {
  return stem.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function reasonLabel(code: WrongReasonCode): string {
  const labels: Record<WrongReasonCode, string> = {
    calculation_error: '计算错误',
    concept_gap: '概念不清',
    careless_mistake: '粗心失误',
    question_misread: '审题偏差',
    knowledge_missing: '知识点遗漏',
    logic_error: '逻辑判断错误',
    other: '其他',
  };
  return labels[code];
}
