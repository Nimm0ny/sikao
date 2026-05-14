/**
 * SIKAO Wave 4 Phase 2D · NoteCard test.
 *
 * 覆盖 4 type 分支 + sourceDomain 中文 label + click handler.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteCard } from '../NoteCard';
import type { NoteOutV2 } from '@sikao/api-client/queries/notebookQueries';

function makeNote(overrides: Partial<NoteOutV2> = {}): NoteOutV2 {
  return {
    id: 1,
    type: 'quote',
    body: { text: '让备考从刷题变成思考' },
    sourceKind: 'manual',
    sourceRef: '2023 国考副省 第三题',
    sourceQuote: null,
    sourceDomain: 'essay',
    title: '思考引言',
    tags: ['#治理', '#思辨'],
    attachedTo: null,
    visibility: 'self',
    ease: 2.5,
    reviewCount: 0,
    reviewedAt: null,
    nextReviewAt: null,
    isPublic: false,
    publicAt: null,
    displayAnonymous: true,
    likesCount: 0,
    commentsCount: 0,
    questionId: null,
    createdAt: '2026-05-12T01:00:00Z',
    updatedAt: '2026-05-12T01:00:00Z',
    ...overrides,
  };
}

describe('NoteCard', () => {
  it('quote: 渲 qbody 引号体 + tag + sourceRef', () => {
    render(<NoteCard note={makeNote()} />);
    expect(screen.getByText('让备考从刷题变成思考')).toBeInTheDocument();
    expect(screen.getByText('#治理')).toBeInTheDocument();
    expect(screen.getByText('2023 国考副省 第三题')).toBeInTheDocument();
  });

  it('method: 渲 title + 三步 list', () => {
    const note = makeNote({
      type: 'method',
      body: {
        title: '归纳概括 · 三步法',
        steps: [
          { index: '1', text: '抓主体' },
          { index: '2', text: '分维度' },
          { index: '3', text: '整合表达' },
        ],
      },
    });
    render(<NoteCard note={note} />);
    expect(screen.getByText('归纳概括 · 三步法')).toBeInTheDocument();
    expect(screen.getByText('抓主体')).toBeInTheDocument();
    expect(screen.getByText('分维度')).toBeInTheDocument();
    expect(screen.getByText('整合表达')).toBeInTheDocument();
  });

  it('reflect: 渲 ink-muted 散文 body', () => {
    const note = makeNote({
      type: 'reflect',
      body: { text: '这次失分是因为论据偏弱.' },
    });
    render(<NoteCard note={note} />);
    expect(
      screen.getByText('这次失分是因为论据偏弱.'),
    ).toBeInTheDocument();
  });

  it('material: 渲 k-v rows', () => {
    const note = makeNote({
      type: 'material',
      body: {
        rows: [
          { key: '人物', value: '周一同' },
          { key: '地点', value: '江西省' },
        ],
      },
    });
    render(<NoteCard note={note} />);
    expect(screen.getByText('周一同')).toBeInTheDocument();
    expect(screen.getByText('江西省')).toBeInTheDocument();
    expect(screen.getByText('人物')).toBeInTheDocument();
  });

  it('sourceDomain 标签: xingce → 行测 / essay → 申论', () => {
    const xingce = makeNote({ id: 2, sourceDomain: 'xingce' });
    const { rerender } = render(<NoteCard note={xingce} />);
    expect(screen.getByText(/行测/)).toBeInTheDocument();
    rerender(<NoteCard note={makeNote({ id: 3, sourceDomain: 'essay' })} />);
    expect(screen.getByText(/申论/)).toBeInTheDocument();
  });

  it('onClick: 点击触发 callback 并传当前 note', () => {
    const handle = vi.fn();
    render(<NoteCard note={makeNote({ id: 42 })} onClick={handle} />);
    fireEvent.click(screen.getByTestId('note-card-42'));
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0][0]).toMatchObject({ id: 42 });
  });

  it('data-type attribute 跟 note.type 一致 (CSS ctype 色钩子)', () => {
    render(<NoteCard note={makeNote({ id: 7, type: 'reflect' })} />);
    expect(screen.getByTestId('note-card-7')).toHaveAttribute(
      'data-type',
      'reflect',
    );
  });
});
