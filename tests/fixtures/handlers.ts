import { http, HttpResponse } from 'msw';

// Default API handlers for view tests.
// 走 axios baseURL `/api/v2` (见 utils/request.ts)。msw 拦截这些 path 给出
// fixture response, 让 view tests 不依赖真实后端。
//
// 单 case 想覆盖 (失败 / 不同 payload) 时, 在 test 内用 `server.use(...)`
// 临时 override 此 handler — afterEach 会 reset 回这里的 default.

export const handlers = [
  // —— Onboarding gate ——
  http.get('/api/v2/me/onboarding-status', () =>
    HttpResponse.json({
      hasGoal: true,
      hasExam: true,
      isOnboarded: true,
    }),
  ),

  // —— Analytics event ingest ——
  http.post('/api/v2/analytics/event', () =>
    HttpResponse.json({ received: true }, { status: 202 }),
  ),

  // —— Essay draft persistence ——
  // Default: no existing draft for the current user/question.
  // Callers should treat 404 as "first time, empty draft", not a hard error.
  http.get('/api/v2/essay/drafts/:questionId', () =>
    HttpResponse.json({ detail: 'draft not found' }, { status: 404 }),
  ),

  // —— Wrong-reason diagnosis ——
  http.patch(
    '/api/v2/practice/sessions/:sessionId/answers/:answerId/diagnosis',
    async ({ params, request }) => {
      const body = (await request.json()) as {
        wrongReasonCode: string;
        source?: string;
      };
      return HttpResponse.json({
        answerId: Number(params.answerId),
        wrongReasonCode: body.wrongReasonCode,
        wrongReasonSource: body.source ?? 'user',
      });
    },
  ),

  // —— Papers list (Home view) ——
  http.get('/api/v2/papers', () =>
    HttpResponse.json([
      {
        paperCode: 'TEST-001',
        paperName: '2026 国考行测',
        examYear: 2026,
        questionCount: 130,
        revisionId: 1,
        status: 'published',
        sortOrder: 1,
      },
    ]),
  ),

  // —— Paper revision summary (PracticeStart view) ——
  http.get('/api/v2/papers/:paperCode', ({ params }) =>
    HttpResponse.json({
      id: 1,
      revisionNumber: 1,
      sortOrder: 1,
      paperCode: params.paperCode,
      paperName: '2026 国考行测',
      examYear: 2026,
      sourceProvider: 'fenbi',
      sourceKind: 'memory',
      isGradable: true,
      usesPlaceholderAnswers: false,
      visibleInPublic: true,
      questionCount: 130,
      status: 'published',
      createdAt: '2026-04-01T00:00:00Z',
      publishedAt: '2026-04-01T00:00:00Z',
    }),
  ),

  // —— Auth login ——
  // Post-Phase D P1-1: csrf_token 不在 body, 仅 Set-Cookie. 测试组件代码
  // 走 document.cookie 读 csrf — vitest setup beforeEach 手 set
  // `document.cookie = 'csrf_token=mock-csrf'` 模拟登录后状态.
  // Identity v2 (commit #3d): /auth/login 改 payload {identifier, password}.
  // identifier 探测在后端 (含 @ → email; 11 位数字 → phone; 否则 username_legacy).
  // mock 把 identifier 当 username 返回, 让现有 view 的 user.username
  // 渲染断言 (`user?.username ?? fallback`) 走 happy path.
  http.post('/api/v2/auth/login', async ({ request }) => {
    const body = (await request.json()) as { identifier: string; password: string };
    if (body.identifier === 'baduser') {
      return HttpResponse.json({ detail: 'invalid_credentials' }, { status: 401 });
    }
    return HttpResponse.json(
      {
        tokenType: 'bearer',
        expiresIn: 3600,
        user: { id: 1, username: body.identifier, displayName: 'Test User' },
      },
      {
        headers: { 'Set-Cookie': 'csrf_token=mock-csrf; Path=/; SameSite=Strict' },
      },
    );
  }),

  // —— Exam events (考试日历, ARCH §7.3 P3) ——
  http.get('/api/v2/exam-events', () =>
    HttpResponse.json({
      items: [
        {
          id: 1,
          slug: 'national-2099',
          name: '2099 国考 (远未来 fixture)',
          category: 'national',
          examDate: '2099-12-06',
          precision: 'estimate',
        },
      ],
    }),
  ),

  // —— Auth recovery (Phase B.4) ——
  // Default: forgot 总返 200 + dev_magic_link (mimics dev gate open).
  // 单 case 想测 "prod silent" / "服务器错误" 用 server.use() override.
  http.post('/api/v2/auth/forgot-password', () =>
    HttpResponse.json({
      ok: true,
      _devMagicLink: 'http://localhost:18080/reset-password?token=mock-token-abc',
    }),
  ),
  http.post('/api/v2/auth/reset-password', () =>
    HttpResponse.json({ ok: true }),
  ),
  http.post('/api/v2/auth/verify-email/send', () =>
    HttpResponse.json({
      ok: true,
      _devMagicLink:
        'http://localhost:18080/verify-email?token=mock-verify-token-xyz',
    }),
  ),
  http.post('/api/v2/auth/verify-email/confirm', () =>
    HttpResponse.json({
      ok: true,
      user: { id: 1, username: 'alice', displayName: 'Alice' },
    }),
  ),

  // —— Auth register/email (Identity v2, commit #3c) ——
  // payload {email, password, displayName?}; displayName 不填 fallback
  // email.split('@')[0] 后端做. 200 返 cookie + csrf + user summary.
  http.post('/api/v2/auth/register/email', async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      password: string;
      displayName?: string;
    };
    if (body.password.length < 6) {
      return HttpResponse.json({ detail: 'weak_password' }, { status: 422 });
    }
    const fallbackName = body.email.split('@')[0];
    return HttpResponse.json(
      {
        tokenType: 'bearer',
        expiresIn: 3600,
        user: {
          id: 3,
          displayName: body.displayName ?? fallbackName,
          email: body.email,
          emailVerified: false,
        },
      },
      {
        headers: { 'Set-Cookie': 'csrf_token=mock-csrf; Path=/; SameSite=Strict' },
      },
    );
  }),

  // —— Auth sms/send-code (Identity v2, commit #3c) ——
  // dev gate `dev_expose_magic_code` 控制 prod 不暴露 _devMagicCode.
  http.post('/api/v2/auth/sms/send-code', () =>
    HttpResponse.json({ ok: true, _devMagicCode: '123456' }),
  ),

  // —— Auth register/phone (Identity v2, commit #3c) ——
  // payload {phone, smsCode, password, displayName?}; phone normalize 后端做.
  // displayName fallback `用户{phone[-4:]}` 后端做.
  http.post('/api/v2/auth/register/phone', async ({ request }) => {
    const body = (await request.json()) as {
      phone: string;
      smsCode: string;
      password: string;
      displayName?: string;
    };
    if (body.password.length < 6) {
      return HttpResponse.json({ detail: 'weak_password' }, { status: 422 });
    }
    const fallbackName = `用户${body.phone.slice(-4)}`;
    return HttpResponse.json(
      {
        tokenType: 'bearer',
        expiresIn: 3600,
        user: {
          id: 4,
          displayName: body.displayName ?? fallbackName,
          phone: body.phone,
          phoneVerified: true,
        },
      },
      {
        headers: { 'Set-Cookie': 'csrf_token=mock-csrf; Path=/; SameSite=Strict' },
      },
    );
  }),

  // —— Practice result ——
  http.get('/api/v2/practice/sessions/:id/result', ({ params }) =>
    HttpResponse.json({
      sessionId: Number(params.id),
      paperCode: 'TEST-001',
      paperName: '2026 国考行测',
      paperRevisionId: 1,
      mode: 'free',
      score: 85,
      totalQuestions: 100,
      correctCount: 85,
      wrongCount: 15,
      unansweredCount: 0,
      durationSeconds: 5400,
      submittedAt: '2026-04-28T12:00:00Z',
      sectionSummaries: [],
      questions: [],
      answers: [],
    }),
  ),

  // —— Wrong questions list ——
  http.get('/api/v2/practice/wrong-questions', () =>
    HttpResponse.json({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      availableSubjects: [],
      availableSubtypes: [],
    }),
  ),

  // —— SIKAO Wave 4 Phase 2D: 7 wrong-book / smart-review endpoint ——
  http.get('/api/v2/practice/wrong-questions/summary', () =>
    HttpResponse.json({
      inPractice: 0,
      todoCount: 0,
      dangerCount: 0,
      graduatedCount: 0,
      weeklyNew: 0,
    }),
  ),
  http.get('/api/v2/practice/wrong-questions/graduation-candidates', () =>
    HttpResponse.json([]),
  ),
  http.patch(
    '/api/v2/practice/wrong-questions/:questionId/mark-mastered',
    ({ params }) =>
      HttpResponse.json({
        questionId: Number(params.questionId),
        masteryLevel: 'mastered',
        consecutiveCorrectCount: 3,
      }),
  ),
  http.post('/api/v2/practice/wrong-questions/:questionId/peek', () =>
    HttpResponse.json({ peekedReference: true, peekRemaining: 0 }),
  ),
  http.post(
    '/api/v2/practice/wrong-questions/:questionId/submit-bluff',
    ({ params }) =>
      HttpResponse.json({
        questionId: Number(params.questionId),
        isCorrect: true,
        bluffDetected: false,
        masteryLevel: 'reviewing',
        consecutiveCorrectCount: 1,
        bluffCount: 0,
        attemptNo: 1,
      }),
  ),
  // —— SIKAO Wave 5: wrong-book heatmap (5 模块 × N 天) ——
  // Default: 30 天 × 5 行 全 0 cell, peakIdx=null, generatedAt=fixed.
  // Tests 用 server.use() override 各场景 (peak / today / loading / error).
  http.get('/api/v2/practice/wrong-questions/heatmap', ({ request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days') ?? 30);
    const subjects = ['言语', '数量', '判推', '资分', '常识'] as const;
    const baseDate = new Date('2026-05-12T00:00:00Z');
    const rows = subjects.map((subject) => ({
      subject,
      total: 0,
      peakIdx: null,
      cells: Array.from({ length: days }).map((_, idx) => {
        const d = new Date(baseDate);
        d.setUTCDate(baseDate.getUTCDate() - (days - 1 - idx));
        return {
          date: d.toISOString().slice(0, 10),
          count: 0,
          rate: null,
        };
      }),
    }));
    return HttpResponse.json({
      days,
      rows,
      generatedAt: '2026-05-12T00:00:00Z',
    });
  }),

  http.get('/api/v2/practice/smart-review/today', () =>
    HttpResponse.json({
      pushedToday: 0,
      finishedToday: 0,
      streakDays: 0,
      daysToExam: 47,
    }),
  ),
  http.get('/api/v2/practice/smart-review/next', () =>
    HttpResponse.json({
      questionId: 1,
      mode: 'qifei',
      stem: '示例下一题',
      knowledgePoint: null,
      consecutiveCorrectCount: 0,
      lastWrongTime: '2026-05-10T00:00:00Z',
    }),
  ),

  // —— Dashboard stats summary ——
  http.get('/api/v2/practice/stats/summary', () =>
    HttpResponse.json({
      totalAnswered: 100,
      overallAccuracy: 0.85,
      currentStreakDays: 5,
      masteredPointsCount: 20,
      totalWrongQuestions: 15,
    }),
  ),

  // —— Dashboard heatmap ——
  http.get('/api/v2/practice/stats/heatmap', () => HttpResponse.json([])),

  // —— Dashboard trend ——
  http.get('/api/v2/practice/stats/trend', () => HttpResponse.json([])),

  // —— Dashboard knowledge points ——
  http.get('/api/v2/practice/stats/knowledge-points', () => HttpResponse.json([])),

  // —— Practice history ——
  http.get('/api/v2/practice/history', () =>
    HttpResponse.json({ recentSessions: [], total: 0 }),
  ),

  // —— Categories (Home V1 学习中心 §4 + CategoryTree view) ——
  http.get('/api/v2/categories', () =>
    HttpResponse.json({
      categories: [
        { topType: 'verbal', name: '言语理解', total: 100, doneByUser: 30 },
        { topType: 'judgment', name: '判断推理', total: 80, doneByUser: 0 },
        { topType: 'data', name: '资料分析', total: 60, doneByUser: 12 },
      ],
    }),
  ),

  // —— Custom practice facets/start ——
  http.get('/api/v2/practice/custom/facets', () =>
    HttpResponse.json({
      totalQuestions: 1300,
      years: [2026, 2025, 2024],
      topTypes: [
        {
          name: '政治理论',
          questionCount: 985,
          years: [2026, 2025, 2024],
          subtypes: [],
        },
      ],
    }),
  ),
  http.post('/api/v2/practice/custom/start', () =>
    HttpResponse.json({
      sessionId: 901,
      paperCode: '__custom_practice__',
      paperRevisionId: null,
      paperName: '专项练习',
      sections: [],
      savedAnswers: {},
    }),
  ),

  // —— LLM usage (Slice 0b, Profile LlmUsageCard) ——
  http.get('/api/v2/llm/usage/me', () =>
    HttpResponse.json({
      totalTokens: 0,
      totalCostCents: 0,
      byFeature: {},
      recentDays: [],
    }),
  ),

  // —— LLM BYOM configs (Slice 0c, Profile LlmConfigsCard) ——
  // Default: 空 list. 单 case 想测有数据走 server.use() override.
  http.get('/api/v2/llm/configs', () => HttpResponse.json({ items: [] })),

  // —— Study plan today (Slice 3b → Wave 8 Phase D) ——
  // Default Dashboard Home block 2: 3 task (1 done + 2 pending) + Phase A 3 quota
  // 字段. 单 case 想测三态 banner / empty 走 server.use() override.
  // 注: 旧 Slice 3b 默认 (1 pending task, no quota) 在 Wave 8 Phase D 已切到下面
  // (Dashboard.test.tsx Wave 8 assertion: doneCount=1 / totalCount=3 / quota=50).
  http.get('/api/v2/study-plan/today', () =>
    HttpResponse.json({
      id: 101,
      planDate: '2026-05-12',
      generationStatus: 'success',
      createdAt: '2026-05-12T00:00:00Z',
      dailyQuota: 50,
      dailyAccuracyTarget: 0.8,
      subjectQuotas: { 言语: 20, 数量: 15, 判推: 15 },
      tasks: [
        {
          id: 1,
          taskKind: 'practice',
          status: 'completed',
          completedAt: '2026-05-12T09:00:00Z',
          createdAt: '2026-05-12T00:00:00Z',
          displayOrder: 1,
          payload: {
            title: '言语 · 片段阅读 10 题',
            paperCode: 'mock-paper-1',
            subtitle: null,
            questionIds: null,
          },
        },
        {
          id: 2,
          taskKind: 'practice',
          status: 'pending',
          completedAt: null,
          createdAt: '2026-05-12T00:00:00Z',
          displayOrder: 2,
          payload: {
            title: '数量 · 数学运算 8 题',
            paperCode: 'mock-paper-2',
            subtitle: null,
            questionIds: null,
          },
        },
        {
          id: 3,
          taskKind: 'review_wrong',
          status: 'pending',
          completedAt: null,
          createdAt: '2026-05-12T00:00:00Z',
          displayOrder: 3,
          payload: {
            title: '复盘 · 上周错题 5 题',
            subtitle: null,
            questionIds: [101, 102, 103, 104, 105],
          },
        },
      ],
    }),
  ),

  // Phase 5.2 + 5.5 fenbi-merge — /me/* defaults (空数据态).
  http.get('/api/v2/me/predicted-score', () =>
    HttpResponse.json({
      predictedScore: null,
      sampleSize: 0,
      isReferenceOnly: true,
      recentPapers: [],
    }),
  ),
  http.get('/api/v2/me/goals', () =>
    HttpResponse.json({ hasGoal: false, targetScore: null }),
  ),

  // —— SIKAO Wave 8 Phase D · Home 4-block real endpoints ——
  // Default: happy 态 (paper title / 计划 task / 2 exam / top 薄弱模块),
  // 字符级对齐 Dashboard.test.tsx 断言 (block 1/2/3/4 happy assertions).
  // 单 case 想测 empty / error 走 server.use() override.

  // Block 1: 继续学习 — paper "2024 国考行测", answered 22/135
  http.get('/api/v2/practice/last-session', () =>
    HttpResponse.json({
      id: 1,
      paperId: 1,
      paperTitle: '2024 国考行测',
      currentQuestionId: 23,
      answeredCount: 22,
      total: 135,
      startedAt: '2026-05-12T08:00:00Z',
    }),
  ),

  // Block 3: 临考冲刺 — 2 场考试 (省考 id=1, 国考 id=2)
  http.get('/api/v2/user-exams', () =>
    HttpResponse.json({
      exams: [
        {
          id: 1,
          name: '省考',
          examDate: '2026-06-28',
          examEventId: null,
          studyPlanId: 101,
          notes: '行测重点抓数量 + 判推',
          createdAt: '2026-05-12T00:00:00Z',
          daysUntil: 47,
        },
        {
          id: 2,
          name: '国考',
          examDate: '2026-08-22',
          examEventId: null,
          studyPlanId: null,
          notes: null,
          createdAt: '2026-05-12T00:00:00Z',
          daysUntil: 102,
        },
      ],
      total: 2,
    }),
  ),

  // Block 4: 薄弱模块 — top 数量 (score 78 → 急需) + 判推 (次薄弱)
  http.get('/api/v2/practice/wrong-questions/weakness', () =>
    HttpResponse.json({
      generatedAt: '2026-05-12T00:00:00Z',
      modules: [
        {
          subject: '数量',
          score: 78,
          wrongRate: 0.62,
          completionRate: 0.35,
          suggestedAction: '去练习',
        },
        {
          subject: '判推',
          score: 64,
          wrongRate: 0.48,
          completionRate: 0.55,
          suggestedAction: '继续复盘',
        },
      ],
    }),
  ),
];
