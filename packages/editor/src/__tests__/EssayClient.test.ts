import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@sikao/test-utils/server';
import { realEssayClient } from '@sikao/api-client/essay-client';
import type { BackendEssayQuestion } from '@sikao/domain/shenlun/mapBackendPaper';
import type { AnswerSession, Question } from '@sikao/domain/shenlun/types';

describe('realEssayClient', () => {
  it('loads paper questions from backend and maps them into exam paper', async () => {
    let receivedPath = '';
    server.use(
      http.get('/api/v2/papers/:code/questions', ({ request }) => {
        receivedPath = new URL(request.url).pathname;
        return HttpResponse.json(makeQuestions());
      }),
    );

    const paper = await realEssayClient.getPaper('AIPTA-2024-01');

    expect(receivedPath).toBe('/api/v2/papers/AIPTA-2024-01/questions');
    expect(paper.code).toBe('AIPTA-2024-01');
    expect(paper.questions).toHaveLength(5);
    expect(paper.materials).toHaveLength(4);
  });

  it('rejects when backend returns 404 (caller should not see fallback paper)', async () => {
    server.use(
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json({ detail: 'paper not found' }, { status: 404 }),
      ),
    );

    await expect(realEssayClient.getPaper('NO-SUCH-PAPER')).rejects.toThrow();
  });

  it('rejects when backend returns 500', async () => {
    server.use(
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    await expect(realEssayClient.getPaper('AIPTA-2024-01')).rejects.toThrow();
  });

  // ── submit (PR1) ──────────────────────────────────────────────────────
  // 整卷交卷 = Promise.allSettled 并发 N 次 POST /essay/grade.
  // - fulfilled → record.id 进 recordIds (按题号顺序)
  // - 部分 reject → 不阻塞跳转, 返 fulfilled ids
  // - 全 reject 或全空 → throw, ExamShell 回 running 让用户重试

  it('submit posts one /grade per non-empty answer and returns aligned record ids', async () => {
    const seenBodies: Array<{ questionId: number; answerText: string }> = [];
    server.use(
      http.post('/api/v2/essay/grade', async ({ request }) => {
        const body = (await request.json()) as { questionId: number; answerText: string };
        seenBodies.push(body);
        return HttpResponse.json(makeGradingRecord(body.questionId));
      }),
    );

    const questions = makeFiveQuestions();
    const data = makeAnswerSession([
      '第一题答案，至少十字。',
      '第二题答案，至少十字。',
      '第三题答案，至少十字。',
      '第四题答案，至少十字。',
      '第五题答案，至少十字。',
    ]);

    const result = await realEssayClient.submit('AIPTA-2024-01', data, questions);

    expect(seenBodies).toHaveLength(5);
    // questionId 跟 backendId 走, answerText 跟 textsByQ 走
    expect(seenBodies.map((b) => b.questionId).sort((a, b) => a - b)).toEqual(
      [1001, 1002, 1003, 1004, 1005],
    );
    // recordIds 长度 = questions.length, 全 non-null
    expect(result.recordIds).toHaveLength(5);
    result.recordIds.forEach((id) => expect(typeof id).toBe('number'));
  });

  it('submit returns null at empty-answer slots (PositionLabel 不错位, P0 #9)', async () => {
    // 第 3 题空字符串, 第 4 题只空白. submit 跳过这两题, recordIds 该位置 null.
    // recordIds.length 仍 = 5, 不紧凑成 3, 防 results view PositionLabel
    // "第 idx+1 题" 把 idx=2 (本应是第 3 题 null skip) 显示成第 4 题答案.
    const seenIds: number[] = [];
    server.use(
      http.post('/api/v2/essay/grade', async ({ request }) => {
        const body = (await request.json()) as { questionId: number };
        seenIds.push(body.questionId);
        return HttpResponse.json(makeGradingRecord(body.questionId));
      }),
    );

    const questions = makeFiveQuestions();
    const data = makeAnswerSession([
      '第一题答案。',
      '第二题答案。',
      '',
      '   \n  ',
      '第五题答案。',
    ]);

    const result = await realEssayClient.submit('AIPTA-2024-01', data, questions);

    expect(seenIds.sort((a, b) => a - b)).toEqual([1001, 1002, 1005]);
    expect(result.recordIds).toHaveLength(5);
    // 第 1, 2, 5 题 fulfilled (number), 第 3, 4 题空 (null)
    expect(typeof result.recordIds[0]).toBe('number');
    expect(typeof result.recordIds[1]).toBe('number');
    expect(result.recordIds[2]).toBeNull();
    expect(result.recordIds[3]).toBeNull();
    expect(typeof result.recordIds[4]).toBe('number');
    // record id 即 questionId fixture (见 makeGradingRecord), 验证位置对齐:
    expect(result.recordIds[0]).toBe(1001);
    expect(result.recordIds[1]).toBe(1002);
    expect(result.recordIds[4]).toBe(1005);
  });

  it('submit returns null at rejected slots, fulfilled at others (partial success, aligned)', async () => {
    server.use(
      http.post('/api/v2/essay/grade', async ({ request }) => {
        const body = (await request.json()) as { questionId: number };
        // 第 2 / 第 4 题模拟 500 (questionId 1002 / 1004)
        if (body.questionId === 1002 || body.questionId === 1004) {
          return HttpResponse.json({ detail: 'boom' }, { status: 500 });
        }
        return HttpResponse.json(makeGradingRecord(body.questionId));
      }),
    );

    const questions = makeFiveQuestions();
    const data = makeAnswerSession([
      '第一题答案。',
      '第二题答案。',
      '第三题答案。',
      '第四题答案。',
      '第五题答案。',
    ]);

    const result = await realEssayClient.submit('AIPTA-2024-01', data, questions);

    // 5 题中第 2/4 题失败 → null, 第 1/3/5 题成功 → record id. 长度仍 = 5.
    expect(result.recordIds).toHaveLength(5);
    expect(result.recordIds[0]).toBe(1001);
    expect(result.recordIds[1]).toBeNull();
    expect(result.recordIds[2]).toBe(1003);
    expect(result.recordIds[3]).toBeNull();
    expect(result.recordIds[4]).toBe(1005);
  });

  it('submit throws when every POST fails (all-rejected, no orphan recordIds)', async () => {
    server.use(
      http.post('/api/v2/essay/grade', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    const questions = makeFiveQuestions();
    const data = makeAnswerSession([
      '答案一。',
      '答案二。',
      '答案三。',
      '答案四。',
      '答案五。',
    ]);

    await expect(
      realEssayClient.submit('AIPTA-2024-01', data, questions),
    ).rejects.toThrow();
  });

  it('submit throws when all answers are blank (refuse to submit empty exam)', async () => {
    let postCount = 0;
    server.use(
      http.post('/api/v2/essay/grade', () => {
        postCount += 1;
        return HttpResponse.json(makeGradingRecord(1001));
      }),
    );

    const questions = makeFiveQuestions();
    const data = makeAnswerSession(['', ' ', '\n', '\t', '']);

    await expect(
      realEssayClient.submit('AIPTA-2024-01', data, questions),
    ).rejects.toThrow();
    expect(postCount).toBe(0);
  });
});

const MATERIALS = ['材料一。', '材料二。', '材料三。', '材料四。'] as const;

function makeQuestions(): BackendEssayQuestion[] {
  return [1, 2, 3, 4, 5].map((position) => ({
    id: position,
    position,
    rendererKey: 'essay',
    stemText: `<p>第 ${position} 题题干。</p>`,
    explanationText: `<p>第 ${position} 题要求。</p>`,
    content: {
      stem: `<p>第 ${position} 题题干。</p>`,
      essayMetadata: {
        materialTexts: MATERIALS,
        wordLimitMin: [200, 300, 400, 500, 1000][position - 1],
        wordLimitMax: [250, 350, 450, 550, 1200][position - 1],
        suggestedMinutes: [10, 15, 20, 20, 45][position - 1],
      },
    },
  }));
}

// ── submit fixture helpers ───────────────────────────────────────────────

function makeFiveQuestions(): Question[] {
  // backendId 用 1001..1005 占位 (跟 essayExamMock 区间对齐).
  return [1, 2, 3, 4, 5].map((position) => ({
    no: `第${['一', '二', '三', '四', '五'][position - 1]}题`,
    kind: '概括' as const,
    title: `Q${position}`,
    body: `第 ${position} 题题干`,
    minWords: 200,
    maxWords: 300,
    durationSec: 600,
    requirements: [],
    refMaterials: [],
    backendId: 1000 + position,
    fullScore: position === 5 ? 40 : 15,
  }));
}

function makeAnswerSession(textsByQ: string[]): AnswerSession {
  return {
    paperId: 'AIPTA-2024-01',
    startedAt: 1700000000000,
    phase: 'running',
    currentQ: 0,
    textsByQ,
    elapsedByQ: textsByQ.map(() => 0),
    highlights: {},
    scratch: '',
    savedAt: 1700000000000,
  };
}

function makeGradingRecord(questionId: number) {
  // shape 跟 EssayGradingV2 schema 对齐, 但 submit 只关心 id, 其他字段填 minimal.
  return {
    id: questionId,  // 用 questionId 作 record id (test 友好, 反查容易)
    questionId,
    answerText: 'fixture',
    status: 'pending' as const,
    score: null,
    feedback: null,
    failureReason: null,
    createdAt: '2026-05-07T00:00:00Z',
    gradedAt: null,
  };
}
