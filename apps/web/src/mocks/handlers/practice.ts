import { http, HttpResponse } from 'msw';

import type { PracticePreferencesResponseV2, PracticeSessionCreateRequestV2, SessionLifecycleResponseV2 } from '@sikao/api-client/types/practice';
import {
  makeCatalogItems,
  makeCenterResponse,
  makeHistoryResponse,
  makePercentileResponse,
  makeStatsResponse,
  makeTimingResponse,
  makeTrendResponse,
} from './practiceCatalogFixtures';
import {
  createPreferencesPayload,
  makeAiQuestionsGenerateResponse,
  makeDailyHistoryResponse,
  makeDailyResponse,
  makeMockExamCreateResponse,
  makePreferencesWriteResponse,
  makeSessionEnvelope,
} from './practiceFlowFixtures';

const DEFAULT_RUNTIME_SESSION_ID = 6001;

let nextSessionId = DEFAULT_RUNTIME_SESSION_ID + 1;
let nextEssaySubmissionId = 9001;
let nextAiRequestId = 701;
const runtimeSessions = new Map<number, ReturnType<typeof makeSessionEnvelope>>();
const runtimeLifecycleStates = new Map<number, SessionLifecycleResponseV2>();
const runtimeEssaySubmissionSession = new Map<number, number>();
const runtimeEssayGradingStates = new Map<
  number,
  {
    status: 'submitted' | 'pending_grading' | 'graded' | 'failed';
    pollsRemaining: number;
    report: {
      totalScore: number;
      dimensions: Array<{ name: string; score: number; fullScore: number; comment: string }>;
      highlights: string[];
      issues: string[];
      overallComment: string;
      improvementSuggestions: string[];
      gradedAt: string;
      llmCallId: number;
    } | null;
    referenceAnswers: Array<{
      id: number;
      questionId: number;
      content: string;
      source: string;
      likesCount: number;
      favoritesCount: number;
      reportCount: number;
      qualityScore: number;
      status: string;
      publishedAt: string | null;
    }>;
    errorMessage: string | null;
  }
>();
let practicePreferencesState: PracticePreferencesResponseV2;

type RuntimeTransition = NonNullable<SessionLifecycleResponseV2['transitions']>[number];

export function resetPracticeMocks(): void {
  nextSessionId = DEFAULT_RUNTIME_SESSION_ID + 1;
  nextEssaySubmissionId = 9001;
  nextAiRequestId = 701;
  runtimeSessions.clear();
  runtimeLifecycleStates.clear();
  runtimeEssaySubmissionSession.clear();
  runtimeEssayGradingStates.clear();
  seedRuntimeSession(
    makeSessionEnvelope(DEFAULT_RUNTIME_SESSION_ID, {
      track: 'xingce',
      entryKind: 'paper',
      practiceMode: 'full_set',
      paperCode: 'XC-2024-01',
    }),
    {
      status: 'in_progress',
      transitions: [
        {
          fromStatus: 'draft',
          toStatus: 'in_progress',
          trigger: 'user_start',
          actor: 'user',
          ts: new Date().toISOString(),
          reason: null,
        },
      ],
    },
  );
  const essaySession = makeSessionEnvelope(DEFAULT_RUNTIME_SESSION_ID + 1, {
    track: 'essay',
    entryKind: 'paper',
    practiceMode: 'full_set',
    paperCode: 'SL-2024-01',
  });
  essaySession.status = 'submitted';
  seedRuntimeSession(essaySession, {
    status: 'submitted',
    forceSubmitted: false,
    transitions: [
      {
        fromStatus: 'draft',
        toStatus: 'in_progress',
        trigger: 'user_start',
        actor: 'user',
        ts: new Date().toISOString(),
        reason: null,
      },
      {
        fromStatus: 'in_progress',
        toStatus: 'submitted',
        trigger: 'user_submit',
        actor: 'user',
        ts: new Date().toISOString(),
        reason: null,
      },
    ],
  });
  const seededEssaySubmissionId = ensureEssaySubmission(essaySession);
  if (seededEssaySubmissionId !== null) {
    const grading = runtimeEssayGradingStates.get(seededEssaySubmissionId);
    if (grading) {
      grading.status = 'graded';
      grading.report = {
        totalScore: 82,
        dimensions: [
          { name: '结构', score: 22, fullScore: 25, comment: '结构完整。' },
          { name: '表达', score: 20, fullScore: 25, comment: '表达清晰。' },
        ],
        highlights: ['材料概括到位'],
        issues: ['结尾还可再收束'],
        overallComment: '整体完成度较高。',
        improvementSuggestions: ['补一段执行落地'],
        gradedAt: new Date().toISOString(),
        llmCallId: 88002,
      };
      runtimeEssayGradingStates.set(seededEssaySubmissionId, grading);
    }
  }
  nextSessionId = DEFAULT_RUNTIME_SESSION_ID + 2;
  practicePreferencesState = {
    isDefault: false,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    payload: createPreferencesPayload(),
  };
}

resetPracticeMocks();

function applyPatchPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

function schemaMismatchResponse() {
  return HttpResponse.json(
    { code: 'schema_version_mismatch', schemaVersion: 1, detail: 'schema version mismatch' },
    { status: 422 },
  );
}

function buildLifecycleState(
  session: ReturnType<typeof makeSessionEnvelope>,
  overrides: Partial<SessionLifecycleResponseV2> = {},
): SessionLifecycleResponseV2 {
  return {
    status: session.status,
    firstQuestionAt: session.startedAt,
    lastActivityAt: session.startedAt,
    pausedAt: null,
    pausedCount: 0,
    pausedTotalSeconds: 0,
    lastHeartbeatAt: session.startedAt,
    expiresAt: null,
    abandonedAt: null,
    abandonedReason: null,
    forceSubmitted: false,
    forceSubmittedReason: null,
    transitions: [],
    ...overrides,
  };
}

function seedRuntimeSession(
  session: ReturnType<typeof makeSessionEnvelope>,
  lifecycleOverrides: Partial<SessionLifecycleResponseV2> = {},
): void {
  if (lifecycleOverrides.status) {
    session.status = lifecycleOverrides.status;
  }
  runtimeSessions.set(session.id, session);
  runtimeLifecycleStates.set(session.id, buildLifecycleState(session, lifecycleOverrides));
}

function ensureEssaySubmission(session: ReturnType<typeof makeSessionEnvelope>): number | null {
  if (session.track !== 'essay') {
    return null;
  }
  if (typeof session.essaySubmissionId === 'number' && session.essaySubmissionId > 0) {
    return session.essaySubmissionId;
  }
  const submissionId = nextEssaySubmissionId++;
  session.essaySubmissionId = submissionId;
  runtimeEssaySubmissionSession.set(submissionId, session.id);
  runtimeEssayGradingStates.set(submissionId, {
    status: 'submitted',
    pollsRemaining: 0,
    report: null,
    referenceAnswers: [
      {
        id: submissionId + 1000,
        questionId: 1005,
        content: '参考答案示例：先概括问题，再提出三条对策，最后收束到执行闭环。',
        source: 'ai_generated',
        likesCount: 3,
        favoritesCount: 1,
        reportCount: 0,
        qualityScore: 0.92,
        status: 'public',
        publishedAt: new Date().toISOString(),
      },
    ],
    errorMessage: null,
  });
  runtimeSessions.set(session.id, session);
  return submissionId;
}

function appendTransition(
  sessionId: number,
  transition: RuntimeTransition,
  patch: Partial<SessionLifecycleResponseV2>,
): SessionLifecycleResponseV2 {
  const current = runtimeLifecycleStates.get(sessionId);
  if (!current) {
    throw new Error(`missing lifecycle state for session ${sessionId}`);
  }
  const nextState: SessionLifecycleResponseV2 = {
    ...current,
    ...patch,
    transitions: [...(current.transitions ?? []), transition],
  };
  runtimeLifecycleStates.set(sessionId, nextState);
  return nextState;
}

function buildActiveSessionsResponse() {
  const sessions = Array.from(runtimeSessions.values())
    .map((session) => {
      const lifecycle = runtimeLifecycleStates.get(session.id);
      return { lifecycle, session };
    })
    .filter(({ lifecycle }) => lifecycle && (lifecycle.status === 'draft' || lifecycle.status === 'in_progress' || lifecycle.status === 'paused'))
    .map((session) => ({
      id: session.session.id,
      type: session.session.track,
      examMode: session.session.examMode,
      practiceMode: session.session.practiceMode,
      progress: {
        answered: session.session.items.filter((item) => item.status === 'answered').length,
        total: session.session.items.length,
      },
      sourceMode: session.session.sourceMode,
      startedAt: session.session.startedAt,
      status: session.lifecycle!.status,
      category: null,
      paperCode: null,
      lastActivityAt: session.lifecycle!.lastActivityAt ?? null,
      pausedAt: session.lifecycle!.pausedAt ?? null,
    }))
    .sort((left, right) => right.id - left.id);

  return {
    count: sessions.length,
    sessions,
  };
}

export const practiceHandlers = [
  http.get('/api/v2/practice/center', () => HttpResponse.json(makeCenterResponse())),
  http.get('/api/v2/practice/stats', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') === 'essay' ? 'essay' : 'xingce';
    return HttpResponse.json(makeStatsResponse(type));
  }),
  http.get('/api/v2/practice/stats/trend', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') === 'essay' ? 'essay' : 'xingce';
    return HttpResponse.json(makeTrendResponse(type));
  }),
  http.get('/api/v2/practice/stats/percentile', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') === 'essay' ? 'essay' : 'xingce';
    return HttpResponse.json(makePercentileResponse(type));
  }),
  http.get('/api/v2/practice/stats/realtime', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') === 'essay' ? 'essay' : 'xingce';
    return HttpResponse.json(makeStatsResponse(type));
  }),
  http.get('/api/v2/practice/stats/timing', () => HttpResponse.json(makeTimingResponse())),
  http.get('/api/v2/practice/history', () => HttpResponse.json(makeHistoryResponse())),
  http.get('/api/v2/practice/daily', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') === 'essay' ? 'essay' : 'xingce';
    return HttpResponse.json(makeDailyResponse(type));
  }),
  http.get('/api/v2/practice/daily/history', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') === 'essay' ? 'essay' : 'xingce';
    return HttpResponse.json(makeDailyHistoryResponse(type));
  }),
  http.post('/api/v2/practice/daily/:dailyId/start', ({ params }) => {
    const track = String(params.dailyId).startsWith('2') ? 'essay' : 'xingce';
    const session = makeSessionEnvelope(nextSessionId++, { entryKind: 'daily', mode: 'daily', track });
    seedRuntimeSession(session);
    return HttpResponse.json(session);
  }),
  http.get('/api/v2/practice/sessions/active', () => HttpResponse.json(buildActiveSessionsResponse())),
  http.post('/api/v2/practice/sessions', async ({ request }) => {
    const payload = (await request.json()) as PracticeSessionCreateRequestV2;
    const session = makeSessionEnvelope(nextSessionId++, payload);
    seedRuntimeSession(session);
    return HttpResponse.json(session);
  }),
  http.get('/api/v2/practice/sessions/:sessionId', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const session = runtimeSessions.get(sessionId);
    if (!session) {
      return HttpResponse.json(
        { code: 'practice_session_not_found', detail: 'session not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json(session);
  }),
  http.post('/api/v2/practice/sessions/:sessionId/start', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const session = runtimeSessions.get(sessionId);
    if (!session) {
      return HttpResponse.json(
        { code: 'practice_session_not_found', detail: 'session not found' },
        { status: 404 },
      );
    }
    session.status = 'in_progress';
    runtimeSessions.set(sessionId, session);
    return HttpResponse.json(
      appendTransition(
        sessionId,
        {
          fromStatus: 'draft',
          toStatus: 'in_progress',
          trigger: 'user_start',
          actor: 'user',
          ts: new Date().toISOString(),
          reason: null,
        },
        {
          status: 'in_progress',
          firstQuestionAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          pausedAt: null,
        },
      ),
    );
  }),
  http.post('/api/v2/practice/sessions/:sessionId/heartbeat', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const lifecycle = runtimeLifecycleStates.get(sessionId);
    if (!lifecycle) {
      return HttpResponse.json(
        { code: 'practice_session_not_found', detail: 'session not found' },
        { status: 404 },
      );
    }
    const nextState = {
      ...lifecycle,
      lastHeartbeatAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
    runtimeLifecycleStates.set(sessionId, nextState);
    return HttpResponse.json({
      serverTs: new Date().toISOString(),
      status: nextState.status,
    });
  }),
  http.get('/api/v2/practice/sessions/:sessionId/lifecycle', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const lifecycle = runtimeLifecycleStates.get(sessionId);
    if (!lifecycle) {
      return HttpResponse.json(
        { code: 'practice_session_not_found', detail: 'session not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json(lifecycle);
  }),
  http.post('/api/v2/practice/sessions/:sessionId/pause', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const session = runtimeSessions.get(sessionId);
    const lifecycle = runtimeLifecycleStates.get(sessionId);
    if (!session || !lifecycle) {
      return HttpResponse.json(
        { code: 'practice_session_not_found', detail: 'session not found' },
        { status: 404 },
      );
    }
    session.status = 'paused';
    runtimeSessions.set(sessionId, session);
    return HttpResponse.json(
      appendTransition(
        sessionId,
        {
          fromStatus: lifecycle.status,
          toStatus: 'paused',
          trigger: 'user_pause',
          actor: 'user',
          ts: new Date().toISOString(),
          reason: 'manual_pause',
        },
        {
          status: 'paused',
          pausedAt: new Date().toISOString(),
          pausedCount: (lifecycle.pausedCount ?? 0) + 1,
          lastActivityAt: new Date().toISOString(),
        },
      ),
    );
  }),
  http.post('/api/v2/practice/sessions/:sessionId/resume', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const session = runtimeSessions.get(sessionId);
    const lifecycle = runtimeLifecycleStates.get(sessionId);
    if (!session || !lifecycle) {
      return HttpResponse.json(
        { code: 'practice_session_not_found', detail: 'session not found' },
        { status: 404 },
      );
    }
    session.status = 'in_progress';
    runtimeSessions.set(sessionId, session);
    return HttpResponse.json(
      appendTransition(
        sessionId,
        {
          fromStatus: lifecycle.status,
          toStatus: 'in_progress',
          trigger: 'user_resume',
          actor: 'user',
          ts: new Date().toISOString(),
          reason: null,
        },
        {
          status: 'in_progress',
          pausedAt: null,
          pausedTotalSeconds: (lifecycle.pausedTotalSeconds ?? 0) + 300,
          lastActivityAt: new Date().toISOString(),
        },
      ),
    );
  }),
  http.post('/api/v2/practice/sessions/:sessionId/discard', async ({ params, request }) => {
    const sessionId = Number(params.sessionId);
    const session = runtimeSessions.get(sessionId);
    const lifecycle = runtimeLifecycleStates.get(sessionId);
    if (!session || !lifecycle) {
      return HttpResponse.json(
        { code: 'practice_session_not_found', detail: 'session not found' },
        { status: 404 },
      );
    }
    const payload = (await request.json()) as { reason?: string } | null;
    session.status = 'abandoned';
    runtimeSessions.set(sessionId, session);
    return HttpResponse.json(
      appendTransition(
        sessionId,
        {
          fromStatus: lifecycle.status,
          toStatus: 'abandoned',
          trigger: 'user_discard',
          actor: 'user',
          ts: new Date().toISOString(),
          reason: payload?.reason ?? 'user_discard',
        },
        {
          status: 'abandoned',
          abandonedAt: new Date().toISOString(),
          abandonedReason: payload?.reason ?? 'user_discard',
          lastActivityAt: new Date().toISOString(),
        },
      ),
    );
  }),
  http.post('/api/v2/practice/sessions/:sessionId/answers', () =>
    HttpResponse.json({ ok: true }),
  ),
  http.post('/api/v2/practice/sessions/:sessionId/answers/:answerId/flag', ({ params }) => {
    const answerId = String(params.answerId);
    return HttpResponse.json({
      id: answerId,
      prompt: '示例题',
      questionKey: '1001',
      answerKind: 'single_choice',
      selectedAnswerKeys: [],
      answerText: null,
      status: 'pending',
      timeSpentMs: 0,
      answerChangeCount: 0,
      visitCount: 0,
      viewedSolution: false,
      flagged: true,
      isFavorited: false,
      hasPersistentFlag: false,
      hasUserNotes: false,
      isOvertime: false,
    });
  }),
  http.post('/api/v2/practice/sessions/:sessionId/submit', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const session = runtimeSessions.get(sessionId);
    const lifecycle = runtimeLifecycleStates.get(sessionId);
    if (!session || !lifecycle) {
      return HttpResponse.json(
        { code: 'practice_session_not_found', detail: 'session not found' },
        { status: 404 },
      );
    }
    session.status = 'submitted';
    ensureEssaySubmission(session);
    runtimeSessions.set(sessionId, session);
    appendTransition(
      sessionId,
      {
        fromStatus: lifecycle.status,
        toStatus: 'submitted',
        trigger: 'user_submit',
        actor: 'user',
        ts: new Date().toISOString(),
        reason: null,
      },
      {
        status: 'submitted',
        lastActivityAt: new Date().toISOString(),
      },
    );
    return HttpResponse.json({ ok: true });
  }),
  http.get('/api/v2/practice/sessions/:sessionId/result', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const session = runtimeSessions.get(sessionId);
    const lifecycle = runtimeLifecycleStates.get(sessionId);
    const isEssay = session?.track === 'essay';
    return HttpResponse.json({
      summary: [
        { key: 'track', label: 'Track', value: session?.track ?? 'xingce', tone: 'neutral' },
        { key: 'status', label: 'Status', value: lifecycle?.status ?? session?.status ?? 'submitted', tone: 'neutral' },
        { key: 'answered', label: 'Answered', value: String(session?.items.filter((item) => item.status === 'answered').length ?? 2), tone: 'ok' },
      ],
      sections: [
        {
          key: 'result',
          title: 'Runtime result',
          description: `Session #${sessionId} summary`,
          status: 'ready',
          href: `/practice/sessions/${sessionId}`,
        },
      ],
      actions: [
        isEssay
          ? { key: 'grading', label: 'Open grading', href: `/practice/sessions/${sessionId}/grading`, enabled: true }
          : { key: 'review', label: 'Open review', href: '/wrong-book', enabled: true },
      ],
    });
  }),
  http.post('/api/v2/practice/essay/submissions/:submissionId/grade', ({ params }) => {
    const submissionId = Number(params.submissionId);
    const grading = runtimeEssayGradingStates.get(submissionId);
    if (!grading) {
      return HttpResponse.json(
        { code: 'essay_submission_not_found', detail: 'essay submission not found' },
        { status: 404 },
      );
    }
    grading.status = 'pending_grading';
    grading.pollsRemaining = 1;
    grading.errorMessage = null;
    runtimeEssayGradingStates.set(submissionId, grading);
    return HttpResponse.json({
      submissionId,
      status: 'pending_grading',
      report: null,
      referenceAnswers: grading.referenceAnswers,
      errorMessage: null,
    });
  }),
  http.get('/api/v2/practice/essay/submissions/:submissionId/grading-status', ({ params }) => {
    const submissionId = Number(params.submissionId);
    const grading = runtimeEssayGradingStates.get(submissionId);
    if (!grading) {
      return HttpResponse.json(
        { code: 'essay_submission_not_found', detail: 'essay submission not found' },
        { status: 404 },
      );
    }
    if (grading.status === 'pending_grading' && grading.pollsRemaining > 0) {
      grading.pollsRemaining -= 1;
      if (grading.pollsRemaining === 0) {
        grading.status = 'graded';
        grading.report = {
          totalScore: 76,
          dimensions: [
            { name: '论点', score: 18, fullScore: 25, comment: '论点明确，但层次还能更紧。' },
            { name: '结构', score: 22, fullScore: 25, comment: '结构完整，首尾呼应较好。' },
            { name: '表达', score: 18, fullScore: 20, comment: '表达通顺，个别句式略重复。' },
          ],
          highlights: ['中心论点明确', '材料使用较充分'],
          issues: ['对策层缺少优先级拆分'],
          overallComment: '整体达到稳定成文水平，重点补足对策排序与论证抓手。',
          improvementSuggestions: ['补一段措施优先级判断', '结尾增加执行闭环'],
          gradedAt: new Date().toISOString(),
          llmCallId: 88001,
        };
      }
      runtimeEssayGradingStates.set(submissionId, grading);
    }
    return HttpResponse.json({
      submissionId,
      status: grading.status,
      report: grading.report,
      referenceAnswers: grading.referenceAnswers,
      errorMessage: grading.errorMessage,
    });
  }),
  http.get('/api/v2/practice/essay/submissions/:submissionId/result', ({ params }) => {
    const submissionId = Number(params.submissionId);
    const grading = runtimeEssayGradingStates.get(submissionId);
    if (!grading) {
      return HttpResponse.json(
        { code: 'essay_submission_not_found', detail: 'essay submission not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      submissionId,
      status: grading.status,
      report: grading.report,
      referenceAnswers: grading.referenceAnswers,
      errorMessage: grading.errorMessage,
    });
  }),
  http.get('/api/v2/practice/sessions/:sessionId/countdown', () =>
    HttpResponse.json({
      autoSubmitAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      elapsedSeconds: 30,
      remainingSeconds: 3570,
      serverNow: new Date().toISOString(),
      status: 'in_progress',
    }),
  ),
  http.get('/api/v2/practice/sessions/:sessionId/timing-report', () =>
    HttpResponse.json({
      totalActiveSeconds: 180,
      totalWallSeconds: 210,
      pausedTotalSeconds: 30,
      summary: { overtimeCount: 0 },
      questions: [],
    }),
  ),
  http.get('/api/v2/questions/:questionId', ({ params }) => {
    const questionId = Number(params.questionId);
    const isEssay = questionId % 5 === 0;
    return HttpResponse.json({
      id: questionId,
      questionId,
      questionKind: isEssay ? 'essay' : 'single_choice',
      stemText: isEssay ? '结合材料完成作答。' : '以下哪项最符合题意？',
      difficultyCode: 'medium',
      explanationText: '示例解析',
      selectionMode: isEssay ? 'text' : 'single',
      rendererKey: isEssay ? 'essay' : 'choice',
      options: isEssay
        ? []
        : [
            { id: 1, optionKey: 'A', optionText: '选项 A', displayOrder: 1 },
            { id: 2, optionKey: 'B', optionText: '选项 B', displayOrder: 2 },
            { id: 3, optionKey: 'C', optionText: '选项 C', displayOrder: 3 },
            { id: 4, optionKey: 'D', optionText: '选项 D', displayOrder: 4 },
          ],
      content: {
        stem: isEssay ? '结合材料完成作答。' : '以下哪项最符合题意？',
      },
    });
  }),
  http.post('/api/v2/practice/ai-questions/generate', async ({ request }) => {
    const payload = await request.json();
    const count = Number((payload as { config?: { count?: number } }).config?.count ?? 10);
    return HttpResponse.json(makeAiQuestionsGenerateResponse(count, nextAiRequestId++));
  }),
  http.get('/api/v2/practice/xingce/categories', () => HttpResponse.json(makeCatalogItems('xingce-category'))),
  http.get('/api/v2/practice/xingce/papers', () => HttpResponse.json(makeCatalogItems('xingce-paper'))),
  http.get('/api/v2/practice/essay/categories', () => HttpResponse.json(makeCatalogItems('essay-category'))),
  http.get('/api/v2/practice/essay/papers', () => HttpResponse.json(makeCatalogItems('essay-paper'))),
  http.get('/api/v2/profile/practice-preferences', () => HttpResponse.json(practicePreferencesState)),
  http.put('/api/v2/profile/practice-preferences', async ({ request }) => {
    const payload = (await request.json()) as { schemaVersion?: number; payload?: PracticePreferencesResponseV2['payload'] };
    if (payload.schemaVersion !== practicePreferencesState.schemaVersion) {
      return schemaMismatchResponse();
    }
    practicePreferencesState = {
      isDefault: false,
      schemaVersion: practicePreferencesState.schemaVersion,
      updatedAt: new Date().toISOString(),
      payload: payload.payload ?? practicePreferencesState.payload,
    };
    return HttpResponse.json(makePreferencesWriteResponse(practicePreferencesState.payload, practicePreferencesState.schemaVersion));
  }),
  http.patch('/api/v2/profile/practice-preferences', async ({ request }) => {
    const payload = (await request.json()) as { schemaVersion?: number; patches?: Array<{ path: string; value: unknown }> };
    if (payload.schemaVersion !== practicePreferencesState.schemaVersion) {
      return schemaMismatchResponse();
    }
    const nextPayload = structuredClone(practicePreferencesState.payload) as Record<string, unknown>;
    for (const patch of payload.patches ?? []) {
      applyPatchPath(nextPayload, patch.path, patch.value);
    }
    practicePreferencesState = {
      ...practicePreferencesState,
      updatedAt: new Date().toISOString(),
      payload: nextPayload as PracticePreferencesResponseV2['payload'],
    };
    return HttpResponse.json(makePreferencesWriteResponse(practicePreferencesState.payload, practicePreferencesState.schemaVersion));
  }),
  http.post('/api/v2/profile/practice-preferences/reset', async ({ request }) => {
    const payload = (await request.json()) as { sections?: string[] } | null;
    const defaults = createPreferencesPayload();
    const nextPayload = structuredClone(practicePreferencesState.payload) as Record<string, unknown>;
    const sections = payload?.sections ?? ['ui', 'pacing', 'auto_save', 'keyboard', 'reminders', 'custom_practice'];
    for (const section of sections) {
      const targetKey = section === 'auto_save' ? 'autoSave' : section === 'custom_practice' ? 'customPractice' : section;
      nextPayload[targetKey] = defaults[targetKey as keyof typeof defaults];
    }
    practicePreferencesState = {
      ...practicePreferencesState,
      updatedAt: new Date().toISOString(),
      payload: nextPayload as PracticePreferencesResponseV2['payload'],
    };
    return HttpResponse.json(makePreferencesWriteResponse(practicePreferencesState.payload, practicePreferencesState.schemaVersion));
  }),
  http.get('/api/v2/practice/mock-exams/history', () =>
    HttpResponse.json({
      aggregate: {
        totalCount: 2,
        bestAccuracy: 0.82,
        bestSessionId: 7302,
        avgAccuracy: 0.78,
        improvementTrend: 0.04,
      },
      sessions: [
        {
          sessionId: 7302,
          paperCode: 'XC-MOCK-HISTORY-001',
          completedAt: '2026-05-24T08:00:00Z',
          timeLimitMinutes: 120,
          actualActiveSeconds: 6700,
          accuracy: 0.82,
          totalScore: null,
          isForceSubmitted: false,
          rankInSelf: 1,
        },
        {
          sessionId: 7301,
          paperCode: 'XC-MOCK-HISTORY-001',
          completedAt: '2026-05-17T08:00:00Z',
          timeLimitMinutes: 120,
          actualActiveSeconds: 6900,
          accuracy: 0.74,
          totalScore: null,
          isForceSubmitted: true,
          rankInSelf: 2,
        },
      ],
    }),
  ),
  http.get('/api/v2/practice/mock-exams/:sessionId/comparison', ({ params }) =>
    HttpResponse.json({
      self: {
        sessionId: Number(params.sessionId),
        paperCode: 'XC-MOCK-HISTORY-001',
        completedAt: '2026-05-24T08:00:00Z',
        timeLimitMinutes: 120,
        actualActiveSeconds: 6700,
        accuracy: 0.82,
        totalScore: null,
        isForceSubmitted: false,
        rankInSelf: 1,
      },
      selfHistory: [
        {
          sessionId: 7301,
          paperCode: 'XC-MOCK-HISTORY-001',
          completedAt: '2026-05-17T08:00:00Z',
          timeLimitMinutes: 120,
          actualActiveSeconds: 6900,
          accuracy: 0.74,
          totalScore: null,
          isForceSubmitted: true,
          rankInSelf: 2,
        },
      ],
      paperBaseline: {},
    }),
  ),
  http.post('/api/v2/practice/mock-exams', async ({ request }) => {
    const payload = (await request.json()) as { paperCode: string; timeLimitMinutes?: number; delayedReviewMinutes?: number };
    const sessionId = nextSessionId++;
    const track = payload.paperCode.startsWith('ES') ? 'essay' : 'xingce';
    const session = makeSessionEnvelope(sessionId, {
      track,
      entryKind: 'mock_exam',
      mode: 'paper',
      practiceMode: 'full_set',
      paperCode: payload.paperCode,
    });
    session.examMode = true;
    session.status = 'draft';
    seedRuntimeSession(session, {
      status: 'draft',
      transitions: [],
      forceSubmitted: false,
    });
    return HttpResponse.json(
      makeMockExamCreateResponse(
        { paperCode: payload.paperCode, timeLimitMinutes: payload.timeLimitMinutes },
        sessionId,
      ),
      { status: 201 },
    );
  }),
];
