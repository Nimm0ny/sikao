import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { clearTrackedExams } from '@sikao/domain/study-record/exam-tracking';
import ExamCalendar from '../ExamCalendar';

beforeEach(() => {
  // tracking 状态 isolated per test, 避免上 test 切到 tracked 污染下个.
  clearTrackedExams();
});

// ARCH §7.3 P3 (2026-04-28): 数据从前端 hardcoded 移到后端 admin 维护.
// 测试 mock /api/v2/exam-events 返回 fixture, 验:
//   - loading skeleton (data 未到时)
//   - 即将到来 section 渲染至少一个 card (slug 数据稳定 — 测试不靠日期)
//   - error 态 render 重试按钮 (/api 5xx 时)

// 测试用 fixture: 一个未来日期 (2099) 让 daysUntil 永远 > 0, 避免 test 随
// 系统日期失效 (review B-R "test 未来失效" 修).
const FAR_FUTURE_FIXTURE = {
  items: [
    {
      id: 1,
      slug: 'far-future-test',
      name: '测试考试 2099',
      category: 'national' as const,
      examDate: '2099-12-31',
      precision: 'estimate' as const,
      notes: '测试用永久未来 entry',
    },
  ],
};

describe('ExamCalendar view', () => {
  it('renders headline + at least one upcoming card from API fixture', async () => {
    server.use(
      http.get('/api/v2/exam-events', () => HttpResponse.json(FAR_FUTURE_FIXTURE)),
    );
    renderWithProviders(<ExamCalendar />, { initialEntries: ['/calendar'] });
    expect(screen.getByText('考试日历')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('exam-calendar-upcoming')).toBeInTheDocument();
    });
    const cards = screen.getAllByTestId(/^exam-countdown-/);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('shows error state with retry button on 5xx', async () => {
    server.use(
      http.get('/api/v2/exam-events', () => HttpResponse.json({ detail: 'oops' }, { status: 500 })),
    );
    renderWithProviders(<ExamCalendar />, { initialEntries: ['/calendar'] });
    await waitFor(() => {
      expect(screen.getByTestId('exam-calendar-retry')).toBeInTheDocument();
    });
  });

  it('empty (items=[]) → exam-calendar-empty 提示, 无 upcoming/past section', async () => {
    server.use(
      http.get('/api/v2/exam-events', () => HttpResponse.json({ items: [] })),
    );
    renderWithProviders(<ExamCalendar />, { initialEntries: ['/calendar'] });
    await waitFor(() => {
      expect(screen.getByTestId('exam-calendar-empty')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('exam-calendar-upcoming')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exam-calendar-past')).not.toBeInTheDocument();
  });

  it('点 exam-calendar-retry → 二次 fetch 成功 → upcoming 渲', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/v2/exam-events', () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({ detail: 'transient' }, { status: 503 });
        }
        return HttpResponse.json(FAR_FUTURE_FIXTURE);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ExamCalendar />, { initialEntries: ['/calendar'] });

    const retry = await screen.findByTestId('exam-calendar-retry');
    await user.click(retry);
    await waitFor(() => {
      expect(screen.getByTestId('exam-calendar-upcoming')).toBeInTheDocument();
    });
    expect(callCount).toBe(2);
  });

  // P0-2: tracking + facet
  it('点 exam-track button → 卡 data-tracked=true → tracked 段 split', async () => {
    server.use(
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({
          items: [
            { id: 1, slug: 'a', name: 'A', category: 'national', examDate: '2099-01-01', precision: 'confirmed' },
            { id: 2, slug: 'b', name: 'B', category: 'provincial', examDate: '2099-02-01', precision: 'confirmed' },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ExamCalendar />, { initialEntries: ['/calendar'] });
    const trackBtnA = await screen.findByTestId('exam-track-a');
    expect(screen.queryByTestId('exam-calendar-tracked')).toBeNull();
    await user.click(trackBtnA);
    await waitFor(() => {
      expect(screen.getByTestId('exam-calendar-tracked')).toBeInTheDocument();
    });
    const cardA = screen.getByTestId('exam-countdown-a');
    expect(cardA.getAttribute('data-tracked')).toBe('true');
    // others 段标题改为 "其他考试" (showSplit=true).
    expect(screen.getByTestId('exam-calendar-upcoming')).toHaveTextContent('其他考试');
  });

  it('类别 facet 切换 → 列表只显选中类别', async () => {
    server.use(
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({
          items: [
            { id: 1, slug: 'gw', name: '国考', category: 'national', examDate: '2099-01-01', precision: 'confirmed' },
            { id: 2, slug: 'sj', name: '省考', category: 'provincial', examDate: '2099-02-01', precision: 'confirmed' },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ExamCalendar />, { initialEntries: ['/calendar'] });
    await waitFor(() => {
      expect(screen.getByTestId('exam-countdown-gw')).toBeInTheDocument();
    });
    expect(screen.getByTestId('exam-countdown-sj')).toBeInTheDocument();
    await user.click(screen.getByTestId('exam-facet-national'));
    await waitFor(() => {
      expect(screen.queryByTestId('exam-countdown-sj')).toBeNull();
    });
    expect(screen.getByTestId('exam-countdown-gw')).toBeInTheDocument();
  });

  it('ICS button click → URL.createObjectURL 调用 + blob 含 BEGIN:VCALENDAR + escape 逗号', async () => {
    // notes 里加逗号让 buildIcsBlob 触 escape 分支 (规范官 P1-2).
    server.use(
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({
          items: [
            {
              id: 100,
              slug: 'ics-test',
              name: '测试名,带逗号',
              category: 'national' as const,
              examDate: '2099-06-15',
              precision: 'confirmed' as const,
              notes: '注意, 包含逗号 + 分号; 测试',
            },
          ],
        }),
      ),
    );

    // Capture blob content before URL.createObjectURL.
    let capturedText = '';
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob: Blob) => {
        // sync read blob — vitest jsdom Blob 支持 .text() async, 但 vi.spy 同步.
        // 走 Response wrapper 同步拿 text.
        void blob.text().then((t) => {
          capturedText = t;
        });
        return 'blob:mock-url';
      });
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);

    const user = userEvent.setup();
    renderWithProviders(<ExamCalendar />, { initialEntries: ['/calendar'] });
    const icsBtn = await screen.findByTestId('exam-ics-ics-test');
    await user.click(icsBtn);

    // createObjectURL 必调用 (download anchor 创建路径).
    expect(createSpy).toHaveBeenCalledTimes(1);
    // 等 blob.text() promise resolve (microtask).
    await waitFor(() => expect(capturedText.length).toBeGreaterThan(0));
    expect(capturedText).toContain('BEGIN:VCALENDAR');
    expect(capturedText).toContain('END:VCALENDAR');
    // RFC 5545 escape: 逗号 → \, ; 分号 → \;
    expect(capturedText).toContain('测试名\\,带逗号');
    expect(capturedText).toContain('注意\\, 包含逗号 + 分号\\; 测试');

    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  // P0-3: registration phase 主大数字改报名倒计时
  it('phase=registration-open → 主数字"报名剩 N 天"+ 副字考试还有 X 天', async () => {
    // 让 registration 在未来 (start 在过去/now, end 在未来) 触发 phase.
    const today = new Date();
    const startD = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const endD = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const examD = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    server.use(
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({
          items: [
            {
              id: 99, slug: 'reg', name: '报名期 fixture', category: 'national',
              examDate: fmt(examD), registrationStart: fmt(startD), registrationEnd: fmt(endD),
              precision: 'confirmed',
            },
          ],
        }),
      ),
    );
    renderWithProviders(<ExamCalendar />, { initialEntries: ['/calendar'] });
    await waitFor(() => {
      expect(screen.getByTestId('exam-reg-days-reg')).toBeInTheDocument();
    });
    // 主数字 = 14 天报名剩 (今 → 14 天后 endD).
    expect(screen.getByTestId('exam-reg-days-reg')).toHaveTextContent('14');
    // 副字含考试还有 + 60.
    expect(screen.getByTestId('exam-countdown-reg')).toHaveTextContent('考试还有');
    expect(screen.getByTestId('exam-countdown-reg')).toHaveTextContent('60');
  });
});
