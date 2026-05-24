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
  makeActiveSessionsResponse,
  makeAiQuestionsGenerateResponse,
  makeDailyHistoryResponse,
  makeDailyResponse,
  makeMockExamCreateResponse,
  makePreferencesWriteResponse,
  makeSessionEnvelope,
} from './practiceFlowFixtures';

let nextSessionId = 6001;
let nextAiRequestId = 701;
let practicePreferencesState: PracticePreferencesResponseV2 = {
  isDefault: false,
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  payload: createPreferencesPayload(),
};

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
    return HttpResponse.json(makeSessionEnvelope(nextSessionId++, { entryKind: 'daily', mode: 'daily', track }));
  }),
  http.get('/api/v2/practice/sessions/active', () => HttpResponse.json(makeActiveSessionsResponse())),
  http.post('/api/v2/practice/sessions', async ({ request }) => {
    const payload = (await request.json()) as PracticeSessionCreateRequestV2;
    return HttpResponse.json(makeSessionEnvelope(nextSessionId++, payload));
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
