import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@sikao/shared-utils';
import { ImageLightbox } from '@sikao/ui/ui';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

// Phase 6.5 fenbi-merge — 图形推理 renderer.
//
// 数据来源跟 SingleChoiceRenderer 一样 (question.content.stem + options), 但:
//   - stem 主体是 <img> (题图), 文字辅助 — 不再 prose 风格 leading-relaxed,
//     改 surface-alt 容器框出题图区
//   - options 两种布局:
//     a) 全单字母 ABCD: 横排 chip grid (整张题图模式, 选项嵌在题图内)
//     b) 含 img: 4 列网格, 每选项独立显图 + ABCD letter 角标
//   - 任何 img 点击 → ImageLightbox 放大 (复用 useEffect + img onClick)
//
// 跟 SingleChoiceRenderer 共享: dangerouslySetInnerHTML + DOMPurify, onAnswerChange
// debounced 由 QuestionDispatcher 注入. Dumb by contract.

interface Props {
  readonly question: QuestionDetailV2;
  readonly selectedAnswer: readonly string[];
  readonly onAnswerChange: (val: string[]) => void;
}

// review-fix #5 (P1): 五选 / 六选题 — regex 放宽到 A-F. ABCDChipRow grid 列
// 数随 options.length 动态. 公考 5-选/事业单位 6-选小样本但不让 UI 退化.
const SINGLE_LETTER = /^[A-F]$/;

const GraphicReasoningRenderer: React.FC<Props> = ({
  question,
  selectedAnswer,
  onAnswerChange,
}) => {
  const sanitizedStem = useMemo(
    () => DOMPurify.sanitize(question.content.stem ?? ''),
    [question.content.stem],
  );
  const stemRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const options = useMemo(
    () => question.content.options ?? [],
    [question.content.options],
  );
  const isAllSingleLetter = useMemo(
    () => options.length > 0 && options.every((o) => SINGLE_LETTER.test((o.text ?? '').trim())),
    [options],
  );
  // review-fix #1 (P0): setLightboxSrc 不是稳引用 (React setState dispatcher
  // 实际稳定, 但 ImageChoiceCell useEffect deps 引用比较 — 用 useCallback
  // 显式锁定以防未来切 setter 时引用漂移). 防 4 cell useEffect 抖动 +
  // remove/add listener race.
  const openLightbox = useCallback((src: string) => setLightboxSrc(src), []);

  // Stem 内 img 加 click → lightbox (HTML 注入后用 ref 找 img). 不能在 sanitize
  // 阶段加 onClick (DOMPurify 删 event handler), 所以 useEffect 后赋 cursor +
  // listener.
  useEffect(() => {
    const root = stemRef.current;
    if (root === null) return undefined;
    const imgs = Array.from(root.querySelectorAll('img'));
    const handler = (event: Event): void => {
      const target = event.currentTarget as HTMLImageElement;
      setLightboxSrc(target.src);
    };
    imgs.forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', handler);
    });
    return () => {
      imgs.forEach((img) => img.removeEventListener('click', handler));
    };
  }, [sanitizedStem]);

  return (
    <div className="mb-6" data-testid="graphic-reasoning-renderer">
      <div
        className="rounded-card-lg border border-line bg-surface-alt p-4 md:p-5 mb-5 overflow-x-auto"
        data-testid="graphic-stem"
      >
        <div
          ref={stemRef}
          className="text-md text-ink leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-card [&_img]:bg-surface [&_img]:border [&_img]:border-line"
          dangerouslySetInnerHTML={{ __html: sanitizedStem }}
        />
      </div>
      {isAllSingleLetter ? (
        <ABCDChipRow
          options={options}
          selectedAnswer={selectedAnswer}
          onAnswerChange={onAnswerChange}
        />
      ) : (
        <ImageOptionsGrid
          options={options}
          selectedAnswer={selectedAnswer}
          onAnswerChange={onAnswerChange}
          onImageClick={openLightbox}
        />
      )}
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
};

interface ChoiceRowProps {
  readonly options: ReadonlyArray<{ readonly key: string; readonly text?: string }>;
  readonly selectedAnswer: readonly string[];
  readonly onAnswerChange: (val: string[]) => void;
}

function ABCDChipRow({ options, selectedAnswer, onAnswerChange }: ChoiceRowProps) {
  return (
    <div
      role="radiogroup"
      aria-label="选项"
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      data-testid="graphic-options-chip"
    >
      {options.map((opt) => {
        const isSelected = selectedAnswer.includes(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onAnswerChange([opt.key])}
            className={cn(
              'inline-flex h-12 items-center justify-center rounded-card border text-base font-semibold',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              isSelected
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-ink-3 hover:border-line-3 hover:text-ink',
            )}
            data-testid={`graphic-chip-${opt.key}`}
          >
            {opt.key}
          </button>
        );
      })}
    </div>
  );
}

interface ImageOptionsGridProps extends ChoiceRowProps {
  readonly onImageClick: (src: string) => void;
}

function ImageOptionsGrid({
  options,
  selectedAnswer,
  onAnswerChange,
  onImageClick,
}: ImageOptionsGridProps) {
  return (
    <div
      role="radiogroup"
      aria-label="选项"
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
      data-testid="graphic-options-grid"
    >
      {options.map((opt) => (
        <ImageChoiceCell
          key={opt.key}
          opt={opt}
          isSelected={selectedAnswer.includes(opt.key)}
          onSelect={() => onAnswerChange([opt.key])}
          onImageClick={onImageClick}
        />
      ))}
    </div>
  );
}

interface ImageChoiceCellProps {
  readonly opt: { readonly key: string; readonly text?: string };
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onImageClick: (src: string) => void;
}

function ImageChoiceCell({ opt, isSelected, onSelect, onImageClick }: ImageChoiceCellProps) {
  const sanitized = useMemo(
    () => DOMPurify.sanitize(opt.text ?? ''),
    [opt.text],
  );
  const cellRef = useRef<HTMLButtonElement>(null);

  // 选项内 img click → lightbox (而不是触发选答). stopPropagation 阻止 onSelect.
  useEffect(() => {
    const root = cellRef.current;
    if (root === null) return undefined;
    const imgs = Array.from(root.querySelectorAll('img'));
    const handler = (event: Event): void => {
      event.stopPropagation();
      const target = event.currentTarget as HTMLImageElement;
      onImageClick(target.src);
    };
    imgs.forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', handler);
    });
    return () => {
      imgs.forEach((img) => img.removeEventListener('click', handler));
    };
  }, [sanitized, onImageClick]);

  return (
    <button
      ref={cellRef}
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-3 p-4 rounded-card border bg-surface text-ink-3',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        isSelected
          ? 'border-ink bg-paper-2 text-ink font-semibold'
          : 'border-line hover:border-line-3 hover:text-ink',
      )}
      data-testid={`graphic-cell-${opt.key}`}
    >
      <span
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-pill text-sm font-mono font-bold',
          isSelected ? 'bg-ink text-white' : 'bg-surface-alt text-ink-3',
        )}
      >
        {opt.key}
      </span>
      <span
        className="block max-w-full [&_img]:max-w-full [&_img]:h-auto [&_img]:max-h-32 md:[&_img]:max-h-40"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </button>
  );
}

export default GraphicReasoningRenderer;
