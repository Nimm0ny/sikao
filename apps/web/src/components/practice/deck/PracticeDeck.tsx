import { useMemo, useState, type PointerEvent } from 'react';
import DOMPurify from 'dompurify';
import { Badge, Card } from '@sikao/ui/ui';
import QuestionDispatcher from '@/components/questions/QuestionDispatcher';
import { useReducedMotion } from '@sikao/shared-utils';
import type { MaterialGroupAssetV2 } from '@sikao/api-client/types/api';
import type { PracticeDeckItem } from './buildPracticeDeckItems';

export interface PracticeDeckProps {
  readonly item: PracticeDeckItem | undefined;
  readonly currentIndex: number;
  readonly totalItems: number;
  readonly canGoPrevious?: boolean;
  readonly canGoNext?: boolean;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
}

const SWIPE_THRESHOLD_PX = 120;

export function PracticeDeck({
  item,
  currentIndex,
  totalItems,
  canGoPrevious = false,
  canGoNext = false,
  onPrevious,
  onNext,
}: PracticeDeckProps) {
  const drag = useCardDrag({ canGoPrevious, canGoNext, onPrevious, onNext });
  if (item === undefined) {
    return <div className="py-12 text-center text-ink-3">暂无题目</div>;
  }
  return (
    <main
      className="max-w-7xl mx-auto w-full p-4 md:px-8 md:py-4 [font-size:var(--practice-reading-fs)]"
      data-testid="practice-deck"
    >
      {item.kind === 'question' ? (
        <QuestionDeckCard
          item={item}
          currentIndex={currentIndex}
          totalItems={totalItems}
          drag={drag}
        />
      ) : (
        <MaterialQuestionDeckCard item={item} currentIndex={currentIndex} totalItems={totalItems} />
      )}
    </main>
  );
}

function QuestionDeckCard({
  item,
  currentIndex,
  totalItems,
  drag,
}: {
  readonly item: Extract<PracticeDeckItem, { kind: 'question' }>;
  readonly currentIndex: number;
  readonly totalItems: number;
  readonly drag: ReturnType<typeof useCardDrag>;
}) {
  // P1-6: prefers-reduced-motion 下禁掉 rotate / 回弹 transition (装饰性).
  // translateX 仍跟手指走 — 那是直接操作反馈, 不是动画装饰, WCAG 不要求禁.
  const reduceMotion = useReducedMotion();
  const rotation = reduceMotion ? 0 : drag.rotationDeg;
  const transition =
    drag.isDragging || reduceMotion ? 'none' : 'transform var(--motion-slow) var(--motion-ease)';
  return (
    <Card
      padding="md"
      // max-w-3xl (768px) 替 max-w-2xl (672px) — 24" 大屏不再过窄留空 (lhr
      // 反馈). 仍保留中文阅读舒适宽度 (~76 中文字, 比 2xl 多 ~10 字, 不影响
      // 阅读速度).
      className="relative overflow-hidden min-h-[calc(100vh-224px)] max-w-3xl mx-auto touch-pan-y"
      data-testid="question-deck-card"
      onPointerDown={drag.handlePointerDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
      onPointerCancel={drag.handlePointerCancel}
      style={{
        transform: `translateX(${drag.offsetX}px) rotate(${rotation}deg)`,
        transition,
      }}
    >
      <DeckProgress currentIndex={currentIndex} totalItems={totalItems} />
      <DeckHeading
        sectionTitle={item.sectionTitle}
        label={`第 ${item.question.questionNo} 题`}
      />
      <QuestionDispatcher question={item.question} />
    </Card>
  );
}

function MaterialQuestionDeckCard({
  item,
  currentIndex,
  totalItems,
}: {
  readonly item: Extract<PracticeDeckItem, { kind: 'material_question' }>;
  readonly currentIndex: number;
  readonly totalItems: number;
}) {
  return (
    <Card padding="none" className="relative overflow-hidden" data-testid="material-question-deck-card">
      <DeckProgress currentIndex={currentIndex} totalItems={totalItems} />
      <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] min-h-[calc(100vh-224px)]">
        <MaterialReaderPane
          title={item.materialGroup.title}
          content={item.materialGroup.content}
          assets={item.materialGroup.assets ?? []}
        />
        <div className="p-4 md:p-5 overflow-y-auto" data-testid="material-question-pane">
          <DeckHeading
            sectionTitle={item.sectionTitle}
            label={`第 ${item.question.questionNo} 题`}
          />
          <QuestionDispatcher question={item.question} />
          <MaterialLocalQuestionNav
            currentIndex={item.groupQuestionIndex}
            total={item.groupQuestionCount}
          />
        </div>
      </div>
    </Card>
  );
}

function MaterialLocalQuestionNav({
  currentIndex,
  total,
}: {
  readonly currentIndex: number;
  readonly total: number;
}) {
  return (
    <div
      className="mt-8 mx-auto inline-flex items-center gap-2 rounded-pill border border-line bg-surface-alt px-2 py-1"
      data-testid="material-local-question-nav"
      aria-label={`资料组第 ${currentIndex + 1} / ${total} 题`}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={
            index === currentIndex
              ? 'inline-flex h-6 w-6 items-center justify-center rounded-pill bg-ink text-xs font-semibold text-white'
              : 'inline-flex h-6 w-6 items-center justify-center rounded-pill border border-line bg-surface text-xs font-semibold text-ink-3'
          }
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}

// Wave D: MaterialReaderPane 提 export — scroll 模式 ScrollSession 也要复用
// 渲染材料正文 + 图表. deck 模式仍走 MaterialQuestionDeckCard 调用. 不改其他.
export function MaterialReaderPane({
  title,
  content,
  assets,
}: {
  readonly title: string;
  readonly content: string;
  readonly assets: readonly MaterialGroupAssetV2[];
}) {
  const sanitized = useMemo(() => ({ __html: DOMPurify.sanitize(content) }), [content]);
  const imageAssets = assets.filter((asset) => asset.mimeType.startsWith('image/'));
  return (
    <aside className="bg-surface-alt border-b lg:border-b-0 lg:border-r border-line p-4 md:p-5 overflow-y-auto">
      <h3 className="font-serif text-xl text-ink mb-4">{title}</h3>
      <div className="text-sm text-ink-3 leading-relaxed text-justify" dangerouslySetInnerHTML={sanitized} />
      {imageAssets.length > 0 ? (
        <div className="mt-6 flex flex-col gap-4" data-testid="material-assets">
          {imageAssets.map((asset) => (
            <img
              key={asset.id}
              src={asset.url}
              alt={asset.assetRole || '材料图'}
              loading="lazy"
              className="max-w-full h-auto rounded-card border border-line bg-surface"
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function DeckHeading({
  sectionTitle,
  label,
}: {
  readonly sectionTitle: string;
  readonly label: string;
}) {
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <Badge tone="brand">{label}</Badge>
      <h3 className="text-h-card font-bold text-ink">{sectionTitle}</h3>
    </div>
  );
}

function DeckProgress({
  currentIndex,
  totalItems,
}: {
  readonly currentIndex: number;
  readonly totalItems: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 h-[2px] bg-ink transition-[width] duration-base ease-motion"
      style={{ width: `${((currentIndex + 1) / Math.max(1, totalItems)) * 100}%` }}
    />
  );
}

interface CardDragArgs {
  readonly canGoPrevious: boolean;
  readonly canGoNext: boolean;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
}

function useCardDrag({ canGoPrevious, canGoNext, onPrevious, onNext }: CardDragArgs) {
  const [startX, setStartX] = useState<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const isDragging = startX !== null;
  const handlePointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (isInteractiveTarget(event.target)) return;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setStartX(event.clientX);
    setOffsetX(0);
  };
  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    if (startX === null) return;
    setOffsetX(event.clientX - startX);
  };
  const handlePointerUp = (event: PointerEvent<HTMLElement>): void => {
    const finalOffsetX = startX === null ? offsetX : event.clientX - startX;
    finishDrag({ offsetX: finalOffsetX, canGoPrevious, canGoNext, onPrevious, onNext });
    setStartX(null);
    setOffsetX(0);
  };
  const handlePointerCancel = (): void => {
    setStartX(null);
    setOffsetX(0);
  };
  return {
    offsetX,
    rotationDeg: Math.max(-8, Math.min(8, offsetX * 0.04)),
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } as const;
}

function finishDrag(args: CardDragArgs & { readonly offsetX: number }): void {
  if (args.offsetX > SWIPE_THRESHOLD_PX && args.canGoNext) args.onNext?.();
  if (args.offsetX < -SWIPE_THRESHOLD_PX && args.canGoPrevious) args.onPrevious?.();
}

function isInteractiveTarget(target: EventTarget): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('button,a,input,textarea,select') !== null;
}
