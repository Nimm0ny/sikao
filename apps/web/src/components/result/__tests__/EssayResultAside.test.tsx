import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  EssayResultAside,
  StatRow,
  RefList,
  RefListItem,
} from '../EssayResultAside';
import type { AsideCardSection } from '../EssayResultAside';

describe('EssayResultAside', () => {
  it('renders multiple cards with title / subtitle / body', () => {
    const cards: AsideCardSection[] = [
      {
        title: '总览',
        subtitle: 'Q1-Q4',
        body: <div data-testid="overview-body">overview content</div>,
        testIdSuffix: 'overview',
      },
      {
        title: '用时分布',
        subtitle: '每题',
        body: <div data-testid="timing-body">timing content</div>,
        testIdSuffix: 'timing',
      },
    ];
    render(<EssayResultAside cards={cards} />);
    expect(screen.getByTestId('essay-result-aside')).toBeInTheDocument();
    expect(screen.getByTestId('essay-result-aside-card-overview')).toBeInTheDocument();
    expect(screen.getByTestId('essay-result-aside-card-timing')).toBeInTheDocument();
    expect(screen.getByTestId('overview-body')).toBeInTheDocument();
    expect(screen.getByTestId('timing-body')).toBeInTheDocument();
  });

  it('renders footer slot when provided', () => {
    render(
      <EssayResultAside
        cards={[]}
        footer={<button data-testid="aside-cta">看错题</button>}
      />,
    );
    expect(screen.getByTestId('essay-result-aside-footer')).toBeInTheDocument();
    expect(screen.getByTestId('aside-cta')).toBeInTheDocument();
  });

  it('omits footer when not provided', () => {
    render(<EssayResultAside cards={[]} />);
    expect(screen.queryByTestId('essay-result-aside-footer')).toBeNull();
  });

  it('respects testIdPrefix', () => {
    render(
      <EssayResultAside
        cards={[
          { title: 'A', body: <span />, testIdSuffix: 's' },
        ]}
        testIdPrefix="exam-aside"
      />,
    );
    expect(screen.getByTestId('exam-aside')).toBeInTheDocument();
    expect(screen.getByTestId('exam-aside-card-s')).toBeInTheDocument();
  });
});

describe('StatRow', () => {
  it('renders label + value (default tone = var(--ink-1))', () => {
    render(<StatRow label="总分" value="68.5 / 100" testId="row-total" />);
    const row = screen.getByTestId('row-total');
    expect(row.textContent).toMatch(/总分/);
    expect(row.textContent).toMatch(/68\.5/);
  });

  it('renders value with warn tone', () => {
    render(
      <StatRow
        label="引用准确度"
        value="62 %"
        tone="warn"
        testId="row-warn"
      />,
    );
    const row = screen.getByTestId('row-warn');
    // value span 是第 2 个子元素, color: var(--accent-1)
    const valueSpan = row.querySelectorAll('span')[1];
    expect(valueSpan.style.color).toBe('var(--accent-1)');
  });

  it('last=true 不带 border-bottom', () => {
    render(
      <StatRow
        label="x"
        value="y"
        last
        testId="row-last"
      />,
    );
    const row = screen.getByTestId('row-last');
    expect(row.style.borderBottomStyle).toBe('none');
  });
});

describe('RefList + RefListItem', () => {
  it('renders k chip + label + value (default ink)', () => {
    render(
      <RefList>
        <RefListItem k="M1" label="改革下放 137 项" value="2 / 2" testId="ref-m1" />
      </RefList>,
    );
    const item = screen.getByTestId('ref-m1');
    expect(item.textContent).toMatch(/M1/);
    expect(item.textContent).toMatch(/137/);
    expect(item.textContent).toMatch(/2 \/ 2/);
  });

  it('warn tone for .n span (var(--accent-1))', () => {
    render(
      <RefList>
        <RefListItem k="M3" label="落差" value="2 / 4" tone="warn" testId="ref-m3" />
      </RefList>,
    );
    const item = screen.getByTestId('ref-m3');
    const nSpan = item.querySelectorAll('span')[item.querySelectorAll('span').length - 1];
    expect(nSpan.style.color).toBe('var(--accent-1)');
  });
});
