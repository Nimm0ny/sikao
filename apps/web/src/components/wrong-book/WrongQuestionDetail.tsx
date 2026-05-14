import { useState } from 'react';
import DOMPurify from 'dompurify';
import { Badge, Button, MetaPair, OptionRow } from '@sikao/ui/ui';
import { ChatPanel } from '@/components/llm/ChatPanel';
import { LLM_QA_COPY } from '@/lib/ui-copy';
import type { MasteryLevel, WrongQuestionDetailV2 } from '@sikao/api-client/types/api';

// Phase 5.4e — 右栏详情面板。editorial 风：
//   顶部 meta chips / 题干 / OptionRow + status 染色 / 解析 / 错题时间轴（轻量）
//   + 重做按钮（primary）
//
// 错因归纳（element plan §1 明确本阶段不做）→ 占位提示框"解析服务即将上线"。

const MASTERY_META: Record<
  MasteryLevel,
  { readonly label: string; readonly tone: 'danger' | 'warn' | 'success' }
> = {
  not_mastered: { label: '未掌握', tone: 'danger' },
  reviewing: { label: '复习中', tone: 'warn' },
  mastered: { label: '已掌握', tone: 'success' },
};

function formatLastWrong(isoStr: string): string {
  const d = new Date(isoStr);
  if (!Number.isFinite(d.valueOf())) return '';
  // 省略秒，保持 editorial 干净。
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}`;
}

export interface WrongQuestionDetailProps {
  readonly item: WrongQuestionDetailV2;
  readonly onRetry: (questionId: number) => void;
  readonly isRetrying: boolean;
  /** P0-4: list 内 prev/next navigation. undefined 表示无更多 (button disable). */
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
}

export function WrongQuestionDetail({
  item,
  onRetry,
  isRetrying,
  onPrev,
  onNext,
}: WrongQuestionDetailProps) {
  const meta = MASTERY_META[item.masteryLevel];
  const userKeysSet = new Set(item.userLatestAnswerKeys);
  const correctKeysSet = new Set(item.correctAnswerKeys);
  // Slice 1b: 解析问答入口. context_kind='question' + question.id 让 backend
  // 抓 stem + options + answer 注入 prompt context.
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <aside
      className="bg-surface border border-line rounded-card flex flex-col overflow-hidden"
      data-testid="wrong-question-detail"
    >
      {/* 头：状态 + meta */}
      <header className="px-5 py-4 border-b border-line flex flex-col gap-3">
        <div className="flex items-center flex-wrap gap-2">
          <Badge tone={meta.tone} variant="hairline" dot>
            {meta.label}
          </Badge>
          <span className="text-tiny font-mono text-ink-4 tracking-eyebrow">
            连续答对 <span className="font-serif italic text-ink text-sm">{item.consecutiveCorrectCount}</span>
          </span>
          <span className="text-tiny font-mono text-ink-4 tracking-eyebrow">
            · 累计错 <span className="font-serif italic text-err text-sm">{item.wrongCount}</span> 次
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.subject != null ? <MetaPair label="科目">{item.subject}</MetaPair> : null}
          <MetaPair label="题型">{item.questionKind}</MetaPair>
          {item.paperCode != null ? <MetaPair label="来源">{item.paperCode}</MetaPair> : null}
        </div>
        <div className="text-tiny text-ink-3">
          上次错于 <span className="font-mono tabular-nums text-ink">{formatLastWrong(item.lastWrongTime)}</span>
        </div>
      </header>

      {/* 题干 + 选项 */}
      <section className="px-5 py-4 flex-1 overflow-y-auto">
        <div
          className="text-md leading-relaxed text-ink mb-4 [&_p]:mb-2 last:[&_p]:mb-0"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.stem) }}
        />

        <div className="mb-5">
          {item.options.map((opt, idx) => {
            const selectedByUser = userKeysSet.has(opt.key);
            const isCorrect = correctKeysSet.has(opt.key);
            const status = isCorrect
              ? 'correct'
              : selectedByUser
                ? 'wrong'
                : 'neutral';
            return (
              <OptionRow
                key={opt.key}
                optionKey={opt.key}
                text={opt.text}
                selected={selectedByUser}
                status={status as 'correct' | 'wrong' | 'neutral'}
                last={idx === item.options.length - 1}
                disabled
              />
            );
          })}
        </div>

        {item.explanation !== '' ? (
          <div className="bg-surface-alt border-l-2 border-l-ink px-4 py-3 text-sm leading-relaxed text-ink">
            <b className="text-ink font-bold mr-2">解析</b>
            <span
              className="[&_p]:inline"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.explanation) }}
            />
          </div>
        ) : null}

        {/* Slice 1b: 解析问答入口替换原"错因归纳即将上线"占位. */}
        <div className="mt-4 flex items-center justify-between border border-line px-4 py-3 rounded-card">
          <div>
            <span className="text-tiny font-mono font-semibold tracking-wider uppercase text-ink-4 mr-2">
              解析问答
            </span>
            <span className="text-sm text-ink-3">
              基于这道题的题干 / 选项 / 正确答案对话, 5 类意图可选.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setChatOpen(true)}
            data-testid="wrong-detail-ask-analysis"
          >
            {LLM_QA_COPY.askButton}
          </Button>
        </div>
      </section>

      {/* 底部 retry CTA + P0-4 prev/next navigation */}
      <footer className="px-5 py-4 border-t border-line flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="quiet"
            size="sm"
            disabled={onPrev === undefined}
            onClick={onPrev}
            data-testid="wrong-detail-prev"
            aria-label="上一题"
          >
            <span className="font-serif italic mr-1" aria-hidden="true">←</span>
            <span>上一题</span>
          </Button>
          <span className="text-xs text-ink-4 font-mono tabular-nums" aria-live="polite">
            ↑↓ 切题
          </span>
          <Button
            variant="quiet"
            size="sm"
            disabled={onNext === undefined}
            onClick={onNext}
            data-testid="wrong-detail-next"
            aria-label="下一题"
          >
            <span>下一题</span>
            <span className="font-serif italic ml-1" aria-hidden="true">→</span>
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-3">做对 2 次自动标记为已掌握</span>
          <Button
            variant="primary"
            size="md"
            isLoading={isRetrying}
            onClick={() => onRetry(item.questionId)}
            data-testid="wrong-book-retry"
          >
            {isRetrying ? '启动中…' : '重做这道题'}
          </Button>
        </div>
      </footer>
      {/* key={item.questionId} 让 React 在切换不同错题时重建 ChatPanel 实例,
          重置 conversationId / messages / draft 等内部 state. 否则同 instance
          复用让上一题的会话续到新题 (Slice 1b-1 2nd review P1 #1). */}
      <ChatPanel
        key={item.questionId}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        contextKind="question"
        contextId={item.questionId}
        title={null}
      />
    </aside>
  );
}
