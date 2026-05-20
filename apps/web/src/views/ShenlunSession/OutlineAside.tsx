import { useCallback, useId, useState, type ReactElement } from 'react';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';

//
//
// 设计决策 (master 拍板 2026-05-13):
//     原因: layouts/Aside.tsx 是 useAsideOutlet context driven multi-tab
//     (analysis / notes / ask), ShenlunSession 单 panel (大纲) 不需要 outlet
//     解耦. 直接 inline 渲染避免引一套 context infra. 借鉴**视觉 + a11y pattern**
//     (32px collapsed 浮条 + 320 展开 + role=button + tabIndex=0 + aria-label).
//   - **复用 CSS class** `.t-aside.is-collapsed` / `.t-aside__collapse` (src/index.css
//   - 单 textarea, 五段法 prefill 当 default value (用户首次进入时 outline 是骨架,
//     直接在每段下填内容). value 受 shell 控制, onChange 喂回 shell state map.
//   - **frontend/CLAUDE.md §3.7 表单 label 政策**: textarea 必须有 visible label.
//     header `<h2 id={...}>大纲 · 五段法</h2>` 是 visible label, textarea 通过
//     `aria-labelledby` 引用 header id. 不允许 placeholder 替代 label.
//   - **defaultCollapsed prop 单方向 initial** (跟 layouts/Aside.tsx 同 pattern):
//     prop 只在 mount 时影响 initial state, 之后由用户 click 控制. caller 改 prop
//     不强制 reset, 跟 collapsed-aside 既定交互一致.
//
// 不实现 (留给 P5 / 后续 slice):
//   - BE wire 持久化 (P5 useEssayDraft + handwritten_draft_metadata 合并 outline).
//   - 跨题切换的 outline 持久化 (P4 shell 持本地 Record<questionId, outline> state).

export interface OutlineAsideProps {
  readonly questionId: string;
  readonly questionLabel: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  /**
   *
   * - true (默认): 默认 32px 浮条, click / Enter / Space 展开为 320 panel.
   * - false: 直接渲染 320 panel.
   */
  readonly defaultCollapsed?: boolean;
  readonly className?: string;
}

const PANEL_WIDTH = 320;

export default function OutlineAside({
  questionId,
  questionLabel,
  value,
  onChange,
  defaultCollapsed = true,
  className,
}: OutlineAsideProps): ReactElement {
  const reactId = useId();
  const headerDomId = `shenlun-outline-header-${questionId}-${reactId}`;
  const textareaDomId = `shenlun-outline-textarea-${questionId}-${reactId}`;

  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);

  const handleExpand = useCallback((): void => {
    setCollapsed(false);
  }, []);

  const handleCollapse = useCallback((): void => {
    setCollapsed(true);
  }, []);

  const handleBarKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setCollapsed(false);
      }
    },
    [],
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      onChange(e.target.value);
    },
    [onChange],
  );

  // 旋转 90° data-label 走 ::after, 顶部 › 走 ::before. role=button + tabIndex=0
  // + aria-label 让键盘 nav 可触达.
  if (collapsed) {
    return (
      <aside
        className={cn('t-aside is-collapsed', className)}
        data-label={ESSAY_SIKAO_COPY.outlineAsideLabel}
        data-testid="shenlun-outline-aside"
        data-collapsed="true"
        data-question-id={questionId}
        role="button"
        tabIndex={0}
        aria-label={ESSAY_SIKAO_COPY.outlineAsideExpandAria}
        onClick={handleExpand}
        onKeyDown={handleBarKeyDown}
      />
    );
  }

  return (
    <aside
      className={cn('t-aside', className)}
      style={{ width: PANEL_WIDTH }}
      aria-labelledby={headerDomId}
      data-testid="shenlun-outline-aside"
      data-collapsed="false"
      data-question-id={questionId}
    >
      <button
        type="button"
        className="t-aside__collapse"
        aria-label={ESSAY_SIKAO_COPY.outlineAsideCollapseAria}
        data-testid="shenlun-outline-collapse"
        onClick={handleCollapse}
      >
        {/* ASCII editorial 单字符 ‹, italic-allow: 跟 layouts/Aside.tsx 同 pattern,
            CLAUDE.md §4 ASCII editorial 符号合法 italic 例外类目. 这里没加 italic,
            但单字符 ASCII 是设计稿原始 spec. */}
        {'‹'}
      </button>
      <div className="flex flex-col gap-3 min-h-0 flex-1">
        <header className="shrink-0">
          <h2
            id={headerDomId}
            className="font-serif text-ink"
            style={{ fontSize: 14 }} /* hardcode-allow: --t-body 14 panel header, 跟 MaterialPane caption 同档 */
          >
            {ESSAY_SIKAO_COPY.outlineAsideLabel}
          </h2>
          <p
            className="font-serif text-ink-3 mt-1"
            style={{ fontSize: 11 }} /* hardcode-allow: --t-tiny 11 questionLabel sub-caption */
          >
            {questionLabel}
          </p>
        </header>
        <textarea
          id={textareaDomId}
          name={textareaDomId}
          aria-labelledby={headerDomId}
          value={value}
          onChange={handleTextareaChange}
          spellCheck={false}
          placeholder={ESSAY_SIKAO_COPY.outlineAsidePlaceholder}
          data-testid="shenlun-outline-textarea"
          className="flex-1 min-h-0 w-full font-serif text-ink bg-transparent outline-none resize-none"
          style={{
            fontSize: 'var(--read-fs, 17px)',
            lineHeight: 'var(--read-lh, 1.78)',
          }}
        />
      </div>
    </aside>
  );
}
