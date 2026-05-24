import { http, HttpResponse } from 'msw';

import type { PracticePreferencesResponseV2, PracticeSessionCreateRequestV2 } from '@sikao/api-client/types/practice';
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
let nextAiRequestId = 701;
const runtimeSessions = new Map<number, ReturnType<typeof makeSessionEnvelope>>();
let practicePreferencesState: PracticePreferencesResponseV2;

export function resetPracticeMocks(): void {
  nextSessionId = DEFAULT_RUNTIME_SESSION_ID + 1;
  nextAiRequestId = 701;
  runtimeSessions.clear();
  runtimeSessions.set(
    DEFAULT_RUNTIME_SESSION_ID,
    makeSessionEnvelope(DEFAULT_RUNTIME_SESSION_ID, {
      track: 'xingce',
      entryKind: 'paper',
      practiceMode: 'full_set',
      paperCode: 'XC-2024-01',
    }),
  );
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

function buildActiveSessionsResponse() {
  const sessions = Array.from(runtimeSessions.values())
    .filter((session) => session.status === 'draft' || session.status === 'in_progress' || session.status === 'paused')
    .map((session) => ({
      id: session.id,
      type: session.track,
      examMode: session.examMode,
      practiceMode: session.practiceMode,
      progress: {
        answered: session.items.filter((item) => item.status === 'answered').length,
        total: session.items.length,
      },
      sourceMode: session.sourceMode,
      startedAt: session.startedAt,
      status: session.status,
      category: null,
      paperCode: null,
      lastActivityAt: null,
      pausedAt: null,
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
    runtimeSessions.set(session.id, session);
    return HttpResponse.json(session);
  }),
  http.get('/api/v2/practice/sessions/active', () => HttpResponse.json(buildActiveSessionsResponse())),
  http.post('/api/v2/practice/sessions', async ({ request }) => {
    const payload = (await request.json()) as PracticeSessionCreateRequestV2;
    const session = makeSessionEnvelope(nextSessionId++, payload);
    runtimeSessions.set(session.id, session);
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
    if (session) {
      session.status = 'in_progress';
      runtimeSessions.set(sessionId, session);
    }
    return HttpResponse.json({
      status: 'in_progress',
      pausedCount: 0,
      pausedTotalSeconds: 0,
      forceSubmitted: false,
      firstQuestionAt: new Date().toISOString(),
      transitions: [],
    });
  }),
  http.post('/api/v2/practice/sessions/:sessionId/heartbeat', () =>
    HttpResponse.json({
      status: 'in_progress',
      pausedCount: 0,
      pausedTotalSeconds: 0,
      forceSubmitted: false,
      transitions: [],
    }),
  ),
  http.get('/api/v2/practice/sessions/:sessionId/lifecycle', ({ params }) => {
    const sessionId = Number(params.sessionId);
    const session = runtimeSessions.get(sessionId);
    return HttpResponse.json({
      status: session?.status ?? 'draft',
      pausedCount: 0,
      pausedTotalSeconds: 0,
      forceSubmitted: false,
      transitions: [],
    });
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
    if (session) {
      session.status = 'submitted';
      runtimeSessions.set(sessionId, session);
    }
    return HttpResponse.json({ ok: true });
  }),
  http.get('/api/v2/practice/sessions/:sessionId/result', ({ params }) => {
    const sessionId = Number(params.sessionId);
    return HttpResponse.json({
      summary: [
        { key: 'track', label: 'Track', value: 'xingce', tone: 'neutral' },
        { key: 'status', label: 'Status', value: 'submitted', tone: 'neutral' },
        { key: 'answered', label: 'Answered', value: '2', tone: 'ok' },
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
        { key: 'review', label: 'Open review', href: '/wrong-book', enabled: true },
      ],
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
  http.post('/api/v2/practice/mock-exams', async ({ request }) => {
    const payload = (await request.json()) as { paperCode: string; timeLimitMinutes?: number };
    return HttpResponse.json(makeMockExamCreateResponse(payload, nextSessionId++));
  }),
];
