import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryCard } from '../CategoryCard';
import type { SpecialtyCategoryV2 } from '@sikao/api-client/queries/essaySpecialtyQueries';

const CAT_NORMAL: SpecialtyCategoryV2 = {
  id: '归纳概括',
  idx: 1,
  name: '归纳概括',
  desc: '从材料中提炼问题',
  overallProgress: 0.34,
  practiced: 253,
  total: 742,
  state: null,
  subTypes: [
    {
      id: 'q-7501',
      questionId: 7501,
      name: '全部 · 归纳概括',
      meta: '所有子项',
      practiced: 253,
      total: 742,
      status: 'progress',
    },
    {
      id: 'q-7502',
      questionId: 7502,
      name: '单一概括',
      meta: '问题',
      practiced: 96,
      total: 96,
      status: 'done',
    },
  ],
};

const CAT_EMPTY: SpecialtyCategoryV2 = {
  id: '公文',
  idx: 4,
  name: '公文 · 应用文',
  desc: '通知',
  overallProgress: 0,
  practiced: 0,
  total: 0,
  state: 'empty',
  subTypes: [],
};

describe('CategoryCard', () => {
  it('defaultOpen=true → body 渲染 + 子行可见', () => {
    render(
      <CategoryCard
        cat={CAT_NORMAL}
        defaultOpen={true}
        onStartCategory={vi.fn()}
        onPickSubtype={vi.fn()}
      />,
    );
    expect(screen.getByTestId('essay-specialty-cat-归纳概括-body')).toBeInTheDocument();
    expect(screen.getByTestId('essay-specialty-subtype-q-7501')).toBeInTheDocument();
  });

  it('defaultOpen=false → click header 展开', async () => {
    const user = userEvent.setup();
    render(
      <CategoryCard
        cat={CAT_NORMAL}
        defaultOpen={false}
        onStartCategory={vi.fn()}
        onPickSubtype={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('essay-specialty-cat-归纳概括-body')).toBeNull();
    await user.click(screen.getByTestId('essay-specialty-cat-归纳概括-header'));
    expect(screen.getByTestId('essay-specialty-cat-归纳概括-body')).toBeInTheDocument();
  });

  it('state=empty → header CTA 是 通知我 / 不可展开', async () => {
    const user = userEvent.setup();
    render(
      <CategoryCard
        cat={CAT_EMPTY}
        defaultOpen={false}
        onStartCategory={vi.fn()}
        onPickSubtype={vi.fn()}
      />,
    );
    expect(screen.getByTestId('essay-specialty-cat-公文-notify')).toBeInTheDocument();
    await user.click(screen.getByTestId('essay-specialty-cat-公文-header'));
    // empty 卡 click header 不应该展开
    expect(screen.queryByTestId('essay-specialty-cat-公文-body')).toBeNull();
  });

  it('continueQuestionId 命中 → CTA 文案 "继续上次" + primary 视觉', () => {
    render(
      <CategoryCard
        cat={CAT_NORMAL}
        continueQuestionId={7501}
        defaultOpen={true}
        onStartCategory={vi.fn()}
        onPickSubtype={vi.fn()}
      />,
    );
    const cta = screen.getByTestId('essay-specialty-cat-归纳概括-cta');
    expect(cta).toHaveTextContent('继续上次');
    // 第一行 (questionId=7501) 应有 "继续" 小 mark
    const row = screen.getByTestId('essay-specialty-subtype-q-7501');
    expect(row).toHaveTextContent('继续');
  });

  it('点击 sub-row → onPickSubtype 拿到 questionId', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryCard
        cat={CAT_NORMAL}
        defaultOpen={true}
        onStartCategory={vi.fn()}
        onPickSubtype={onPick}
      />,
    );
    await user.click(screen.getByTestId('essay-specialty-subtype-q-7502'));
    expect(onPick).toHaveBeenCalledWith(7502);
  });
});
