import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircleIcon, RefreshIcon } from '@sikao/ui/icons';
import { Button, EmptyState } from '@sikao/ui/ui';
import { EssayShellSikao } from '@/components/essay/sikao';
import { essayClient } from '@sikao/api-client/essay-client';
import { trackEvent } from '@/lib/analytics';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { ERROR_COPY, ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { useApplyExamTheme } from '@/styles/useThemeStore';

interface EssayExamLocationState {
  readonly studyTaskId?: number;
}

// EssayExamSikao — SIKAO V3 申论考场 (双栏 + 草稿纸 + MmStrip) 的 /essay/exam/:paperCode
// route entry. 复用 EssayExam.tsx 的 query / hydrate / autosave / submit 全套
// pipeline (LLM grading 链路 + recordIds csv navigate 不变), 仅把底层 ExamShell
// 替换成 EssayShellSikao. 老 EssayExam.tsx 保留作 backup, 通过 router.tsx
// 切换 lazy import 切流量.

export default function EssayExamSikao() {
  // 申论考场属考场态, 应用 examTheme — 跟 ExamShell 路径完全一致.
  useApplyExamTheme();
  const { paperCode } = useParams<{ paperCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const hydrate = useExamSession((s) => s.hydrate);
  const startSubmitting = useExamSession((s) => s.startSubmitting);
  const finish = useExamSession((s) => s.finish);
  const toSnapshot = useExamSession((s) => s.toSnapshot);
  const locationState = location.state as EssayExamLocationState | null;
  const studyTaskId =
    typeof locationState?.studyTaskId === 'number'
      ? locationState.studyTaskId
      : null;

  const query = useQuery({
    queryKey: ['essay-exam-paper', paperCode],
    enabled: Boolean(paperCode),
    queryFn: async () => {
      if (!paperCode) {
        throw new Error('paper code missing');
      }
      const paper = await essayClient.getPaper(paperCode);
      const snapshot = await essayClient.loadSnapshot(paperCode, paper);
      return { paper, snapshot };
    },
  });

  // 防 refetch 重水化清空草稿 — 同 EssayExam.tsx pattern.
  const hydratedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    const data = query.data;
    if (!data) return;
    if (hydratedPaperIdRef.current === data.paper.id) return;
    hydratedPaperIdRef.current = data.paper.id;
    hydrate(data.paper, data.snapshot ?? undefined);
  }, [query.data, hydrate]);

  const handleAutosave = useMemo(
    () => () => {
      if (!paperCode) return;
      const snap = toSnapshot();
      if (!snap) return;
      const paper = query.data?.paper;
      if (!paper) return;
      void essayClient
        .saveSnapshot(paperCode, snap, paper)
        .catch((err: unknown) => logger.error('essay-exam.autosave-failed', { err: String(err) }));
    },
    [paperCode, query.data?.paper, toSnapshot],
  );

  const handleSubmit = useMemo(
    () => () => {
      if (!paperCode) return;
      const snap = toSnapshot();
      if (!snap) return;
      const paper = query.data?.paper;
      if (!paper) return;
      // 回 'running' 让用户重交.
      startSubmitting();
      void essayClient
        .submit(paperCode, snap, paper.questions)
        .then(async ({ recordIds }) => {
          trackEvent({
            eventName: 'essay_exam_submitted',
            sessionId: paperCode,
            properties: {
              paperCode,
              totalQuestions: String(paper.questions.length),
              submittedRecords: String(
                recordIds.filter((id) => id !== null).length,
              ),
              studyTaskId: studyTaskId === null ? 'none' : String(studyTaskId),
            },
          });
          const idsCsv = recordIds.map((id) => (id === null ? '' : id)).join(',');
          const search = new URLSearchParams({
            paperCode,
            ids: idsCsv,
            total: String(paper.questions.length),
          });
          if (studyTaskId !== null) {
            search.set('studyTaskId', String(studyTaskId));
          }
          finish();
          navigate(`/essay/exam/results?${search.toString()}`);
        })
        .catch((err: unknown) => {
          logger.error('essay-exam.submit-failed', { err: String(err) });
          useExamSession.setState({ phase: 'running' });
          toast.error(ESSAY_SIKAO_COPY.submitRetry);
        });
    },
    [finish, navigate, paperCode, query.data, startSubmitting, studyTaskId, toSnapshot],
  );

  if (query.isLoading) {
    return (
      <div
        className="h-screen flex items-center justify-center text-sm text-ink-3"
        data-testid="essay-exam-loading"
      >
        加载中…
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={ERROR_COPY.paperLoad.title}
          description={ERROR_COPY.paperLoad.description}
          action={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  void query.refetch();
                }}
                data-testid="essay-exam-retry"
              >
                <RefreshIcon className="w-4 h-4 mr-2" />
                重试
              </Button>
              <Button
                variant="quiet"
                onClick={() => navigate('/essay/papers')}
                data-testid="essay-exam-back-papers"
              >
                返回申论真题
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <EssayShellSikao mode="multi" onAutosave={handleAutosave} onSubmit={handleSubmit} />
    </div>
  );
}
