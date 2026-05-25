/*
 * Progress phase MSW handlers — SIK-91 Home M-B (2026-05-24).
 *
 * Covers progressQueries endpoints needed for Home Section B + the
 * future /profile/learning drilldown:
 *   - GET /api/v2/dashboard/progress
 *   - GET /api/v2/dashboard/progress/timeseries
 *   - GET /api/v2/dashboard/progress/weakness
 *   - GET /api/v2/dashboard/progress/diagnosis
 *
 * Per docs/plan/frontend-tab-runtime-2026-05-24.md §7.3, each Tab phase
 * appends to the registry barrel.
 */
import { http, HttpResponse } from 'msw';
import type {
  DashboardProgressResponseV2,
  ProgressDiagnosisResponseV2,
  ProgressTimeseriesResponseV2,
  ProgressWeaknessResponseV2,
  WeaknessItemV2,
} from '@sikao/api-client/types/home';

const SAMPLE_WEAKNESS: WeaknessItemV2[] = [
  { subjectKey: 'shuliang', subjectLabel: '数量关系', accuracy: '0.42', answered: 120, correct: 50, severity: 'high', trend: 'down' },
  { subjectKey: 'panduan', subjectLabel: '判断推理', accuracy: '0.55', answered: 80, correct: 44, severity: 'medium', trend: 'flat' },
  { subjectKey: 'ziliao', subjectLabel: '资料分析', accuracy: '0.62', answered: 100, correct: 62, severity: 'medium', trend: 'up' },
];

const SAMPLE_OVERVIEW: DashboardProgressResponseV2 = {
  nearestExamTarget: null,
  subjectAccuracies: [
    { subjectKey: 'yanyu', subjectLabel: '言语理解', accuracy: '0.72', answered: 200, correct: 144 },
    { subjectKey: 'shuliang', subjectLabel: '数量关系', accuracy: '0.42', answered: 120, correct: 50 },
    { subjectKey: 'panduan', subjectLabel: '判断推理', accuracy: '0.55', answered: 80, correct: 44 },
  ],
  summary: {
    allTime: { accuracy: '0.62', itemsAnswered: 1248, minutesPracticed: 760, sessionsCount: 32 },
    today: { accuracy: '0.7', itemsAnswered: 25, minutesPracticed: 18, sessionsCount: 1 },
    week: { accuracy: '0.66', itemsAnswered: 128, minutesPracticed: 240, sessionsCount: 6 },
    planSlice: {
      eventsDone: 14, eventsInWindowTotal: 28, eventsSkipped: 2,
      minutesPracticedInWindow: 240, minutesTargetInWindow: 480,
      planId: 1, rangeFrom: null, rangeTo: null,
    },
  },
  weaknessTop3: SAMPLE_WEAKNESS,
};

const SAMPLE_TIMESERIES: ProgressTimeseriesResponseV2 = {
  from: '2026-05-18',
  to: '2026-05-24',
  granularity: 'day',
  points: Array.from({ length: 7 }, (_, i) => ({
    bucketStart: `2026-05-${String(18 + i).padStart(2, '0')}`,
    bucketEnd: `2026-05-${String(18 + i).padStart(2, '0')}`,
    accuracy: '0.65',
    itemsAnswered: 18 + i,
    minutesPracticed: 30 + i * 5,
    sessionsCount: 1,
  })),
};

const SAMPLE_DIAGNOSIS: ProgressDiagnosisResponseV2 = {
  generatedAt: '2026-05-24T08:00:00+08:00',
  strengths: ['言语理解：主旨题正确率稳定在 80% 以上'],
  weaknesses: ['数量关系：图形推理类型短板，正确率 42%'],
  suggestions: ['每天集中练习数量关系 30 分钟，连续 7 天后回测'],
};

const SAMPLE_WEAKNESS_RESPONSE: ProgressWeaknessResponseV2 = {
  items: SAMPLE_WEAKNESS,
};

export const progressHandlers = [
  http.get('/api/v2/dashboard/progress', () => HttpResponse.json(SAMPLE_OVERVIEW)),
  http.get('/api/v2/dashboard/progress/timeseries', () => HttpResponse.json(SAMPLE_TIMESERIES)),
  http.get('/api/v2/dashboard/progress/weakness', () => HttpResponse.json(SAMPLE_WEAKNESS_RESPONSE)),
  http.get('/api/v2/dashboard/progress/diagnosis', () => HttpResponse.json(SAMPLE_DIAGNOSIS)),
];
