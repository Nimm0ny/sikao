//
//   - essay-res grid 1fr/320px 双段 layout
//   - 主区: <EssayResultHero> (整卷加权得分) + <QuestionBreakdown> (N 题汇总,
//           Q1...QN 一行一条 5 维 rubric + 总分 + retry slot) +
//           <EssayThinkBlock> (整卷小结) + 每题完整详情走原 ExamResultCard
//   - 右栏: <EssayResultAside> (总览 / 题号 status / CTA)
//
// URL: /essay/exam/results?paperCode=xxx&ids=1,2,3,4,5&total=5
//   ids   = 整卷交卷时 fulfilled 的 N 个 EssayGradingRecord ids (从
//           EssayClient.submit recordIds join). N ≤ total.
//   total = paper.questions.length (用户卷里的题数). 用来算 partial submit
//           头部红色提示 (total - ids.length 题未提交).
//   paperCode = 信息性, header 显示. 缺失也行.
//
// N 个并发 useQuery (复用 essayGradingKeys.detail / fetchEssayGrading), pending
// 时 1s 轮询, completed/failed 后停 (跟 EssayGradingResult 对齐). 头部展示
// fullScore 加权得分 (review P0 #8 — 不是 1/N) + 完成进度.
//
// failed 卡 retry: 走 submitEssayGrading mutation 创新 record, 拿 newId 替换
// ids URL 中对应位置 (navigate replace). 旧 record immutable 不动.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueries, useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircleIcon, NavBackIcon } from '@sikao/ui/icons';
import { Breadcrumb, Button, EmptyState, PageHeader } from '@sikao/ui/ui';
import {
  ExamResultCard,
  SkippedQuestionCard,
} from '@/components/essay/ExamResultCard';
import {
  EssayExamHeroPending,
  EssayExamSidebar,
  EssayResultHero,
  QuestionBreakdown,
  buildExamEyebrow,
  buildExamItem,
  buildExamLbl,
  buildExamSubtitle,
  pickResultHeadline,
  type QuestionBreakdownItem,
} from '@/components/result';
import { usePatchStudyTask } from '@sikao/api-client/queries/studyPlanQueries';
import {
  essayGradingKeys,
  fetchEssayGrading,
} from '@sikao/api-client/apiQueries';
import {
  computeWeightedTotal,
  type WeightedTotal,
} from '@sikao/answer-engine/scoring/shenlun';
import { ESSAY_GRADING_COPY } from '@/lib/ui-copy';
import { useApplyExamTheme } from '@/styles/useThemeStore';
import { api } from '@sikao/api-client/request';
import type { EssayGradingV2 } from '@sikao/api-client/types/api';
import { logger, toast } from '@sikao/shared-utils';

// 局部 type — 跟 backend PaperQuestionItemV2 子集对齐. 只声明本 view 用到的
// 字段 (frontend/CLAUDE.md §3.4 不一次性全量), 跟 EssayPaperDetail.tsx 同模式.
interface PaperQuestionListItem {
  readonly id: number;
  readonly content?: {
    readonly essayMetadata?: {
      readonly fullScore?: number;
    };
  };
}

const POLL_INTERVAL_MS = 1000;

export default function EssayExamResults() {
  // 申论成绩报告属考场态, 应用 examTheme — 跟 EssayGradingResult 一致.
  useApplyExamTheme();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const paperCode = params.get('paperCode') ?? undefined;
  const idsParam = params.get('ids') ?? '';
  const totalParam = params.get('total') ?? '';
  const studyTaskIdParam = params.get('studyTaskId');

  // recordIds 长度 = paper.questions.length, null slot 表示空答案/失败/未提交
  // (review P0 #9). csv 序列化 null → 空段 (e.g. "1,2,,4,5"). 解析时空段返
  // null, 数值段必须 > 0 否则也算无效 (返 null 而非过滤).
  const recordIds = useMemo<ReadonlyArray<number | null>>(() => {
    if (idsParam === '') return [];
    return idsParam.split(',').map((s) => {
      const trimmed = s.trim();
      if (trimmed === '') return null;
      const n = Number(trimmed);
      return Number.isFinite(n) && n > 0 ? n : null;
    });
  }, [idsParam]);

  const submittedCount = useMemo<number>(
    () => recordIds.filter((id) => id !== null).length,
    [recordIds],
  );

  // review P1 #4: total 不再 silent fallback. 缺失/非正整数 → 走链接无效占位
  // (跟 ids 全 null 一致), 防 partialMissing 计算用 submittedCount 假成立.
  const total = useMemo<number | null>(() => {
    if (totalParam === '') return null;
    const n = Number(totalParam);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [totalParam]);
  const studyTaskId = useMemo<number | null>(() => {
    if (studyTaskIdParam == null || studyTaskIdParam === '') return null;
    const n = Number(studyTaskIdParam);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [studyTaskIdParam]);

  const onBackHistory = useCallback(() => navigate('/essay/history'), [navigate]);

  // 链接缺 ids / total / 全 null → 占位 (不静默把空当 0 题).
  if (recordIds.length === 0 || submittedCount === 0 || total === null) {
    return (
      <PageFrame>
        <PageHeader
          eyebrow={ESSAY_GRADING_COPY.examResultsEyebrow}
          title={ESSAY_GRADING_COPY.examResultsTitle}
        />
        <div className="mt-6">
          <EmptyState
            icon={<AlertCircleIcon className="w-8 h-8" />}
            title={ESSAY_GRADING_COPY.examResultsInvalidLink}
            description={ESSAY_GRADING_COPY.examResultsInvalidLinkDesc}
            action={
              <Button
                variant="quiet"
                onClick={onBackHistory}
                data-testid="essay-exam-results-back-empty"
              >
                <NavBackIcon className="w-4 h-4 mr-1" />
                {ESSAY_GRADING_COPY.examResultsBack}
              </Button>
            }
          />
        </div>
      </PageFrame>
    );
  }

  return (
    <ResultsContent
      recordIds={recordIds}
      submittedCount={submittedCount}
      total={total}
      paperCode={paperCode}
      studyTaskId={studyTaskId}
      onBackHistory={onBackHistory}
    />
  );
}

interface ResultsContentProps {
  readonly recordIds: ReadonlyArray<number | null>;
  readonly submittedCount: number;
  readonly total: number;
  readonly paperCode: string | undefined;
  readonly studyTaskId: number | null;
  readonly onBackHistory: () => void;
}

function ResultsContent({
  recordIds,
  submittedCount,
  total,
  paperCode,
  studyTaskId,
  onBackHistory,
}: ResultsContentProps) {
  // navigate 用于 retry 替换 ids URL.
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const patchStudyTask = usePatchStudyTask();
  const taskCompletionSyncRef = useRef<'idle' | 'syncing' | 'done' | 'failed'>(
    'idle',
  );

  // N 个并发 useQuery — 长度严格 = recordIds.length, null slot 用 enabled:false
  // 跳过 fetch 但保留位置 (review P0 #9 — list idx 直接对齐 paper.questions 顺序).
  const queries = useQueries({
    queries: recordIds.map((id, idx) => ({
      // null slot 的 queryKey 必须 stable 且互不撞 (react-query 否则 dedup):
      queryKey:
        id === null
          ? (['essay-empty-slot', idx] as const)
          : essayGradingKeys.detail(id),
      queryFn:
        id === null
          ? () => Promise.reject(new Error('null slot — should never run'))
          : () => fetchEssayGrading(id),
      enabled: id !== null,
      // pending 时 1s 轮询, status != pending 时停. 跟 EssayGradingResult 对齐.
      refetchInterval: (q: Query<EssayGradingV2>) =>
        q.state.data?.status === 'pending' ? POLL_INTERVAL_MS : false,
      refetchOnWindowFocus: false,
    })),
  });

  // R2 P0 fallback active polling (post-73aa81a fix): useQueries refetchInterval
  // 在 R3 verify 看到不可靠 fire (60s 内仅 2 次 GET) — 这里用 useEffect setInterval
  // 作为兜底主动轮询. 双轨 polling, 哪个先 fire 都行.
  const queriesRef = useRef(queries);
  const recordIdsRef = useRef(recordIds);
  useEffect(() => {
    queriesRef.current = queries;
    recordIdsRef.current = recordIds;
  });
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const currentQueries = queriesRef.current;
      const currentIds = recordIdsRef.current;
      const hasPending = currentQueries.some(
        (q) =>
          q.data?.status === 'pending' || (q.data === undefined && !q.isFetching),
      );
      if (!hasPending) return;
      currentIds.forEach((id) => {
        if (id === null) return;
        queryClient.invalidateQueries({ queryKey: essayGradingKeys.detail(id) });
      });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [queryClient]);

  // 拉 paper.questions.fullScore 用于加权计算. 如果没 paperCode (老 URL / 链接
  // 漂洗) 就跳过, weighted 退化成 null + "无法计算" 占位.
  const paperQuery = useQuery<readonly PaperQuestionListItem[]>({
    queryKey: ['essay-paper-questions', paperCode],
    enabled: paperCode !== undefined && paperCode !== '',
    queryFn: () =>
      api.get<readonly PaperQuestionListItem[]>(`/papers/${paperCode}/questions`),
    refetchOnWindowFocus: false,
  });

  // 用 questionId → fullScore 字典快速查 (按 record.questionId 关联)
  const fullScoreByQuestionId = useMemo<ReadonlyMap<number, number>>(() => {
    const map = new Map<number, number>();
    paperQuery.data?.forEach((q) => {
      const fs = q.content?.essayMetadata?.fullScore;
      if (typeof fs === 'number' && fs > 0) map.set(q.id, fs);
    });
    return map;
  }, [paperQuery.data]);

  const weighted = useMemo(() => {
    return computeWeightedTotal(
      queries.map((q) => ({
        backendId: q.data?.questionId ?? -1,
        fullScore: q.data ? fullScoreByQuestionId.get(q.data.questionId) : undefined,
        score: q.data?.status === 'completed' ? (q.data.score ?? null) : null,
      })),
    );
  }, [queries, fullScoreByQuestionId]);

  const allSubmittedCompleted = useMemo(() => {
    const submittedQueries = queries.filter((q) => q.data !== undefined);
    if (submittedQueries.length !== submittedCount) return false;
    return submittedQueries.every((q) => q.data?.status === 'completed');
  }, [queries, submittedCount]);

  useEffect(() => {
    if (
      studyTaskId === null ||
      taskCompletionSyncRef.current !== 'idle' ||
      !allSubmittedCompleted
    ) {
      return;
    }
    taskCompletionSyncRef.current = 'syncing';
    void patchStudyTask
      .mutateAsync({ id: studyTaskId, status: 'completed' })
      .then(() => {
        taskCompletionSyncRef.current = 'done';
      })
      .catch((err) => {
        logger.error('essay_exam_results.task_complete_failed', {
          studyTaskId,
          err: String(err),
        });
        toast.warn(ESSAY_GRADING_COPY.examResultsTaskSyncWarn);
        taskCompletionSyncRef.current = 'failed';
      });
  }, [allSubmittedCompleted, patchStudyTask, studyTaskId]);

  const handleRetrySwap = useCallback(
    (idx: number, newId: number) => {
      const next: Array<number | null> = [...recordIds];
      next[idx] = newId;
      const search = new URLSearchParams();
      if (paperCode !== undefined && paperCode !== '') {
        search.set('paperCode', paperCode);
      }
      if (studyTaskId !== null) {
        search.set('studyTaskId', String(studyTaskId));
      }
      search.set(
        'ids',
        next.map((x) => (x === null ? '' : String(x))).join(','),
      );
      search.set('total', String(total));
      navigate(`/essay/exam/results?${search.toString()}`, {
        replace: true,
      });
    },
    [recordIds, paperCode, studyTaskId, total, navigate],
  );

  const partialMissing = total > submittedCount;

  return (
    <PageFrame>
      <Breadcrumb
        items={[
          { label: ESSAY_GRADING_COPY.historyTitle, href: '/essay/history' },
          { label: paperCode ?? `${recordIds.length} 题成绩单` },
        ]}
      />
      <PageHeader
        className="mt-4"
        eyebrow={ESSAY_GRADING_COPY.examResultsEyebrow}
        title={ESSAY_GRADING_COPY.examResultsTitle}
        actions={
          <Button
            variant="quiet"
            size="sm"
            onClick={onBackHistory}
            data-testid="essay-exam-results-back"
          >
            <NavBackIcon className="w-4 h-4 mr-1" />
            {ESSAY_GRADING_COPY.examResultsBack}
          </Button>
        }
      />

      <div
        className="mt-6 grid"
        style={{
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          columnGap: '48px',
        }}
      >
        <div>
          <ExamHeroBlock
            weighted={weighted}
            submittedCount={submittedCount}
            total={total}
            paperCode={paperCode}
          />

          {partialMissing ? (
            <div
              role="alert"
              className="mb-6 flex items-center gap-2 px-3 py-2 border border-warn text-warn text-sm font-mono bg-warn-bg"
              style={{ letterSpacing: 'var(--tracking-loose)' }}
              data-testid="essay-exam-results-missing-hint"
            >
              <AlertCircleIcon className="w-4 h-4 shrink-0" />
              <span>
                {ESSAY_GRADING_COPY.examResultsMissingHint(submittedCount, total)}
              </span>
            </div>
          ) : null}

          <ExamBreakdownTable
            recordIds={recordIds}
            queries={queries}
            fullScoreByQuestionId={fullScoreByQuestionId}
          />

          <ul
            className="mt-10 flex flex-col gap-6"
            data-testid="essay-exam-results-list"
          >
            {queries.map((q, idx) => {
              const id = recordIds[idx];
              return (
                <li
                  key={`slot-${idx}`}
                  data-testid={
                    id === null
                      ? `essay-exam-results-skipped-${idx}`
                      : `essay-exam-results-item-${id}`
                  }
                >
                  {id === null ? (
                    <SkippedQuestionCard positionIndex={idx} />
                  ) : (
                    <ExamResultCard
                      recordId={id}
                      positionIndex={idx}
                      queryState={q}
                      onRetrySwap={(newId) => handleRetrySwap(idx, newId)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <EssayExamSidebar
          weighted={weighted}
          submittedCount={submittedCount}
          total={total}
          recordIds={recordIds}
          queries={queries}
          fullScoreByQuestionId={fullScoreByQuestionId}
        />
      </div>
    </PageFrame>
  );
}

interface ExamHeroBlockProps {
  readonly weighted: WeightedTotal;
  readonly submittedCount: number;
  readonly total: number;
  readonly paperCode: string | undefined;
}

function ExamHeroBlock({
  weighted,
  submittedCount,
  total,
  paperCode,
}: ExamHeroBlockProps) {
  const score = weighted.value ?? 0;
  const eyebrow = buildExamEyebrow(paperCode);
  const lbl = buildExamLbl(weighted.scored, submittedCount);
  const headline =
    weighted.value === null
      ? '正在汇总成绩'
      : pickResultHeadline(weighted.value);
  const subtitle =
    weighted.value === null
      ? ESSAY_GRADING_COPY.examResultsCannotCompute
      : buildExamSubtitle(weighted, submittedCount, total);

  if (weighted.value === null) {
    // 仍渲染 hero 框, 但分数处显示 "—" 而非 0.0 (避免误导).
    // 用 testid weighted-pending 兼容现有测试.
    return (
      <EssayExamHeroPending
        eyebrow={eyebrow}
        lbl={lbl}
        headline={headline}
        subtitle={subtitle}
      />
    );
  }

  return (
    <>
      <EssayResultHero
        score={score}
        maxScore={100}
        eyebrow={eyebrow}
        lbl={lbl}
        headline={headline}
        subtitle={subtitle}
      />
      {/* 隐藏 testid sentinel 兼容老测试 (essay-exam-results-weighted-total /
          essay-exam-results-progress). 不渲染额外文案, 只暴露 testid 让现有
          assertion 继续通过. */}
      <span
        data-testid="essay-exam-results-weighted-total"
        className="sr-only"
      >
        {score.toFixed(1)}
      </span>
      <span
        data-testid="essay-exam-results-progress"
        className="sr-only"
      >
        {ESSAY_GRADING_COPY.examResultsProgressFmt(weighted.scored, submittedCount)}
      </span>
    </>
  );
}

interface ExamBreakdownTableProps {
  readonly recordIds: ReadonlyArray<number | null>;
  readonly queries: readonly { readonly data: EssayGradingV2 | undefined }[];
  readonly fullScoreByQuestionId: ReadonlyMap<number, number>;
}

function ExamBreakdownTable({
  recordIds,
  queries,
  fullScoreByQuestionId,
}: ExamBreakdownTableProps) {
  const items = useMemo<readonly QuestionBreakdownItem[]>(() => {
    return recordIds
      .map((id, idx) => buildExamItem(id, idx, queries[idx]?.data, fullScoreByQuestionId))
      .filter((item): item is QuestionBreakdownItem => item !== null);
  }, [recordIds, queries, fullScoreByQuestionId]);

  if (items.length === 0) return null;

  return (
    <>
      <h3
        className="font-serif"
        style={{
          fontSize: '22px',
          fontWeight: 500,
          margin: '0 0 16px',
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--ink-1)',
        }}
      >
        {items.length} 题 · 评分细项
      </h3>
      <QuestionBreakdown
        items={items}
        testIdPrefix="essay-exam-qbreak"
      />
    </>
  );
}

function PageFrame({ children }: { readonly children: React.ReactNode }) {
  return <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>;
}
