import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@sikao/shared-utils';
import QuestionDispatcher from '@/components/questions/QuestionDispatcher';
import { MaterialReaderPane } from '@/components/practice/deck/PracticeDeck';
import type { MaterialGroup } from '@sikao/api-client/types/api';
import type { PracticeDeckItem } from '@/components/practice/deck/buildPracticeDeckItems';

// Phase 3.3 Wave D fenbi-merge — scroll 模式 (一屏多题 stack).
//
// 对齐 prototype 03 frame 1: section header + 题块 stack, 每题独立可见.
// IntersectionObserver 跟踪视口顶部最近的 q-card 作为 currentIndex (驱动
// SessionHeader 标记/笔记按钮 + sticky tab 进度).
//
// 资料分析题特殊处理: 同一 materialGroup 的连续 5 道题合并成一个 material-block,
// 顶部 MaterialReaderPane 渲材料一次, 下方 stack 5 道题 (review-fix #1).
// 没合并的话 5 道材料题各自直接 QuestionDispatcher 完全丢材料正文/图表 (P0).
//
// rootMargin 0 0 -50% 0 — review-fix #3: 之前 -30% 0 -50% 0 视口压成中部 20%
// → 顶部题不在监测区, 滚到底最后一题永远不被识别为 current. 现压成顶部 50%
// → 顶部题进入即 trigger, 滚到底也保持最后题为 current. scroll-mt-24 给 sticky
// header 56px + section sticky ~40px 留位.
//
// Lazy mount 推 follow-up. 第一版直接全 mount — 130 题 q-card 现代浏览器渲染
// 没问题; 实测 perf 后再决定是否 IntersectionObserver-based virtualization.

export interface ScrollSessionProps {
  readonly deckItems: readonly PracticeDeckItem[];
  readonly currentIndex: number;
  readonly onCurrentIndexChange: (index: number) => void;
  readonly scrollToRef?: React.RefObject<ScrollSessionApi | null>;
}

export interface ScrollSessionApi {
  scrollToQuestionId: (questionId: string) => void;
}

interface QuestionEntry {
  readonly kind: 'question';
  readonly item: PracticeDeckItem;
  readonly deckIndex: number;
}

interface MaterialBlockEntry {
  readonly kind: 'material_block';
  readonly materialGroupId: string;
  readonly materialGroup: MaterialGroup;
  readonly children: ReadonlyArray<{ readonly item: PracticeDeckItem; readonly deckIndex: number }>;
}

type StackEntry = QuestionEntry | MaterialBlockEntry;

interface SectionGroup {
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly entries: readonly StackEntry[];
  readonly questionCount: number;
}

function buildStackEntries(
  deckItems: readonly PracticeDeckItem[],
): readonly SectionGroup[] {
  const sections: SectionGroup[] = [];
  deckItems.forEach((item, deckIndex) => {
    let lastSection = sections[sections.length - 1];
    if (lastSection === undefined || lastSection.sectionId !== item.sectionId) {
      lastSection = {
        sectionId: item.sectionId,
        sectionTitle: item.sectionTitle,
        entries: [],
        questionCount: 0,
      };
      sections.push(lastSection);
    }
    const mutableSection = lastSection as {
      sectionId: string;
      sectionTitle: string;
      entries: StackEntry[];
      questionCount: number;
    };
    mutableSection.questionCount += 1;

    if (item.kind === 'question') {
      mutableSection.entries.push({ kind: 'question', item, deckIndex });
      return;
    }
    // material_question: 合并连续同 materialGroup 进 material_block.
    const lastEntry = mutableSection.entries[mutableSection.entries.length - 1];
    if (
      lastEntry !== undefined &&
      lastEntry.kind === 'material_block' &&
      lastEntry.materialGroupId === item.materialGroup.materialGroupId
    ) {
      (lastEntry.children as Array<{ item: PracticeDeckItem; deckIndex: number }>).push({
        item,
        deckIndex,
      });
      return;
    }
    mutableSection.entries.push({
      kind: 'material_block',
      materialGroupId: item.materialGroup.materialGroupId,
      materialGroup: item.materialGroup,
      children: [{ item, deckIndex }],
    });
  });
  return sections;
}

export function ScrollSession({
  deckItems,
  currentIndex,
  onCurrentIndexChange,
  scrollToRef,
}: ScrollSessionProps) {
  const refMap = useRef(new Map<string, HTMLElement>());
  const sectionGroups = useMemo(() => buildStackEntries(deckItems), [deckItems]);

  const setItemRef = useCallback((questionId: string, el: HTMLElement | null): void => {
    if (el === null) {
      refMap.current.delete(questionId);
    } else {
      refMap.current.set(questionId, el);
    }
  }, []);

  // IntersectionObserver: 视口上半部分 (rootMargin top:0 bottom:-50%) 内最靠
  // 顶部的 q-card 作为 current. 顶部题立即触发, 底部题滚到上半才触发, 滚到
  // 文档底部时最后一题仍在监测区 (避免 currentIndex 卡倒数第二).
  useEffect(() => {
    if (deckItems.length === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        const raw = top.target.getAttribute('data-deck-index');
        if (raw === null) return;
        const idx = Number(raw);
        if (Number.isFinite(idx)) onCurrentIndexChange(idx);
      },
      { rootMargin: '0px 0px -50% 0px', threshold: 0 },
    );
    refMap.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [deckItems, onCurrentIndexChange]);

  useEffect(() => {
    if (scrollToRef === undefined) return undefined;
    scrollToRef.current = {
      scrollToQuestionId: (questionId: string): void => {
        const el = refMap.current.get(questionId);
        if (el === undefined) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    };
    return () => {
      if (scrollToRef.current !== null) scrollToRef.current = null;
    };
  }, [scrollToRef]);

  if (deckItems.length === 0) {
    return <div className="py-12 text-center text-ink-3">暂无题目</div>;
  }

  return (
    <main
      className="max-w-3xl mx-auto w-full px-4 py-6 md:px-8 [font-size:var(--practice-reading-fs)]"
      data-testid="scroll-session"
    >
      {sectionGroups.map((group) => (
        <SectionBlock
          key={group.sectionId}
          group={group}
          currentIndex={currentIndex}
          setItemRef={setItemRef}
        />
      ))}
    </main>
  );
}

interface SectionBlockProps {
  readonly group: SectionGroup;
  readonly currentIndex: number;
  readonly setItemRef: (questionId: string, el: HTMLElement | null) => void;
}

function SectionBlock({ group, currentIndex, setItemRef }: SectionBlockProps) {
  return (
    <section className="mb-8" data-testid={`scroll-section-${group.sectionId}`}>
      <header className="sticky top-14 z-10 -mx-4 px-4 py-2 mb-4 bg-surface/95 backdrop-blur border-b border-line md:-mx-8 md:px-8">
        <h3 className="text-tiny font-bold text-ink tracking-loose">
          {group.sectionTitle}{' '}
          <span className="text-ink-3">({group.questionCount} 题)</span>
        </h3>
      </header>
      <div className="space-y-4">
        {group.entries.map((entry, idx) =>
          entry.kind === 'question' ? (
            <QuestionStackCard
              key={entry.item.id}
              item={entry.item}
              deckIndex={entry.deckIndex}
              isCurrent={entry.deckIndex === currentIndex}
              setItemRef={setItemRef}
            />
          ) : (
            <MaterialBlock
              key={`${entry.materialGroupId}:${idx}`}
              entry={entry}
              currentIndex={currentIndex}
              setItemRef={setItemRef}
            />
          ),
        )}
      </div>
    </section>
  );
}

interface MaterialBlockProps {
  readonly entry: MaterialBlockEntry;
  readonly currentIndex: number;
  readonly setItemRef: (questionId: string, el: HTMLElement | null) => void;
}

function MaterialBlock({ entry, currentIndex, setItemRef }: MaterialBlockProps) {
  return (
    <div
      className="rounded-card-lg border border-line bg-surface overflow-hidden"
      data-testid={`scroll-material-${entry.materialGroupId}`}
    >
      <div className="border-b border-line">
        <MaterialReaderPane
          title={entry.materialGroup.title}
          content={entry.materialGroup.content}
          assets={entry.materialGroup.assets ?? []}
        />
      </div>
      <div className="p-4 md:p-5 space-y-4 bg-surface">
        {entry.children.map(({ item, deckIndex }) => (
          <QuestionStackCard
            key={item.id}
            item={item}
            deckIndex={deckIndex}
            isCurrent={deckIndex === currentIndex}
            setItemRef={setItemRef}
            insideMaterial
          />
        ))}
      </div>
    </div>
  );
}

interface QuestionStackCardProps {
  readonly item: PracticeDeckItem;
  readonly deckIndex: number;
  readonly isCurrent: boolean;
  readonly setItemRef: (questionId: string, el: HTMLElement | null) => void;
  readonly insideMaterial?: boolean;
}

function QuestionStackCard({
  item,
  deckIndex,
  isCurrent,
  setItemRef,
  insideMaterial = false,
}: QuestionStackCardProps) {
  const questionId = String(item.question.questionId);
  return (
    <div
      ref={(el) => setItemRef(questionId, el)}
      className={cn(
        'scroll-mt-24 transition-shadow duration-base',
        insideMaterial
          ? 'border-t border-line first:border-t-0 pt-4 first:pt-0'
          : 'border rounded-card-lg bg-surface text-ink p-5 md:p-6',
        !insideMaterial && (isCurrent ? 'border-line-3 ring-2 ring-ink/15' : 'border-line'),
        insideMaterial && isCurrent && 'ring-2 ring-ink/15 rounded-card -mx-2 px-2',
      )}
      data-testid={`scroll-question-${item.question.questionId}`}
      data-deck-index={deckIndex}
      data-question-id={questionId}
      data-current={isCurrent ? 'true' : undefined}
    >
      <div className="mb-3 flex items-center gap-3 text-sm text-ink-3 tabular-nums">
        <span className="font-serif italic text-base text-ink font-semibold">
          {item.question.questionNo}
        </span>
      </div>
      <QuestionDispatcher question={item.question} />
    </div>
  );
}
