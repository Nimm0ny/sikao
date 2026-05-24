import type {
  CatalogListResponseV2,
  PracticeCenterResponseV2,
  PracticePreferencesResponseV2,
  PracticeStatsPercentileResponseV2,
  PracticeStatsResponseV2,
  PracticeStatsTimingResponseV2,
  PracticeStatsTrendResponseV2,
} from '@sikao/api-client/types/practice';
import type { PracticeHistoryResponseV2 } from '@sikao/api-client/types/api';

export const nowIso = () => new Date().toISOString();

export function createPreferencesPayload(): PracticePreferencesResponseV2['payload'] {
  return {
    ui: {
      fontSize: 'base',
      lineHeight: 'comfortable',
      themePreference: 'system',
      showQuestionIndex: true,
      showTimingIndicator: true,
      showOvertimeWarning: true,
      answerPanelPosition: 'right',
    },
    pacing: {
      defaultPracticeMode: 'full_set',
      autoAdvanceAfterAnswer: false,
      autoAdvanceDelaySeconds: 1,
      confirmBeforeSubmit: true,
      confirmWhenUnansweredCountGte: 1,
    },
    autoSave: {
      enabled: true,
      intervalSeconds: 30,
      saveToLocalStorage: true,
    },
    keyboard: {
      enabled: true,
      bindings: {
        selectA: 'a',
        selectB: 'b',
        selectC: 'c',
        selectD: 'd',
        nextQuestion: 'ArrowRight',
        prevQuestion: 'ArrowLeft',
        flagUncertain: 'f',
        favorite: 's',
        note: 'n',
        submit: 'Ctrl+Enter',
      },
    },
    reminders: {
      dailyPracticeReminderEnabled: false,
      dailyPracticeReminderTime: '20:00',
      weeklySummaryReminderEnabled: false,
      overtimeThresholdSeconds: 0,
      longSessionBreakReminderMinutes: 0,
    },
    customPractice: {
      lastUsedSourceMode: 'real_exam',
      lastUsedYearRange: 'recent_3',
      lastUsedDifficultyRange: [0, 1] as [number, number],
      lastUsedCount: 10,
      lastUsedPracticeMode: 'full_set',
      lastUsedExcludeDone: true,
      lastUsedOnlyWrong: false,
    },
  };
}

export function makeCenterResponse(): PracticeCenterResponseV2 {
  return {
    summary: [
      { key: 'total', label: '总练习', tone: 'neutral', value: '286 题' },
      { key: 'accuracy', label: '正确率', tone: 'ok', value: '76%' },
      { key: 'trend', label: '近 30 天', tone: 'neutral', value: '+4.8pp' },
    ],
    actions: [
      { key: 'daily', label: '每日一练', href: '/practice', enabled: true },
      { key: 'continue', label: '继续上次', href: '/practice', enabled: true },
      { key: 'custom', label: '自定义刷题', href: '/practice', enabled: true },
    ],
    sections: [
      { key: 'history', title: '历史记录', description: '最近 session 与趋势', href: '/practice', status: 'ready' },
      { key: 'specialty', title: '专项练习', description: '按分类进入练习', href: '/practice', status: 'ready' },
      { key: 'papers', title: '套卷练习', description: '按套卷筛选真题', href: '/practice', status: 'ready' },
    ],
  };
}

export function makeStatsResponse(type: 'xingce' | 'essay'): PracticeStatsResponseV2 {
  return {
    type,
    overall: {
      label: type === 'xingce' ? '行测整体' : '申论整体',
      accuracy: type === 'xingce' ? 0.76 : 0.69,
      averageScore: type === 'essay' ? 68 : null,
      correctCount: type === 'xingce' ? 218 : 41,
      totalQuestions: type === 'xingce' ? 286 : 59,
      totalMinutes: type === 'xingce' ? 930 : 420,
      totalSessions: type === 'xingce' ? 18 : 9,
      categoryKey: null,
      percentileRank: type === 'xingce' ? 83 : 61,
      recentTrend: [
        { date: '2026-05-01', count: 1, accuracy: 0.62, averageScore: null, sessionId: 5001 },
        { date: '2026-05-08', count: 1, accuracy: 0.71, averageScore: null, sessionId: 5002 },
        { date: '2026-05-15', count: 1, accuracy: 0.75, averageScore: null, sessionId: 5003 },
        { date: '2026-05-22', count: 1, accuracy: type === 'xingce' ? 0.8 : 0.7, averageScore: type === 'essay' ? 70 : null, sessionId: 5004 },
      ],
      lastPracticedAt: '2026-05-24T09:30:00Z',
    },
    byCategoryL1: type === 'xingce'
      ? [
          {
            label: '言语',
            categoryKey: 'verbal',
            accuracy: 0.79,
            correctCount: 88,
            totalQuestions: 112,
            totalMinutes: 300,
            totalSessions: 10,
            averageScore: null,
            percentileRank: 82,
            recentTrend: [],
            lastPracticedAt: '2026-05-24T09:30:00Z',
          },
          {
            label: '判断',
            categoryKey: 'judgment',
            accuracy: 0.71,
            correctCount: 67,
            totalQuestions: 94,
            totalMinutes: 260,
            totalSessions: 8,
            averageScore: null,
            percentileRank: 77,
            recentTrend: [],
            lastPracticedAt: '2026-05-23T07:00:00Z',
          },
        ]
      : [
          {
            label: '归纳概括',
            categoryKey: 'summary',
            accuracy: 0.72,
            correctCount: 18,
            totalQuestions: 25,
            totalMinutes: 160,
            totalSessions: 5,
            averageScore: 70,
            percentileRank: 60,
            recentTrend: [],
            lastPracticedAt: '2026-05-21T11:00:00Z',
          },
          {
            label: '提出对策',
            categoryKey: 'policy',
            accuracy: 0.65,
            correctCount: 13,
            totalQuestions: 20,
            totalMinutes: 140,
            totalSessions: 4,
            averageScore: 66,
            percentileRank: 59,
            recentTrend: [],
            lastPracticedAt: '2026-05-22T13:00:00Z',
          },
        ],
    byCategoryL2: [],
  };
}

export function makeTrendResponse(type: 'xingce' | 'essay'): PracticeStatsTrendResponseV2 {
  return {
    type,
    period: '30d',
    category: null,
    points: [
      { date: '2026-05-01', count: 1, accuracy: type === 'xingce' ? 0.62 : 0.58, averageScore: type === 'essay' ? 59 : null, sessionId: 5101 },
      { date: '2026-05-08', count: 1, accuracy: type === 'xingce' ? 0.69 : 0.63, averageScore: type === 'essay' ? 64 : null, sessionId: 5102 },
      { date: '2026-05-15', count: 1, accuracy: type === 'xingce' ? 0.74 : 0.67, averageScore: type === 'essay' ? 68 : null, sessionId: 5103 },
      { date: '2026-05-22', count: 1, accuracy: type === 'xingce' ? 0.8 : 0.71, averageScore: type === 'essay' ? 71 : null, sessionId: 5104 },
    ],
  };
}

export function makePercentileResponse(type: 'xingce' | 'essay'): PracticeStatsPercentileResponseV2 {
  return {
    type,
    category: null,
    percentileRank: type === 'xingce' ? 83 : 61,
    percentileUpdatedAt: nowIso(),
  };
}

export function makeTimingResponse(): PracticeStatsTimingResponseV2 {
  return {
    pacingPattern: 'steady',
    overall: { avgSecondsPerQuestion: 42, totalMinutes: 186, vsBaselineRatio: 0.93 },
    byCategoryL1: [],
    byDifficulty: [],
    overtimeQuestions: { count: 3, top5QuestionIds: [1, 2, 3] },
  };
}

export function makeHistoryResponse(): PracticeHistoryResponseV2 {
  return {
    summary: { totalAttempts: 286, correctCount: 218, wrongCount: 68, accuracyRate: 0.7622 },
    recentAttempts: [
      {
        id: 1,
        sessionId: 5001,
        questionId: 1001,
        questionStem: '增长率比较',
        selectedOption: 'A',
        correctOption: 'A',
        isCorrect: true,
        createdAt: '2026-05-24T09:30:00Z',
      },
      {
        id: 2,
        sessionId: 5002,
        questionId: 1002,
        questionStem: '片段阅读主旨',
        selectedOption: 'B',
        correctOption: 'D',
        isCorrect: false,
        createdAt: '2026-05-23T20:10:00Z',
      },
    ],
    wrongQuestions: [
      {
        questionId: 1002,
        questionStem: '片段阅读主旨',
        latestSelectedOption: 'B',
        correctOption: 'D',
        wrongCount: 2,
      },
    ],
    recentSessions: [
      {
        sessionId: 5001,
        mode: 'paper',
        paperCode: 'XC-2024-01',
        paperName: '2024 国考 行测',
        startedAt: '2026-05-24T09:00:00Z',
        completedAt: '2026-05-24T09:30:00Z',
        totalQuestions: 20,
        answeredQuestions: 20,
        correctCount: 16,
        wrongCount: 4,
        accuracyRate: 0.8,
      },
    ],
    recentAttemptsLimit: 10,
    recentSessionsLimit: 5,
  };
}

export function makeCatalogItems(kind: 'xingce-category' | 'xingce-paper' | 'essay-category' | 'essay-paper'): CatalogListResponseV2 {
  if (kind === 'xingce-category') {
    return {
      page: 1,
      pageSize: 20,
      total: 4,
      items: [
        { id: '1', title: '主旨概括', subtitle: '言语 / 112 题', href: '/practice', status: 'ready', isCompleted: false, categoryL1: 'verbal', categoryL2: 'summary', count: 112 },
        { id: '2', title: '逻辑填空', subtitle: '言语 / 96 题', href: '/practice', status: 'ready', isCompleted: false, categoryL1: 'verbal', categoryL2: 'logic_fill', count: 96 },
        { id: '3', title: '类比推理', subtitle: '判断 / 84 题', href: '/practice', status: 'ready', isCompleted: false, categoryL1: 'judgment', categoryL2: 'analogy', count: 84 },
        { id: '4', title: '增长率', subtitle: '资料 / 78 题', href: '/practice', status: 'ready', isCompleted: true, categoryL1: 'data', categoryL2: 'growth_rate', count: 78 },
      ],
    };
  }
  if (kind === 'essay-category') {
    return {
      page: 1,
      pageSize: 20,
      total: 4,
      items: [
        { id: '11', title: '归纳概括', subtitle: '申论 / 25 题', href: '/practice', status: 'ready', isCompleted: false, categoryL1: 'summary', categoryL2: 'summary_basic', count: 25 },
        { id: '12', title: '提出对策', subtitle: '申论 / 20 题', href: '/practice', status: 'ready', isCompleted: false, categoryL1: 'policy', categoryL2: 'policy_basic', count: 20 },
        { id: '13', title: '综合分析', subtitle: '申论 / 18 题', href: '/practice', status: 'ready', isCompleted: false, categoryL1: 'analysis', categoryL2: 'analysis_basic', count: 18 },
        { id: '14', title: '大作文', subtitle: '申论 / 12 题', href: '/practice', status: 'ready', isCompleted: false, categoryL1: 'writing', categoryL2: 'essay_full', count: 12 },
      ],
    };
  }
  if (kind === 'essay-paper') {
    return {
      page: 1,
      pageSize: 20,
      total: 2,
      items: [
        { id: 'p11', title: '2024 国考 申论', subtitle: '副省级', href: '/practice', status: 'ready', isCompleted: false, paperCode: 'SL-2024-01', questionCount: 5, year: 2024, region: 'national', examType: 'vice_provincial' },
        { id: 'p12', title: '2023 联考 申论', subtitle: '省级卷', href: '/practice', status: 'ready', isCompleted: true, paperCode: 'SL-2023-01', questionCount: 5, year: 2023, region: 'jiangsu', examType: 'provincial' },
      ],
    };
  }
  return {
    page: 1,
    pageSize: 20,
    total: 3,
    items: [
      { id: 'p1', title: '2024 国考 行测', subtitle: '副省级', href: '/practice', status: 'ready', isCompleted: false, paperCode: 'XC-2024-01', questionCount: 135, year: 2024, region: 'national', examType: 'vice_provincial', difficulty: 'medium' },
      { id: 'p2', title: '2024 江苏 A', subtitle: '联考', href: '/practice', status: 'ready', isCompleted: true, paperCode: 'XC-2024-02', questionCount: 135, year: 2024, region: 'jiangsu', examType: 'joint', difficulty: 'hard' },
      { id: 'p3', title: '2023 浙江 A', subtitle: '联考', href: '/practice', status: 'ready', isCompleted: false, paperCode: 'XC-2023-01', questionCount: 120, year: 2023, region: 'zhejiang', examType: 'joint', difficulty: 'easy' },
    ],
  };
}
