/*
 * Records phase MSW handlers — SIK-93 Home M-Records (2026-05-24).
 * GET /api/v2/profile/records — paginated learning record list.
 */
import { http, HttpResponse } from 'msw';
import type { LearningRecordListResponseV2 } from '@sikao/api-client/types/home';

const SAMPLE_RECORDS = [
  {
    id: 'r1',
    kind: 'xingce_practice',
    title: '行测真题 · 2024 国考',
    occurredAt: '2026-05-24T08:00:00Z',
    score: '76.5',
    status: 'done',
    href: '/practice/sessions/6001/result',
  },
  {
    id: 'r2',
    kind: 'essay_submission',
    title: '申论真题 · 2024 联考',
    occurredAt: '2026-05-22T08:00:00Z',
    score: '82',
    status: 'done',
    href: '/practice/sessions/6002/grading',
  },
  {
    id: 'r3',
    kind: 'mock-exam',
    title: '行测全真模考 · 第 8 套',
    occurredAt: '2026-05-20T08:00:00Z',
    score: '78',
    status: 'done',
    href: '/practice/mock-exam/7302/comparison',
  },
  {
    id: 'r4',
    kind: 'weekly-review',
    title: '周复盘 · 2026-W21',
    occurredAt: '2026-05-19T08:00:00Z',
    score: null,
    status: 'done',
    href: '/review',
  },
];

export const recordsHandlers = [
  http.get('/api/v2/profile/records', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const size = Number(url.searchParams.get('size') ?? '20');
    const kind = url.searchParams.get('kind');
    const filtered = kind ? SAMPLE_RECORDS.filter((record) => record.kind === kind) : SAMPLE_RECORDS;
    const start = (page - 1) * size;
    const items = filtered.slice(start, start + size);
    const response: LearningRecordListResponseV2 = {
      items,
      page,
      pageSize: size,
      total: filtered.length,
    };
    return HttpResponse.json(response);
  }),
];
