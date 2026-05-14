import React, { lazy, Suspense, useMemo, useEffect } from 'react';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { debounce } from 'lodash-es';
import { registerPendingAnswerUpdate } from './pendingAnswerUpdates';
import { isGraphicReasoning } from '@sikao/answer-engine/graphic-detect/isGraphicReasoning';

const SingleChoiceRenderer = lazy(() => import('./SingleChoiceRenderer'));
// v0.2 Phase 6.3b — fenbi type=2/3 → multiple_choice (见 fenbi_to_standard).
const MultipleChoiceRenderer = lazy(() => import('./MultipleChoiceRenderer'));
// Phase 6.5 — fenbi type=5 (填空 / 数字答案) → fill_blank.
const FillBlankRenderer = lazy(() => import('./FillBlankRenderer'));
// Slice 2a — 申论 essay (无 options + LLM 异步评分, 入库 rendererKey='essay').
const EssayRenderer = lazy(() => import('./EssayRenderer'));
// fenbi-merge Phase 6.5 — 图形推理 image-only 模式 (D6 决策跳过 SVG).
// BE renderer_key 全 single_choice (ETL 漏标), 前端 runtime 推断:
// isGraphicReasoning(question) 命中即走此 renderer.
const GraphicReasoningRenderer = lazy(() => import('./GraphicReasoningRenderer'));

interface Props {
  question: QuestionDetailV2;
}

const QuestionDispatcher: React.FC<Props> = ({ question }) => {
  const getAnswer = usePracticeStore(state => state.getAnswer);
  const updateAnswer = usePracticeStore(state => state.updateAnswer);

  // Backend questionId may be integer; coerce once so store keys, Set lookups
  // (AnswerCardGrid), and ref-map keys (PracticeSession) all agree on strings.
  // See 2026-04-23 regression run F3 postmortem.
  const qid = String(question.questionId);
  const currentAnswer = getAnswer(qid);

  // Debounced update to store
  const handleAnswerUpdate = useMemo(
    () =>
      debounce((val: string[]) => {
        updateAnswer(qid, val);
      }, 300),
    [qid, updateAnswer]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    const unregister = registerPendingAnswerUpdate(handleAnswerUpdate);
    return () => {
      handleAnswerUpdate.flush();
      handleAnswerUpdate.cancel();
      unregister();
    };
  }, [handleAnswerUpdate]);

  const RendererComponent = useMemo(() => {
    switch (question.rendererKey) {
      case 'multiple_choice':
        return MultipleChoiceRenderer;
      case 'fill_blank':
        return FillBlankRenderer;
      case 'essay':
        return EssayRenderer;
      case 'graphic_reasoning':
        return GraphicReasoningRenderer;
      case 'single_choice':
      default:
        // BE renderer_key 暂未标 graphic_reasoning (ETL 漏 + 推 follow-up),
        // 这里 runtime 推断 single_choice 题是否实为图推 (Phase 6.5 软方案).
        return isGraphicReasoning(question) ? GraphicReasoningRenderer : SingleChoiceRenderer;
    }
  }, [question]);

  return (
    <div className="question-dispatcher">
      <Suspense fallback={<div>Loading question...</div>}>
        <RendererComponent 
          question={question} 
          selectedAnswer={currentAnswer} 
          onAnswerChange={handleAnswerUpdate} 
        />
      </Suspense>
    </div>
  );
};

export default QuestionDispatcher;
