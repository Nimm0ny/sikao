import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { ScrollSession, type ScrollSessionApi } from './ScrollSession';
import type { PracticeDeckItem } from '@/components/practice/deck/buildPracticeDeckItems';
import type { QuestionDetailV2, MaterialGroup } from '@sikao/api-client/types/api';

// jsdom 不带 IntersectionObserver — 同 StudyPlanHistory.test.tsx 模式 stub.
interface MockObserverInstance {
  trigger: (entries: ReadonlyArray<{ isIntersecting: boolean; target: Element; top: number }>) => void;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}
const observers: MockObserverInstance[] = [];

class MockIO {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
  root = null;
  rootMargin = '';
  thresholds = [];
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    this.takeRecords = vi.fn(() => []);
    observers.push({
      observe: this.observe,
      disconnect: this.disconnect,
      trigger: (entries) => {
        const ioEntries = entries.map(
          (e) =>
            ({
              isIntersecting: e.isIntersecting,
              target: e.target,
              boundingClientRect: { top: e.top } as DOMRectReadOnly,
              intersectionRatio: e.isIntersecting ? 1 : 0,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: 0,
            }) as unknown as IntersectionObserverEntry,
        );
        cb(ioEntries, this as unknown as IntersectionObserver);
      },
    });
  }
}

beforeEach(() => {
  observers.length = 0;
  // @ts-expect-error: jsdom missing IntersectionObserver
  globalThis.IntersectionObserver = MockIO;
  // jsdom Element.prototype.scrollIntoView is undefined — stub for scrollTo test
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = vi.fn();
  }
});
afterEach(() => {
  // jsdom 没装 IntersectionObserver, stub 装在 globalThis 上 — afterEach reset
  // 让其他测试的 stub 不污染. delete 一个 declared global 的 prop, TS 看作合法.
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});

function makeQ(id: number, no: number, sectionId: string, sectionTitle: string): PracticeDeckItem {
  return {
    kind: 'question',
    id: `question:${id}`,
    sectionId,
    sectionTitle,
    question: {
      questionId: id,
      paperRevisionId: '1',
      sectionId,
      blockId: `block-${id}`,
      questionNo: no,
      questionKind: 'single_choice',
      rendererKey: 'single_choice',
      content: {
        stem: `Q${no} 题干`,
        options: [
          { key: 'A', text: '选项 A' },
          { key: 'B', text: '选项 B' },
        ],
      },
    } as QuestionDetailV2,
  };
}

describe('ScrollSession', () => {
  it('renders empty state when deckItems is empty', () => {
    render(
      <ScrollSession deckItems={[]} currentIndex={0} onCurrentIndexChange={vi.fn()} />,
    );
    expect(screen.getByText('暂无题目')).toBeInTheDocument();
  });

  it('renders all questions grouped by section + section header shows count', () => {
    const items = [
      makeQ(1, 1, 'sec-a', '常识判断'),
      makeQ(2, 2, 'sec-a', '常识判断'),
      makeQ(3, 3, 'sec-b', '言语理解'),
    ];
    render(
      <ScrollSession deckItems={items} currentIndex={0} onCurrentIndexChange={vi.fn()} />,
    );
    expect(screen.getByTestId('scroll-section-sec-a')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-section-sec-b')).toBeInTheDocument();
    expect(screen.getByText(/常识判断/)).toBeInTheDocument();
    expect(screen.getByText(/言语理解/)).toBeInTheDocument();
    expect(screen.getByText('(2 题)')).toBeInTheDocument();
    expect(screen.getByText('(1 题)')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-question-1')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-question-2')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-question-3')).toBeInTheDocument();
  });

  it('marks the currentIndex card with data-current=true', () => {
    const items = [makeQ(10, 1, 's', 'S'), makeQ(11, 2, 's', 'S')];
    render(
      <ScrollSession deckItems={items} currentIndex={1} onCurrentIndexChange={vi.fn()} />,
    );
    expect(screen.getByTestId('scroll-question-10')).not.toHaveAttribute('data-current');
    expect(screen.getByTestId('scroll-question-11')).toHaveAttribute('data-current', 'true');
  });

  it('IntersectionObserver visible entries → onCurrentIndexChange fires with topmost deckIndex', () => {
    const items = [makeQ(1, 1, 's', 'S'), makeQ(2, 2, 's', 'S'), makeQ(3, 3, 's', 'S')];
    const onChange = vi.fn();
    render(
      <ScrollSession deckItems={items} currentIndex={0} onCurrentIndexChange={onChange} />,
    );
    expect(observers.length).toBe(1);
    const t1 = screen.getByTestId('scroll-question-1');
    const t2 = screen.getByTestId('scroll-question-2');
    const t3 = screen.getByTestId('scroll-question-3');
    observers[0].trigger([
      { isIntersecting: true, target: t2, top: 200 },
      { isIntersecting: true, target: t3, top: 400 },
      { isIntersecting: false, target: t1, top: -50 },
    ]);
    // t2 与 t3 都 visible, t2 top=200 < t3 top=400 → currentIndex = 1 (deckIndex of q2)
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('IntersectionObserver disconnects on unmount', () => {
    const items = [makeQ(1, 1, 's', 'S')];
    const { unmount } = render(
      <ScrollSession deckItems={items} currentIndex={0} onCurrentIndexChange={vi.fn()} />,
    );
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('scrollToRef.current.scrollToQuestionId calls element.scrollIntoView', () => {
    const items = [makeQ(101, 1, 's', 'S'), makeQ(102, 2, 's', 'S')];
    const ref = createRef<ScrollSessionApi | null>();
    render(
      <ScrollSession
        deckItems={items}
        currentIndex={0}
        onCurrentIndexChange={vi.fn()}
        scrollToRef={ref}
      />,
    );
    const target = screen.getByTestId('scroll-question-102');
    const scrollSpy = vi.fn();
    target.scrollIntoView = scrollSpy;
    expect(ref.current).not.toBeNull();
    ref.current?.scrollToQuestionId('102');
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('material questions: 5 sibling material_questions share one MaterialReader (review-fix #1 P0)', () => {
    const mg: MaterialGroup = {
      materialGroupId: 'mg-7',
      blockId: 'b-1',
      title: '一带一路材料',
      content: '<p>材料正文 ABCDE</p>',
      groupKind: 'data_analysis',
      questions: [],
      assets: [],
    };
    const items: PracticeDeckItem[] = [50, 51, 52, 53, 54].map((qid, idx) => ({
      kind: 'material_question',
      id: `m:${qid}`,
      sectionId: 's-data',
      sectionTitle: '资料',
      materialGroup: mg,
      question: makeQ(qid, idx + 1, 's-data', '资料').question,
      groupQuestionIndex: idx,
      groupQuestionCount: 5,
    }));
    render(
      <ScrollSession deckItems={items} currentIndex={0} onCurrentIndexChange={vi.fn()} />,
    );
    // 材料 block 唯一一个, 5 道子题渲在 block 内.
    expect(screen.getAllByTestId('scroll-material-mg-7')).toHaveLength(1);
    items.forEach((item) => {
      expect(screen.getByTestId(`scroll-question-${item.question.questionId}`)).toBeInTheDocument();
    });
    // 材料正文渲一次 (不是 5 次), 题面没丢.
    expect(screen.getAllByText('一带一路材料')).toHaveLength(1);
  });

  it('material questions in two different sections render two material_blocks', () => {
    const mg1: MaterialGroup = {
      materialGroupId: 'mg-A',
      blockId: 'bA',
      title: '材料 A',
      content: '<p>A 正文</p>',
      groupKind: 'data_analysis',
      questions: [],
      assets: [],
    };
    const mg2: MaterialGroup = {
      materialGroupId: 'mg-B',
      blockId: 'bB',
      title: '材料 B',
      content: '<p>B 正文</p>',
      groupKind: 'data_analysis',
      questions: [],
      assets: [],
    };
    const itemA: PracticeDeckItem = {
      kind: 'material_question',
      id: 'm:1',
      sectionId: 's',
      sectionTitle: 's',
      materialGroup: mg1,
      question: makeQ(60, 1, 's', 's').question,
      groupQuestionIndex: 0,
      groupQuestionCount: 5,
    };
    const itemB: PracticeDeckItem = {
      kind: 'material_question',
      id: 'm:2',
      sectionId: 's',
      sectionTitle: 's',
      materialGroup: mg2,
      question: makeQ(70, 2, 's', 's').question,
      groupQuestionIndex: 0,
      groupQuestionCount: 5,
    };
    render(
      <ScrollSession deckItems={[itemA, itemB]} currentIndex={0} onCurrentIndexChange={vi.fn()} />,
    );
    expect(screen.getByTestId('scroll-material-mg-A')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-material-mg-B')).toBeInTheDocument();
  });
});
