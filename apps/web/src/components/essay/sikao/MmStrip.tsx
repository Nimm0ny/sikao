// MmStrip — 04b 多材料多题目: 顶部均匀按钮条. Spec 04-essay.md:
//   - 左栏顶部 (.essay-mm-strip .l): M1 [N 处] | M2 已读 | ... 按 grid 1fr×N 等宽
//   - 右栏顶部 (.essay-mm-strip .r): Q1 198/200 ✓ | ... 按 grid 1fr×M 等宽
//   - 切 M tab → 换左栏正文; 切 Q tab → 换右栏题面 + 编辑器
//
// 左栏沿用 MaterialBadge composite icon 渲染 (M1 + 角标 SVG).
//
// 右栏 Q-tab (Phase 1C, 2026-05-11): 文字 label `Q{n}` + meta `current/required`,
// 三态视觉差通过 className 控制:
//   - done   (status='submitted') : 文字尾部追加 ✓ check SVG (1.4px stroke, currentColor)
//   - active (idx === activeIdx)  : text-accent + 底部 2px accent underline
//   - locked (status='locked')    : text-ink-4 + cursor-not-allowed + disabled
//   - pending                     : text-ink (default)
// 不依赖图标库 (lucide / heroicons 禁); ✓ 走 inline SVG, 不用 emoji.

import { MaterialBadge, type MaterialStatus } from '@sikao/ui/icons/composite/MaterialBadge';
import type { QuestionStatus } from '@sikao/ui/icons/composite/QuestionBadge';
import { cn } from '@sikao/shared-utils';

const QUESTION_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

export interface MaterialStripItem {
  readonly id: string;
  readonly status: MaterialStatus;
  readonly markedCount?: number;
}

export interface QuestionStripItem {
  readonly id: string;
  readonly status: QuestionStatus;
  readonly currentChars?: number;
  readonly requiredChars?: number;
}

interface MaterialStripProps {
  readonly side: 'l';
  readonly materials: readonly MaterialStripItem[];
  readonly activeIdx: number;
  readonly onSelect: (idx: number) => void;
}

interface QuestionStripProps {
  readonly side: 'r';
  readonly questions: readonly QuestionStripItem[];
  readonly activeIdx: number;
  readonly onSelect: (idx: number) => void;
}

type Props = MaterialStripProps | QuestionStripProps;

function isMaterialStrip(p: Props): p is MaterialStripProps {
  return p.side === 'l';
}

// metaText: 字数副标. required=0 (无字数要求) → "M 字"; 否则 "M/N".
// 调用方未传 current/required → 不渲染 meta (locked 兜底).
function metaText(current: number | undefined, required: number | undefined): string | null {
  if (current === undefined || required === undefined) return null;
  if (required > 0) return `${current}/${required}`;
  return `${current} 字`;
}

// CheckGlyph: 1.4px stroke ✓. 走 currentColor → 跟父级 text-ink/text-accent 同色.
function CheckGlyph() {
  return (
    <svg
      className="essay-q-tab-check"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12l5 5 13-13" />
    </svg>
  );
}

interface QTabProps {
  readonly index: number;
  readonly item: QuestionStripItem;
  readonly active: boolean;
  readonly onClick: () => void;
}

function QTab({ index, item, active, onClick }: QTabProps) {
  const isLocked = item.status === 'locked';
  const isDone = item.status === 'submitted';
  // 4 视觉态: locked / active / pending / (default sans-active). active 优先级最高
  // (跨 done/pending/writing 都 override 颜色 + underline). done glyph 跟 active
  // 正交 — done 的题被切到 active 时仍显 ✓.
  const visual: 'locked' | 'active' | 'default' = isLocked
    ? 'locked'
    : active
      ? 'active'
      : 'default';
  const meta = metaText(item.currentChars, item.requiredChars);
  return (
    <button
      type="button"
      role="tab"
      className={cn(
        'essay-q-tab',
        visual === 'active' && 'essay-q-tab--active text-accent',
        visual === 'locked' && 'essay-q-tab--locked text-ink-4',
        visual === 'default' && 'text-ink',
      )}
      data-status={item.status}
      data-active={active ? 'true' : 'false'}
      aria-label={`第 ${index} 题`}
      aria-selected={active}
      aria-current={active ? 'true' : undefined}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      disabled={isLocked}
    >
      <span className="essay-q-tab-label">{QUESTION_LABELS[index - 1] ?? String(index)}</span>
      {meta !== null ? <span className="essay-q-tab-dot" aria-hidden="true" /> : null}
      {isDone ? <CheckGlyph /> : null}
    </button>
  );
}

export function MmStrip(props: Props) {
  if (isMaterialStrip(props)) {
    const { materials, activeIdx, onSelect } = props;
    return (
      <div
        className="essay-mm-strip"
        style={{ gridTemplateColumns: `repeat(${materials.length}, 1fr)` }}
        role="tablist"
        aria-label="材料切换"
        data-testid="essay-mm-strip-l"
      >
        {materials.map((mat, idx) => (
          <MaterialBadge
            key={mat.id}
            index={idx + 1}
            status={idx === activeIdx ? 'active' : mat.status}
            count={mat.markedCount}
            ariaLabel={`材料 ${idx + 1}`}
            onClick={() => onSelect(idx)}
          />
        ))}
      </div>
    );
  }
  const { questions, activeIdx, onSelect } = props;
  return (
    <div
      className="essay-mm-strip"
      style={{ gridTemplateColumns: `repeat(${questions.length}, 1fr)` }}
      role="tablist"
      aria-label="题目切换"
      data-testid="essay-mm-strip-r"
    >
      {questions.map((q, idx) => (
        <QTab
          key={q.id}
          index={idx + 1}
          item={q}
          active={idx === activeIdx}
          onClick={() => onSelect(idx)}
        />
      ))}
    </div>
  );
}
