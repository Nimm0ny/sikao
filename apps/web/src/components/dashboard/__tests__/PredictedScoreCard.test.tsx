/**
 * Phase 5.2 + 5.5 fenbi-merge — PredictedScoreCard 三态 + 目标设置流.
 *
 * 覆盖:
 *   1. 0 样本 → predicted=null, 显 "完成 1 套整卷..." hint
 *   2. 1 样本 → 显 "参考值 · 样本少" chip
 *   3. 3+ 样本 + 目标 → 显差距 chip (差 X / 已超 X)
 *   4. 没目标 → 引导文案; 点 "设置目标" 打开 modal; 保存调 PUT
 *   5. error → 显重试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { PredictedScoreCard } from '../PredictedScoreCard';

function mockGoal(hasGoal: boolean, target: number | null) {
  return http.get('/api/v2/me/goals', () =>
    HttpResponse.json({ hasGoal, targetScore: target }),
  );
}

function mockPredicted(predicted: number | null, sample: number, refOnly: boolean) {
  return http.get('/api/v2/me/predicted-score', () =>
    HttpResponse.json({
      predictedScore: predicted,
      sampleSize: sample,
      isReferenceOnly: refOnly,
      recentPapers: [],
    }),
  );
}

describe('PredictedScoreCard', () => {
  beforeEach(() => {
    server.use(mockGoal(false, null), mockPredicted(null, 0, true));
  });

  it('0 样本 → 显 "—" + 引导 hint', async () => {
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-value').textContent).toBe('—');
    });
    expect(screen.getByTestId('predicted-score-empty-hint')).toBeTruthy();
  });

  it('1 样本 → 显 "参考值 · 样本少" chip', async () => {
    server.use(mockPredicted(72.5, 1, true));
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-value').textContent).toBe('72.5');
    });
    expect(screen.getByTestId('predicted-score-reference-chip')).toBeTruthy();
  });

  it('3+ 样本 + 目标 70 + 实测 75 → 显 "已超 5"', async () => {
    server.use(mockGoal(true, 70), mockPredicted(75.0, 4, false));
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-delta-chip').textContent).toMatch(/已超 5/);
    });
    expect(screen.queryByTestId('predicted-score-reference-chip')).toBeNull();
  });

  it('3+ 样本 + 目标 80 + 实测 65 → 显 "差 15"', async () => {
    server.use(mockGoal(true, 80), mockPredicted(65.0, 5, false));
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-delta-chip').textContent).toMatch(/差 15/);
    });
  });

  it('没目标 → 显引导, 点 "设置目标" 打开 modal + 保存调 PUT', async () => {
    let putBody: { targetScore: number } | null = null;
    server.use(
      mockPredicted(60, 5, false),
      mockGoal(false, null),
      http.put('/api/v2/me/goals', async ({ request }) => {
        putBody = (await request.json()) as { targetScore: number };
        return HttpResponse.json({ hasGoal: true, targetScore: putBody.targetScore });
      }),
    );

    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-no-goal')).toBeTruthy();
    });

    // CTA 文案应是 "设置目标" (没目标态)
    const editBtn = screen.getByTestId('predicted-score-edit-goal');
    expect(editBtn.textContent).toMatch(/设置目标/);
    fireEvent.click(editBtn);

    const input = await screen.findByTestId('goal-edit-input');
    fireEvent.change(input, { target: { value: '68' } });
    fireEvent.click(screen.getByTestId('goal-edit-save'));

    await waitFor(() => {
      expect(putBody).toEqual({ targetScore: 68 });
    });
  });

  it('两路全 fail → 整卡降级显重试', async () => {
    server.use(
      http.get('/api/v2/me/predicted-score', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
      http.get('/api/v2/me/goals', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-card-error')).toBeTruthy();
    });
    expect(screen.getByTestId('predicted-score-retry')).toBeTruthy();
  });

  it('partial fail: predicted err + goal ok → 卡仍显, 含 inline 重试', async () => {
    server.use(
      mockGoal(true, 70),
      http.get('/api/v2/me/predicted-score', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-partial-error')).toBeTruthy();
    });
    // 目标信息仍显, 不被 predicted error 抹掉.
    expect(screen.getByTestId('predicted-score-goal-only').textContent).toMatch(/70/);
    // 不是整卡 error, 顶层 error 容器不存在.
    expect(screen.queryByTestId('predicted-score-card-error')).toBeNull();
  });

  it('partial fail: goal err + predicted ok → 显分数 + 编辑按钮 disabled', async () => {
    server.use(
      mockPredicted(75, 4, false),
      http.get('/api/v2/me/goals', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-value').textContent).toBe('75.0');
    });
    expect(screen.getByTestId('predicted-score-goal-error')).toBeTruthy();
    const editBtn = screen.getByTestId('predicted-score-edit-goal') as HTMLButtonElement;
    expect(editBtn.disabled).toBe(true);
  });

  it('modal 已有目标时打开 → input 预填 (regression for 第二次打开 reset bug)', async () => {
    server.use(mockPredicted(60, 5, false), mockGoal(true, 72));
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-edit-goal')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('predicted-score-edit-goal'));
    const input = (await screen.findByTestId('goal-edit-input')) as HTMLInputElement;
    expect(input.value).toBe('72');
  });

  it('input 越界 (-5 / 200 / 非整数) → 不调 PUT', async () => {
    let putCalled = 0;
    server.use(
      mockPredicted(60, 5, false),
      mockGoal(false, null),
      http.put('/api/v2/me/goals', () => {
        putCalled += 1;
        return HttpResponse.json({ hasGoal: true, targetScore: 0 });
      }),
    );
    renderWithProviders(<PredictedScoreCard />);
    await waitFor(() => {
      expect(screen.getByTestId('predicted-score-edit-goal')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('predicted-score-edit-goal'));
    const input = await screen.findByTestId('goal-edit-input');
    const save = screen.getByTestId('goal-edit-save');

    for (const bad of ['-5', '200', '70.5', 'abc']) {
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.click(save);
    }
    // 触发一个有效输入 + click 来锚定 mutation 真的能触发. 用它做 sentinel:
    // mutation 落地后 putCalled === 1, 证明前 4 次没调 (越界全被拦).
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.click(save);
    await waitFor(() => {
      expect(putCalled).toBe(1);
    });
  });
});
