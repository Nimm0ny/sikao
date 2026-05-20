import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileQuestion,
  Play,
  RefreshCw,
} from 'lucide-react';
import { api } from '@sikao/api-client/request';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { logger, toast } from '@sikao/shared-utils';
import { ERROR_COPY, PRACTICE_COPY } from '@/lib/ui-copy';
import type { PaperRevisionSummary, PracticeSessionStartV2 } from '@sikao/api-client/types/api';
import { MvpButton, MvpCard, MvpChip, MvpPage } from '@/components/mvp';

export default function PracticeStart() {
  const { paperCode } = useParams<{ paperCode: string }>();
  const navigate = useNavigate();
  const initSession = usePracticeStore(state => state.initSession);
  const [isStarting, setIsStarting] = useState(false);

  const { data: paper, isLoading, isError, refetch } = useQuery<PaperRevisionSummary>({
    queryKey: ['paperSummary', paperCode],
    queryFn: () => api.get<PaperRevisionSummary>(`/papers/${paperCode}`),
    enabled: Boolean(paperCode),
  });

  const handleStart = useCallback(async () => {
    if (paperCode === undefined) return;
    setIsStarting(true);
    try {
      const sessionData = await api.post<PracticeSessionStartV2>(
        `/practice/papers/${paperCode}/start`,
      );
      initSession(sessionData);
      navigate(`/practice/sessions/${sessionData.sessionId}`);
    } catch (err) {
      logger.error('practice.start.failed', { paperCode, err: String(err) });
      toast.error(PRACTICE_COPY.startFailedTitle, PRACTICE_COPY.startFailedDesc);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, [paperCode, initSession, navigate]);

  const onBack = useCallback(() => navigate('/practice/center'), [navigate]);
  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading) return <PracticeStartSkeleton />;
  if (isError) return <PracticeStartLoadError onRetry={onRetry} onBack={onBack} />;
  if (paper === undefined) return <PracticeStartNotFound onBack={onBack} />;

  return (
    <PracticeStartReady
      paper={paper}
      isStarting={isStarting}
      onStart={handleStart}
      onBack={onBack}
    />
  );
}

function PracticeStartSkeleton() {
  return (
    <MvpPage title="开始练习" hideHeading testId="practice-start-loading">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <MvpCard className="p-6">
          <div className="h-4 w-24 animate-pulse rounded-tiny bg-paper-3" />
          <div className="mt-5 h-12 w-2/3 animate-pulse rounded-tiny bg-paper-3" />
          <div className="mt-8 h-28 animate-pulse rounded-card bg-paper-2" />
        </MvpCard>
        <MvpCard className="p-6">
          <div className="h-4 w-20 animate-pulse rounded-tiny bg-paper-3" />
          <div className="mt-5 h-24 animate-pulse rounded-card bg-paper-2" />
        </MvpCard>
      </div>
    </MvpPage>
  );
}

interface LoadErrorProps {
  readonly onRetry: () => void;
  readonly onBack: () => void;
}

function PracticeStartLoadError({ onRetry, onBack }: LoadErrorProps) {
  return (
    <MvpPage title="试卷加载失败" hideHeading testId="practice-start-error">
      <MvpCard className="mx-auto max-w-xl p-6" testId="practice-start-error-card">
        <div className="flex items-start gap-4" role="alert" data-tone="error">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-err-50 text-err">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-h3 font-bold text-ink">{ERROR_COPY.paperLoad.title}</h2>
            <p className="mt-1 text-body text-ink-3">{ERROR_COPY.paperLoad.description}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <MvpButton
                variant="primary"
                icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                onClick={onRetry}
                data-testid="start-retry"
              >
                重试
              </MvpButton>
              <MvpButton variant="secondary" onClick={onBack} data-testid="start-back-home">
                返回练习
              </MvpButton>
            </div>
          </div>
        </div>
      </MvpCard>
    </MvpPage>
  );
}

function PracticeStartNotFound({ onBack }: { readonly onBack: () => void }) {
  return (
    <MvpPage title="试卷不存在" hideHeading testId="practice-start-empty">
      <MvpCard className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-accent-50 text-accent">
            <FileQuestion className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-h3 font-bold text-ink">{ERROR_COPY.paperNotFound.title}</h2>
            <p className="mt-1 text-body text-ink-3">{ERROR_COPY.paperNotFound.description}</p>
            <MvpButton variant="secondary" className="mt-5" onClick={onBack} data-testid="start-back-home">
              返回练习
            </MvpButton>
          </div>
        </div>
      </MvpCard>
    </MvpPage>
  );
}

interface ReadyProps {
  readonly paper: PaperRevisionSummary;
  readonly isStarting: boolean;
  readonly onStart: () => void;
  readonly onBack: () => void;
}

function PracticeStartReady({ paper, isStarting, onStart, onBack }: ReadyProps) {
  const paperTitle = pickPaperTitle(paper);
  return (
    <MvpPage title="开始练习" hideHeading testId="practice-start-view">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <MvpCard className="p-6 md:p-8" testId="practice-start-main">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <MvpChip tone="blue">{paper.paperCode}</MvpChip>
                <MvpChip tone={paper.status === 'published' ? 'green' : 'amber'}>{paper.status}</MvpChip>
              </div>
              <h1 className="mt-5 text-display font-bold tracking-normal text-ink">
                {paperTitle}
              </h1>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-tiny border border-line-2 bg-paper text-ink-3 hover:bg-accent-50 hover:text-accent"
              aria-label={PRACTICE_COPY.startBackToCenterAria}
              title={PRACTICE_COPY.startBackToCenterAria}
              data-testid="start-back-home"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric label="题目" value={paper.questionCount} />
            <Metric label="修订" value={paper.revisionId} />
            <Metric label="模式" value="套卷" />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MvpButton
              variant="primary"
              className="w-full sm:w-auto"
              icon={<Play className="h-4 w-4" aria-hidden="true" />}
              disabled={isStarting}
              onClick={onStart}
              data-testid="start-exam-btn"
            >
              {isStarting ? '创建中' : '开始答题'}
            </MvpButton>
            <MvpButton variant="secondary" className="w-full sm:w-auto" onClick={onBack}>
              返回练习
            </MvpButton>
          </div>
        </MvpCard>

        <MvpCard className="p-6" testId="practice-start-side">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-card bg-accent-50 text-accent">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-body font-bold text-ink">准备就绪</h2>
              <p className="text-small text-ink-3">答完后查看结果</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <SideRow label="试卷" value={paper.paperCode} />
            <SideRow label="题量" value={`${paper.questionCount}`} />
            <SideRow label="状态" value={paper.status} />
          </div>
        </MvpCard>
      </div>
    </MvpPage>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="rounded-card border border-line-2 bg-paper-2 p-4">
      <p className="text-tiny font-semibold text-ink-3">{label}</p>
      <p className="mt-2 text-h2 font-bold text-ink">{value}</p>
    </div>
  );
}

function SideRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line-2 pt-3 text-small">
      <span className="text-ink-3">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function pickPaperTitle(paper: PaperRevisionSummary): string {
  const maybeNamedPaper = paper as PaperRevisionSummary & { readonly paperName?: unknown };
  return typeof maybeNamedPaper.paperName === 'string' && maybeNamedPaper.paperName.length > 0
    ? maybeNamedPaper.paperName
    : paper.paperCode;
}
