// EssaySpecialtyExamSikao — Phase D /essay/specialty/:questionId 单题答题
// view (SIKAO V3 双栏版). 复用 EssaySpecialtyExam.tsx 整套 pipeline (单题
// wrap 成 1-question Paper / POST /essay/grade 单条 / navigate
// /essay/grades/:recordId), 仅把 ExamShell mode='single' 替换成
// EssayShellSikao mode='single-q'.
//
// 单题模式下 EssayShellSikao 不渲染 MmStrip (paper.questions.length=1 +
// paper.materials.length≤1 → showMmStrip=false), 视觉退化为纯 MaterialPanel
// + ScratchPad + EditorPanel 双栏.

import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, EmptyState } from '@sikao/ui/ui';
import { AlertCircleIcon, RefreshIcon } from '@sikao/ui/icons';
import { EssayShellSikao } from '@/components/essay/sikao';
import {
  type BackendEssayQuestion,
  mapBackendEssayPaper,
} from '@sikao/domain/shenlun/mapBackendPaper';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import type { Paper } from '@sikao/domain/shenlun/types';
import { api } from '@sikao/api-client/request';
import { ERROR_COPY } from '@/lib/ui-copy';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { useApplyExamTheme } from '@/styles/useThemeStore';

interface BackendQuestionDetail {
  readonly id: number;
  readonly position: number;
  readonly rendererKey: string;
  readonly canonicalSubtype?: string | null;
  readonly stemText: string;
  readonly explanationText: string;
  readonly paperCode: string;
  readonly paperName: string;
  readonly content?: BackendEssayQuestion['content'];
}

// 单题不限时 sentinel — 跟 EssaySpecialtyExam.tsx 一致, 24h.
const SINGLE_QUESTION_DURATION_SEC = 24 * 60 * 60;

export default function EssaySpecialtyExamSikao() {
  useApplyExamTheme();
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const hydrate = useExamSession((s) => s.hydrate);
  const startSubmitting = useExamSession((s) => s.startSubmitting);
  const finish = useExamSession((s) => s.finish);
  const toSnapshot = useExamSession((s) => s.toSnapshot);

  const query = useQuery<Paper>({
    queryKey: ['essay-specialty-question', questionId],
    enabled: Boolean(questionId),
    queryFn: async () => {
      if (!questionId) {
        throw new Error('question id missing');
      }
      const detail = await api.get<BackendQuestionDetail>(`/questions/${questionId}`);
      return wrapSingleQuestionPaper(detail);
    },
  });

  const hydratedQidRef = useRef<string | null>(null);
  useEffect(() => {
    const paper = query.data;
    if (!paper) return;
    if (hydratedQidRef.current === paper.id) return;
    hydratedQidRef.current = paper.id;
    hydrate(paper);
  }, [query.data, hydrate]);

  const handleAutosave = useMemo(
    () => () => {
      // 单题专项不持久 snapshot — 跟 EssaySpecialtyExam.tsx 一致.
    },
    [],
  );

  const handleSubmit = useMemo(
    () => () => {
      const snap = toSnapshot();
      const paper = query.data;
      if (!snap || !paper) return;
      const text = (snap.textsByQ[0] ?? '').trim();
      if (text.length === 0) {
        toast.error('请先写下答案再提交');
        return;
      }
      const backendId = paper.questions[0]?.backendId;
      if (backendId === undefined) {
        throw new Error('single-question paper missing backendId');
      }
      startSubmitting();
      void api
        .post<{ readonly id: number }, { readonly questionId: number; readonly answerText: string }>(
          '/essay/grade',
          { questionId: backendId, answerText: text },
        )
        .then((record) => {
          finish();
          navigate(`/essay/grades/${record.id}`);
        })
        .catch((err: unknown) => {
          logger.error('essay-specialty.submit-failed', { err: String(err) });
          useExamSession.setState({ phase: 'running' });
          toast.error('提交失败,请稍后再试');
        });
    },
    [toSnapshot, query.data, startSubmitting, finish, navigate],
  );

  if (query.isLoading) {
    return (
      <div
        className="h-screen flex items-center justify-center text-sm text-ink-3"
        data-testid="essay-specialty-exam-loading"
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
                data-testid="essay-specialty-exam-retry"
              >
                <RefreshIcon className="w-4 h-4 mr-2" />
                重试
              </Button>
              <Button
                variant="quiet"
                onClick={() => navigate('/essay/specialty')}
                data-testid="essay-specialty-exam-back"
              >
                返回专项练习
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-full" data-testid="essay-specialty-exam-shell">
      <EssayShellSikao mode="single-q" onAutosave={handleAutosave} onSubmit={handleSubmit} />
    </div>
  );
}

function wrapSingleQuestionPaper(detail: BackendQuestionDetail): Paper {
  const wrappedQuestion: BackendEssayQuestion = {
    id: detail.id,
    position: 1,
    rendererKey: detail.rendererKey,
    canonicalSubtype: detail.canonicalSubtype,
    stemText: detail.stemText,
    explanationText: detail.explanationText,
    content: {
      stem: detail.content?.stem,
      essayMetadata: {
        materialTexts: detail.content?.essayMetadata?.materialTexts,
        wordLimitMin: detail.content?.essayMetadata?.wordLimitMin,
        wordLimitMax: detail.content?.essayMetadata?.wordLimitMax,
        suggestedMinutes:
          detail.content?.essayMetadata?.suggestedMinutes ??
          SINGLE_QUESTION_DURATION_SEC / 60,
        fullScore: detail.content?.essayMetadata?.fullScore,
      },
    },
  };
  return mapBackendEssayPaper(detail.paperCode, [wrappedQuestion]);
}
