import { useCallback, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useDevice } from '@sikao/shared-utils/hooks/useDevice';
import { BottomSheet } from '@sikao/ui/ui/BottomSheet';
import { Drawer } from '@sikao/ui/ui/Drawer';
import { SendIcon } from '@sikao/ui/icons';
import { LLM_QA_COPY } from '@/lib/ui-copy';
import { useAskSession } from '@sikao/domain/llm/useAskSession';
import { AskBubble } from './AskBubble';
import { PromptChips } from './PromptChips';

/**
 * AskDrawer — AI 答疑三态宿主 (PR10, 2026-05-13).
 *
 * SSOT: docs/design/handoff/Mobile and Tablet · Handoff.md §6
 *       + docs/design/Mobile and Tablet Pack New.html M3.
 *
 * 三态契约 (Handoff §6.2):
 *   - mobile  → BottomSheet size='full' (100dvh, 全屏 sheet)
 *   - tablet  → Drawer side='right' (420 width, PR8 默认)
 *   - desktop → Drawer side='right' (480 width, PR8 默认)
 *
 * 6 轮上限 + 24h localStorage TTL: 走 useAskSession hook (state 隔离).
 *
 * 入口契约 (Handoff §6.4 铁线): 只在 Result / WrongBook / PracticeSession
 * 三处出现 — **禁全局 FAB / 顶栏 AI 按钮**. PR10 范围接 Result + WrongBook
 * 两处; PracticeSession 答完后亮 留 PR14 同 spawn fixer 接.
 *
 * LLM endpoint backlog (PR10 prompt 显式): useAskSession.ask 当前只推 user
 * msg, assistant reply 留 BE wire (Slice 2x backend stub). 不阻塞功能 ship.
 */

export interface AskDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** 题目 id, 用于 localStorage key + drawer 标题数字. */
  readonly questionId: string;
  /** drawer 标题数字 (题号), 不传则用 questionId 末尾 3 位作 display. */
  readonly questionNo?: number;
}

interface AskBodyProps {
  readonly questionId: string;
}

function AskInput({
  disabled,
  remaining,
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly remaining: number;
  readonly onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      if (disabled || text.trim() === '') return;
      onSubmit(text);
      setText('');
    },
    [disabled, text, onSubmit],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 pt-3 border-t border-line mt-auto"
      data-testid="ask-input-row"
    >
      <input
        type="text"
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
        placeholder={LLM_QA_COPY.inputPlaceholder}
        disabled={disabled}
        aria-label={LLM_QA_COPY.inputPlaceholder}
        className="flex-1 rounded-pill border border-line-3 bg-paper-1 px-4 py-2 text-sm font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        data-testid="ask-input"
      />
      <button
        type="submit"
        disabled={disabled || text.trim() === ''}
        aria-label={`${LLM_QA_COPY.send} · 剩余 ${remaining} 轮`}
        className="inline-flex items-center justify-center w-10 h-10 rounded-pill bg-ink text-paper-1 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="ask-send"
      >
        <SendIcon size={18} />
      </button>
    </form>
  );
}

function AskBody({ questionId }: AskBodyProps): ReactNode {
  const session = useAskSession(questionId);

  // 主体竖向 stack: messages 列表 + chips + input (固底).
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="ask-messages">
        {session.messages.length === 0 ? (
          <p className="font-serif text-sm text-ink-3 m-0 mb-4">
            {LLM_QA_COPY.emptyHint}
          </p>
        ) : null}
        {session.messages.map((msg) => (
          <AskBubble key={msg.id} message={msg} />
        ))}
        {session.disabled ? (
          // CJK 走 font-serif 不带 italic (CLAUDE.md §4 italic 政策).
          <p
            className="font-serif text-tiny text-ink-3 m-0 mt-4 mb-2"
            data-testid="ask-round-limit"
          >
            {LLM_QA_COPY.askRoundLimit}
          </p>
        ) : null}
      </div>
      <PromptChips disabled={session.disabled} onPick={session.ask} />
      <AskInput
        disabled={session.disabled}
        remaining={session.remaining}
        onSubmit={session.ask}
      />
    </div>
  );
}

function buildTitle(questionId: string, questionNo?: number): string {
  if (questionNo !== undefined) return LLM_QA_COPY.askDrawerTitle(questionNo);
  // questionId 通常是纯数字 string; 取末尾 3 位作 fallback display.
  const tail = questionId.slice(-3);
  const asNum = Number(tail);
  if (!Number.isNaN(asNum)) return LLM_QA_COPY.askDrawerTitle(asNum);
  return LLM_QA_COPY.panelTitle;
}

export function AskDrawer({
  open,
  onClose,
  questionId,
  questionNo,
}: AskDrawerProps) {
  const device = useDevice();
  const title = buildTitle(questionId, questionNo);
  const body = <AskBody questionId={questionId} />;

  if (device === 'mobile') {
    return (
      <BottomSheet open={open} onClose={onClose} title={title} size="full">
        {body}
      </BottomSheet>
    );
  }
  // tablet 420 / desktop 480 由 Drawer 内部解析.
  return (
    <Drawer open={open} onClose={onClose} title={title} side="right">
      {body}
    </Drawer>
  );
}
