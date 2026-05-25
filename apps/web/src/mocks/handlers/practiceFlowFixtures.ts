import type {
  ActiveSessionsResponseV2,
  AiQuestionsGenerateResponseV2,
  DailyPracticeResponseV2,
  MockExamCreateResponseV2,
  PracticePreferencesResponseV2,
  PracticePreferencesWriteResponseV2,
  PracticeSessionCreateRequestV2,
  PracticeSessionEnvelopeV2,
} from '@sikao/api-client/types/practice';
import { createPreferencesPayload, nowIso } from './practiceCatalogFixtures';

export { createPreferencesPayload };

export function makeSessionEnvelope(
  nextSessionId: number,
  payload?: Partial<PracticeSessionCreateRequestV2>,
): PracticeSessionEnvelopeV2 {
  const track = payload?.track ?? 'xingce';
  const essayItems =
    track === 'essay'
      ? [
          {
            answerChangeCount: 0,
            answerKind: 'essay',
            answerText: null,
            flagged: false,
            hasPersistentFlag: false,
            hasUserNotes: false,
            id: '1',
            isFavorited: false,
            isOvertime: false,
            prompt: 'Essay question 1',
            questionKey: '1005',
            selectedAnswerKeys: [],
            status: 'pending',
            timeSpentMs: 0,
            viewedSolution: false,
            visitCount: 0,
          },
        ]
      : [
          {
            answerChangeCount: 0,
            answerKind: 'single_choice',
            answerText: null,
            flagged: false,
            hasPersistentFlag: false,
            hasUserNotes: false,
            id: '1',
            isFavorited: false,
            isOvertime: false,
            prompt: 'Mock question 1',
            questionKey: '1001',
            selectedAnswerKeys: [],
            status: 'pending',
            timeSpentMs: 0,
            viewedSolution: false,
            visitCount: 0,
          },
          {
            answerChangeCount: 0,
            answerKind: 'single_choice',
            answerText: null,
            flagged: false,
            hasPersistentFlag: false,
            hasUserNotes: false,
            id: '2',
            isFavorited: false,
            isOvertime: false,
            prompt: 'Mock question 2',
            questionKey: '1002',
            selectedAnswerKeys: [],
            status: 'pending',
            timeSpentMs: 0,
            viewedSolution: false,
            visitCount: 0,
          },
        ];
  return {
    actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${nextSessionId}`, enabled: true }],
    id: nextSessionId,
    entryKind: payload?.entryKind ?? 'custom',
    essaySubmissionId: null,
    examMode: false,
    forceSubmitted: false,
    items: essayItems,
    pausedCount: 0,
    pausedTotalSeconds: 0,
    practiceMode: payload?.practiceMode ?? 'full_set',
    sourceMode: payload?.mode ?? payload?.entryKind ?? 'custom',
    startedAt: nowIso(),
    status: 'draft',
    totalActiveSeconds: 0,
    track,
    configSnapshot: payload?.config ?? {},
  };
}

export function makeDailyResponse(type: 'xingce' | 'essay'): DailyPracticeResponseV2 {
  return {
    id: type === 'essay' ? 2002 : 1001,
    date: '2026-05-24',
    type,
    status: 'pending',
    questionCount: type === 'essay' ? 3 : 10,
    completedAccuracy: null,
    completedSessionId: null,
  };
}

export function makeDailyHistoryResponse(type: 'xingce' | 'essay'): DailyPracticeResponseV2[] {
  return [
    {
      id: type === 'essay' ? 1901 : 901,
      date: '2026-05-23',
      type,
      status: 'completed',
      questionCount: type === 'essay' ? 3 : 10,
      completedAccuracy: type === 'essay' ? 0.7 : 0.8,
      completedSessionId: type === 'essay' ? 4901 : 3901,
    },
    {
      id: type === 'essay' ? 1900 : 900,
      date: '2026-05-22',
      type,
      status: 'completed',
      questionCount: type === 'essay' ? 3 : 10,
      completedAccuracy: type === 'essay' ? 0.65 : 0.75,
      completedSessionId: type === 'essay' ? 4900 : 3900,
    },
  ];
}

export function makeActiveSessionsResponse(): ActiveSessionsResponseV2 {
  return {
    count: 1,
    sessions: [
      {
        id: 4801,
        type: 'xingce',
        examMode: false,
        practiceMode: 'full_set',
        progress: { answered: 12, total: 20 },
        sourceMode: 'paper',
        startedAt: '2026-05-24T08:00:00Z',
        status: 'in_progress',
        category: 'verbal',
        paperCode: 'XC-2024-01',
        lastActivityAt: '2026-05-24T08:25:00Z',
        pausedAt: null,
      },
    ],
  };
}

export function makeAiQuestionsGenerateResponse(count: number, requestId: number): AiQuestionsGenerateResponseV2 {
  return {
    requestId,
    status: 'partial_pool',
    durationMs: 1200,
    poolCount: Math.max(1, Math.min(count, 6)),
    llmGeneratedCount: Math.max(0, count - 6),
    questionIds: Array.from({ length: count }, (_, index) => 9000 + index),
  };
}

export function makeMockExamCreateResponse(
  payload: { paperCode: string; timeLimitMinutes?: number },
  sessionId: number,
): MockExamCreateResponseV2 {
  return {
    paperCode: payload.paperCode,
    sessionId,
    status: 'draft',
    timeLimitMinutes: payload.timeLimitMinutes ?? 120,
    autoSubmitAt: nowIso(),
    expiresAt: nowIso(),
  };
}

export function makePreferencesWriteResponse(
  payload: PracticePreferencesResponseV2['payload'],
  schemaVersion: number,
): PracticePreferencesWriteResponseV2 {
  return {
    schemaVersion,
    updatedAt: nowIso(),
    payload,
  };
}
