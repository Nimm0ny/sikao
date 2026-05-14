import { describe, expect, it } from 'vitest';
import { pickContinueAction } from '../pickContinueAction';
import type { PaperSummaryV2, PracticeSessionSummaryV2 } from '@sikao/api-client/types/api';
import type { StudyPlanResponse, StudyTaskResponse } from '@sikao/api-client/types/study-plan';

// Pure unit tests for HomeContinueCard 数据派生 helper. 三级 fallback:
//   today plan pending task → recent unfinished session → 推荐第 1 卷 → empty
// 覆盖每级 hit + 跨级 fallback + 全空 4 路.

const PAPER: PaperSummaryV2 = {
  paperCode: 'TEST-001',
  paperName: '2026 国考行测',
  currentRevisionId: 1,
  questionCount: 130,
};

function makeTask(status: 'pending' | 'completed'): StudyTaskResponse {
  // narrow cast — 测试只关心 status + payload, 其他字段不触发分支.
  return {
    id: 1,
    taskKind: 'practice',
    status,
    payload: { title: '资料分析速算 30 题', subtitle: '20 分钟' },
  } as unknown as StudyTaskResponse;
}

function makePlan(tasks: readonly StudyTaskResponse[]): StudyPlanResponse {
  return {
    planDate: '2026-05-07',
    generationStatus: 'success',
    tasks,
  } as unknown as StudyPlanResponse;
}

function makeSession(completedAt: string | null): PracticeSessionSummaryV2 {
  return {
    sessionId: 42,
    mode: 'paper',
    paperCode: 'TEST-001',
    paperName: '2026 国考行测',
    startedAt: '2026-05-06T20:00:00Z',
    completedAt,
    totalQuestions: 130,
    answeredQuestions: 42,
    correctCount: 30,
    wrongCount: 12,
  } as unknown as PracticeSessionSummaryV2;
}

describe('pickContinueAction', () => {
  it('优先 today plan pending task', () => {
    const action = pickContinueAction({
      plan: makePlan([makeTask('completed'), makeTask('pending')]),
      history: { recentSessions: [makeSession(null)] } as never,
      papers: [PAPER],
    });
    expect(action.kind).toBe('task');
  });

  it('today plan 全 completed → 走未完 session', () => {
    const action = pickContinueAction({
      plan: makePlan([makeTask('completed'), makeTask('completed')]),
      history: { recentSessions: [makeSession(null)] } as never,
      papers: [PAPER],
    });
    expect(action.kind).toBe('session');
    if (action.kind === 'session') {
      expect(action.session.completedAt).toBeNull();
    }
  });

  it('plan undefined + history 无未完 → 走推荐第 1 卷', () => {
    const action = pickContinueAction({
      plan: undefined,
      history: { recentSessions: [makeSession('2026-05-06T22:00:00Z')] } as never,
      papers: [PAPER],
    });
    expect(action.kind).toBe('paper');
    if (action.kind === 'paper') {
      expect(action.paper.paperCode).toBe('TEST-001');
    }
  });

  it('全空 → empty', () => {
    const action = pickContinueAction({
      plan: undefined,
      history: undefined,
      papers: [],
    });
    expect(action.kind).toBe('empty');
  });
});
