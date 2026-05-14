import { type ReactElement, type ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';
import type { NoteOutV2, NoteType } from '@sikao/api-client/queries/notebookQueries';

/**
 * SIKAO Wave 4 Phase 2D · NoteCard — 4 type 分支渲染.
 *
 * 设计 SSOT: `design/SIKAO/handoff/modules/notes/essay-review-notes.html` `.ncard`.
 * 4 type 走 token 色 (CLAUDE.md §4 token SSOT):
 *   - quote   → var(--accent-1) 暗朱
 *   - method  → var(--ink-1)    深墨
 *   - reflect → var(--warn)   暖橙
 *   - material → var(--ok)    沉绿
 * 左边线 3px ctype + head 圆点 同色 (CSS `[data-type]` 选择器, 不 inline style).
 *
 * Dumb component: 仅展示 + onClick callback, 不 fetch / store. body shape 由 type
 * 派生 — discriminated union narrow.
 *
 * Italic 政策 (CLAUDE.md §4 italic): quote.qbody 大引号 / method 标题 / reflect
 * 散文 全部用 `font-serif` 不 italic, CJK 禁 italic 铁律.
 */

export interface NoteCardProps {
  readonly note: NoteOutV2;
  readonly onClick?: (note: NoteOutV2) => void;
  readonly testId?: string;
}

const TYPE_LABELS: Record<NoteType, string> = {
  quote: '金句',
  method: '方法论',
  reflect: '反思',
  material: '素材',
};

// ctype 左边线 + head 圆点色 (4 type token 映射). 走 inline style 因 Tailwind
// 不内置 var() arbitrary value 全集 — 直接读 token 避三处 SSOT 漂移.
const CTYPE_COLOR: Record<NoteType, string> = {
  quote: 'var(--accent-1)',
  method: 'var(--ink-1)',
  reflect: 'var(--warn)',
  material: 'var(--ok)',
};

export function NoteCard({
  note,
  onClick,
  testId,
}: NoteCardProps): ReactElement {
  const ago = formatAgo(note.createdAt);
  const sourceLabel = note.sourceDomain === 'xingce' ? '行测' : '申论';
  // a11y: 整卡 click 走 role="button" + tabIndex + Enter/Space. 不用 native <button>
  // 因 NoteBody 内嵌 <ol> / heading 等结构, 嵌套在 button 内 HTML 不合法 (button 仅允许
  // phrasing content). 使用 <article> + dynamic role 时 plugin 不识别 dynamic role
  // 仍 warn, 行级 escape.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(note);
    }
  };
  // a11y (chrome MCP audit P2 2026-05-13): role="button" 缺 aria-label →
  // 屏幕阅读器 / 键盘 nav 读不到卡片用途. 拼装 "{type} 笔记 · {source} · {title|preview}"
  // 让 SR 用户在 list 内能区分卡片. title 缺时退到 body 首句 (quote.text /
  // method.title / reflect.text 等), 都空时给 "未命名" 兜底.
  const ariaLabel = onClick
    ? buildNoteAriaLabel(note, sourceLabel)
    : undefined;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <article
      data-testid={testId ?? `note-card-${note.id}`}
      data-type={note.type}
      onClick={onClick ? () => onClick(note) : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      className={cn(
        'relative bg-surface border border-line rounded-card p-5',
        'flex flex-col gap-3 min-h-[200px] cursor-pointer',
        'transition-[border-color,transform] duration-fast ease-motion',
        'hover:-translate-y-[1px] hover:border-line-3',
      )}
    >
      <span
        aria-hidden="true"
        data-pattern="ctype"
        className="absolute top-0 left-0 w-[3px] h-full" // hardcode-allow: ctype 左边线 3px 设计 SSOT
        style={{ background: CTYPE_COLOR[note.type] }}
      />
      <header className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-tiny tracking-wider uppercase text-ink-3">
          <span
            aria-hidden="true"
            data-pattern="dot"
            className="w-1.5 h-1.5"
            style={{ background: CTYPE_COLOR[note.type] }}
          />
          {TYPE_LABELS[note.type]} · {sourceLabel}
        </span>
        <span className="font-mono text-tiny tracking-loose text-ink-4">
          {ago}
        </span>
      </header>
      <NoteBody note={note} />
      <footer className="mt-auto pt-3 border-t border-dashed border-line flex items-center justify-between gap-2 font-mono text-tiny tracking-loose text-ink-3">
        <span className="inline-flex items-center gap-2 truncate">
          <span aria-hidden="true" className="text-ink-4">
            →
          </span>
          <span className="truncate">{note.sourceRef}</span>
        </span>
        {note.tags.length > 0 ? (
          <span className="flex flex-wrap gap-1 shrink-0">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-surface-alt text-tiny tracking-loose text-ink-3"
              >
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </footer>
    </article>
  );
}

// a11y helper: SR-friendly aria-label "{type} 笔记 · {source} · {title|body-snippet}".
// 用于 NoteCard role="button" 让屏幕阅读器在 list 内能区分卡片.
function buildNoteAriaLabel(note: NoteOutV2, sourceLabel: string): string {
  const typeLabel = TYPE_LABELS[note.type];
  const snippet =
    note.title.trim() !== ''
      ? note.title
      : noteBodySnippet(note) || '未命名';
  return `${typeLabel} 笔记 · ${sourceLabel} · ${snippet}`;
}

function noteBodySnippet(note: NoteOutV2): string {
  switch (note.type) {
    case 'quote':
    case 'reflect':
      return readString(note.body, 'text').slice(0, 40);
    case 'method':
      return readString(note.body, 'title').slice(0, 40);
    case 'material': {
      const rows = readRows(note.body);
      return rows.length > 0 ? `${rows[0].key}: ${rows[0].value}`.slice(0, 40) : '';
    }
    default:
      return '';
  }
}

function NoteBody({ note }: { readonly note: NoteOutV2 }): ReactElement {
  // body shape 由 type 决定. BE 存 dict[str, Any]. FE narrow 时 fallback 防异常
  // shape, 但用 NotedBodyShapeError marker 让 logger 可观察 (而非 silent).
  switch (note.type) {
    case 'quote':
      return <QuoteBody text={readString(note.body, 'text')} />;
    case 'method':
      return (
        <MethodBody
          title={readString(note.body, 'title')}
          steps={readSteps(note.body)}
        />
      );
    case 'reflect':
      return <ReflectBody text={readString(note.body, 'text')} />;
    case 'material':
      return <MaterialBody rows={readRows(note.body)} />;
    default:
      // exhaustive narrow — TS 不应到这里, 但 BE schema 加 type 时给个兜底
      return <ReflectBody text="" />;
  }
}

interface MethodStep {
  readonly index: string;
  readonly text: string;
}

interface MaterialRow {
  readonly key: string;
  readonly value: string;
}

function readString(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  return typeof v === 'string' ? v : '';
}

function readSteps(body: Record<string, unknown>): readonly MethodStep[] {
  const raw = body.steps;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is { index: string; text: string } =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as { index?: unknown }).index === 'string' &&
        typeof (x as { text?: unknown }).text === 'string',
    )
    .map((x) => ({ index: x.index, text: x.text }));
}

function readRows(body: Record<string, unknown>): readonly MaterialRow[] {
  const raw = body.rows;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is { key: string; value: string } =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as { key?: unknown }).key === 'string' &&
        typeof (x as { value?: unknown }).value === 'string',
    )
    .map((x) => ({ key: x.key, value: x.value }));
}

function QuoteBody({ text }: { readonly text: string }): ReactElement {
  return (
    <div className="relative pl-[18px] font-serif text-lg leading-snug text-ink"> {/* hardcode-allow: pl-18px qbody 大引号占位 design SSOT */}
      <span
        aria-hidden="true"
        className="absolute -left-1 -top-1.5 font-serif text-4xl leading-none font-semibold"
        style={{ color: 'var(--accent-1)' }}
      >
        “
      </span>
      {text || '（待填写）'}
    </div>
  );
}

function MethodBody({
  title,
  steps,
}: {
  readonly title: string;
  readonly steps: readonly MethodStep[];
}): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <div className="font-serif text-lg leading-snug font-semibold text-ink">
        {title || '（方法标题）'}
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li
            key={`${step.index}-${i}`}
            className="grid grid-cols-[20px_1fr] gap-2 text-xs leading-relaxed text-ink-3"
          >
            <span className="font-mono text-tiny tracking-loose font-semibold" style={{ color: 'var(--accent-1)' }}>
              {step.index}
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReflectBody({ text }: { readonly text: string }): ReactElement {
  return (
    <p className="font-serif text-sm leading-relaxed text-ink-3 m-0">
      {text || '（待填写）'}
    </p>
  );
}

function MaterialBody({
  rows,
}: {
  readonly rows: readonly MaterialRow[];
}): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div
          key={`${row.key}-${i}`}
          className="grid grid-cols-[auto_1fr] gap-2 text-sm leading-snug text-ink-3"
        >
          <span className="font-mono text-tiny tracking-loose uppercase text-ink-4 pt-1">
            {row.key}
          </span>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// "几秒前 / 几分钟前 / 几小时前 / 几天前" — 简版相对时间. Intl.RelativeTimeFormat
// API 浏览器原生, 不引入 dayjs / date-fns (CLAUDE.md §4 不加新 dep).
function formatAgo(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const month = Math.floor(day / 30);
  return `${month} 个月前`;
}
