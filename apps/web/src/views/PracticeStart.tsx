import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, FileQuestion, RefreshCw } from 'lucide-react';
import { api } from '@sikao/api-client/request';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { ERROR_COPY } from '@/lib/ui-copy';
import type { PaperRevisionSummary, PracticeSessionStartV2 } from '@sikao/api-client/types/api';
import {
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  MetaPair,
  Skeleton,
  StatCallout,
} from '@sikao/ui/ui';

// Phase 5.3b rewrite — 从老 indigo 冷淡风格迁到 element ink editorial。
// 参考 element/preview/cards.html（editorial card） + badges.html（MetaPair）。
// 功能不变：拉套卷 revision summary → 启动 session → 跳答题页。
//
// 2026-04-28 P1 review fix Phase 3.1: 主函数从 151 行拆到 ≤50 行 (CLAUDE.md
// §4 / frontend/CLAUDE.md §3.5). 子分支提取到 LoadError / NotFound / Ready
// 三个 dumb sub-frame, JSX 完全保留, 仅是搬位置 — 不算"新加 UI 元素"
// (UI polish plan §1 表 "重构现有组件拆函数" 行).

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
      // 转译错误 + re-throw 符合 frontend/CLAUDE.md §3.1 fail-fast（silent catch 禁）。
      logger.error('practice.start.failed', { paperCode, err: String(err) });
      toast.error('无法开始练习', '请稍后重试，或检查网络');
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, [paperCode, initSession, navigate]);

  const onBackHome = useCallback(() => navigate('/app'), [navigate]);
  const onRetry = useCallback(() => { void refetch(); }, [refetch]);

  if (isLoading) return <PracticeStartSkeleton />;
  if (isError) return <PracticeStartLoadError onRetry={onRetry} onBack={onBackHome} />;
  if (paper === undefined) return <PracticeStartNotFound onBack={onBackHome} />;

  return (
    <PracticeStartReady
      paper={paper}
      isStarting={isStarting}
      onStart={handleStart}
      onBack={onBackHome}
    />
  );
}

function PageFrame({ children }: { readonly children: React.ReactNode }) {
  return <div className="p-4 md:p-8 max-w-3xl mx-auto">{children}</div>;
}

function PracticeStartSkeleton() {
  return (
    <PageFrame>
      <Skeleton className="mb-6" widthClass="w-64" heightClass="h-4" />
      <Card padding="lg">
        <Skeleton widthClass="w-24" heightClass="h-3" />
        <Skeleton className="mt-3" widthClass="w-72" heightClass="h-9" />
        <Skeleton className="mt-4" widthClass="w-full" heightClass="h-4" />
        <Skeleton className="mt-2" widthClass="w-3/4" heightClass="h-4" />
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton widthClass="w-full" heightClass="h-28" />
          <Skeleton widthClass="w-full" heightClass="h-28" />
        </div>
        <Skeleton className="mt-8 ml-auto" widthClass="w-40" heightClass="h-11" />
      </Card>
    </PageFrame>
  );
}

interface LoadErrorProps {
  readonly onRetry: () => void;
  readonly onBack: () => void;
}

function PracticeStartLoadError({ onRetry, onBack }: LoadErrorProps) {
  return (
    <PageFrame>
      <EmptyState
        tone="error"
        icon={<AlertCircle className="w-8 h-8" aria-hidden="true" />}
        title={ERROR_COPY.paperLoad.title}
        description={ERROR_COPY.paperLoad.description}
        action={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onRetry} data-testid="start-retry">
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              重试
            </Button>
            <Button variant="quiet" onClick={onBack} data-testid="start-back-home">
              返回题库
            </Button>
          </div>
        }
      />
    </PageFrame>
  );
}

function PracticeStartNotFound({ onBack }: { readonly onBack: () => void }) {
  return (
    <PageFrame>
      <EmptyState
        icon={<FileQuestion className="w-8 h-8" aria-hidden="true" />}
        title={ERROR_COPY.paperNotFound.title}
        description={ERROR_COPY.paperNotFound.description}
        action={
          <Button variant="secondary" onClick={onBack} data-testid="start-back-home">
            返回题库
          </Button>
        }
      />
    </PageFrame>
  );
}

interface ReadyProps {
  readonly paper: PaperRevisionSummary;
  readonly isStarting: boolean;
  readonly onStart: () => void;
  readonly onBack: () => void;
}

function PracticeStartReady({ paper, isStarting, onStart, onBack }: ReadyProps) {
  return (
    <PageFrame>
      <Breadcrumb
        className="mb-6"
        items={[
          { label: '题库', href: '/' },
          { label: paper.paperCode, href: `/` },
          { label: '开始练习' },
        ]}
      />
      <Card padding="lg">
        <span className="block text-tiny font-semibold tracking-[0.02em] text-ink-3">{/* hardcode-allow: eyebrow micro-adjust */}
          准备开始
        </span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">
          {paper.paperCode} <span className="text-ink-3">· </span>
          <span className="font-serif font-medium">练习</span>
        </h1>
        <p className="mt-3 text-sm text-ink-3 leading-relaxed">
          正式开始后，系统会创建会话并按套卷原顺序出题；中途可返回暂存，交卷后看完整解析。
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <MetaPair label="试卷">{paper.paperCode}</MetaPair>
          <MetaPair label="状态">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-pill bg-ok" />
              {paper.status}
            </span>
          </MetaPair>
          <MetaPair label="修订">{paper.revisionId}</MetaPair>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCallout
            label="总题数"
            value={paper.questionCount}
            description="按套卷原顺序出题，可随时返回修改。"
          />
          <StatCallout
            label="建议用时"
            value="—"
            description="未启用倒计时，自己把握节奏即可。"
          />
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button variant="quiet" onClick={onBack}>
            <span className="font-serif italic">←</span>
            <span>返回题库</span>
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={isStarting}
            onClick={onStart}
            data-testid="start-exam-btn"
          >
            {isStarting ? '创建会话中…' : '开始答题'}
          </Button>
        </div>
      </Card>
    </PageFrame>
  );
}
