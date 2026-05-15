/**
 * Slice 3b · 学习计划 task 行点击跳转 hook (plan §3.2 / §6.4).
 *
 * 跳转矩阵:
 * - essay_writing → /essay/exam/:paperCode (V2 整卷模考; 单题练习 v1 已下线)
 * - practice (questionIds 非空) → POST /study-plan/start → /practice/sessions/:sid
 * - practice (questionIds 缺/空) → /papers/:paperCode (defensive 整卷, LLM
 *   prompt 实际不会出但 API 层兼容)
 * - review_wrong → POST /study-plan/start (无 paperCode) → /practice/sessions/:sid
 *
 * cross_paper_material_unsupported 错码 → toast.error 友好文案, 不阻塞 user
 * 勾完成或跳其他 task.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import {
  isEssayWritingTask,
  isPracticeTask,
  isReviewWrongTask,
  type PracticeSessionStartV2 as StudyPlanPracticeSessionStartV2,
  type StudyTaskResponse,
} from '@sikao/api-client/types/study-plan';
import { useStartStudyPlanSession } from '@sikao/api-client/queries/studyPlanQueries';
import type { PracticeSessionStartV2 as StorePracticeSessionStartV2 } from '@sikao/api-client/types/api';

interface ApiErrorBody {
  readonly code?: string;
  readonly detail?: unknown; // FastAPI 422 detail 可能是 string 也可能是 list[obj]
}

// review P1-2: isAxiosError narrow 替代 `as` cast (frontend §3.2 strict)
// review P1-3: fallback 不直显 BE detail 给用户 (可能是 422 list / 太技术),
// 走 logger 上报, 用户看通用文案.
function classifyStartError(err: unknown): string {
  if (!isAxiosError<ApiErrorBody>(err)) {
    logger.error('study_plan.start.unknown_error', { err: String(err) });
    return '开始练习失败, 请稍后重试';
  }
  const code = err.response?.data?.code;
  if (code === 'cross_paper_material_unsupported') {
    return '此任务含资料分析 / 阅读题, 暂不支持跨卷复习, 请明日再试';
  }
  if (code === 'paper_code_mismatch') {
    return '任务参数异常, 请刷新计划';
  }
  if (code === 'question_not_found') {
    return '部分题目已不可用, 请刷新今日计划';
  }
  // BE detail 不直显 (类型不稳 + 可能太技术), 上报后给通用文案
  logger.error('study_plan.start.failed', {
    status: err.response?.status,
    code,
    detail: err.response?.data?.detail,
  });
  return '开始练习失败, 请稍后重试';
}

function hasSessionId(
  sessionData: StudyPlanPracticeSessionStartV2,
): sessionData is StudyPlanPracticeSessionStartV2 & StorePracticeSessionStartV2 {
  return sessionData.sessionId != null;
}

interface RoutingResult {
  readonly handleTaskClick: (task: StudyTaskResponse) => void;
  readonly startingTaskId: number | null;
}

export function useStudyPlanRouting(): RoutingResult {
  const navigate = useNavigate();
  const startMutation = useStartStudyPlanSession();
  const initSession = usePracticeStore((state) => state.initSession);

  const handleTaskClick = useCallback(
    (task: StudyTaskResponse) => {
      if (task.status === 'completed') return;
      // review P0-1: in-flight guard 防并发 click 多 task → variables 互覆盖
      if (startMutation.isPending) return;

      if (isEssayWritingTask(task)) {
        // 单题练习已下线 — 跳整卷考场, 由用户在 V2 ExamShell 内自行选当前要写的题.
        navigate(`/essay/exam/${task.payload.paperCode}`, {
          state: { studyTaskId: task.id },
        });
        return;
      }

      if (isPracticeTask(task)) {
        const qids = task.payload.questionIds;
        if (qids == null || qids.length === 0) {
          // defensive 整卷场景 (Slice 3a LLM prompt 实际不会出)
          navigate(`/papers/${task.payload.paperCode}`);
          return;
        }
        startMutation.mutate(
          { paperCode: task.payload.paperCode, questionIds: qids },
          {
            onSuccess: (sessionData) => {
              if (!hasSessionId(sessionData)) {
                throw new Error('study_plan.start missing sessionId');
              }
              initSession(sessionData, { studyTaskId: task.id });
              navigate(`/practice/sessions/${sessionData.sessionId}`);
            },
            onError: (err) => {
              toast.error(classifyStartError(err));
            },
          },
        );
        return;
      }

      if (isReviewWrongTask(task)) {
        startMutation.mutate(
          { questionIds: task.payload.questionIds },
          {
            onSuccess: (sessionData) => {
              if (!hasSessionId(sessionData)) {
                throw new Error('study_plan.start missing sessionId');
              }
              initSession(sessionData, { studyTaskId: task.id });
              navigate(`/practice/sessions/${sessionData.sessionId}`);
            },
            onError: (err) => {
              toast.error(classifyStartError(err));
            },
          },
        );
      }
    },
    [initSession, navigate, startMutation],
  );

  // review P0-1: 暴露 startingTaskId 而非 isStarting boolean, 让父组件能精确
  // 知道哪个 task row 在 loading. variables.questionIds[0] 不是 task.id, 但
  // mutation 不知道 task.id (我们没塞), 暂用 isPending 整体 boolean fallback —
  // 当前用户 UX 不区分多 task 并发 (in-flight guard 已防并发), 一个 boolean
  // 够用. follow-up: 若需精确区分, 把 task.id 塞进 mutation variables 透传.
  const startingTaskId = startMutation.isPending ? -1 : null;

  return { handleTaskClick, startingTaskId };
}
