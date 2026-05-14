/**
 * SIKAO Wave 6E · NoteCaptureModal — 跨模块"添加到笔记"快速捕获 modal.
 *
 * 接 ac87f2f BE (`POST /api/v2/notebook/notes`) 通过 useCreateNote mutation
 * (notebookQueries d643155). 跟 CaptureBar (顶部 sticky 输入条) / NoteEditor
 * (题级 markdown 笔记) 是不同 channel:
 *   - CaptureBar: NotesHome 内"无 attach"快速写
 *   - NoteEditor: 题级 markdown 草稿 (走 /api/v2/practice/notes/{questionId})
 *   - 本 modal: 跨域 attached 笔记 (Z2 NoteAttachedToV2 schema). 用户在 xingce
 *     做题 / 申论作答 / 错题复盘时单击 ✎ → 自动 pre-fill source_quote +
 *     attachedTo, 提交即生成笔记.
 *
 * Spec: docs/plan/sikao-redesign.md Wave 6E (lhr 2026-05-12 自治).
 *
 * Dumb-ish: 自管 form state (type / body / tags), 提交走 useCreateNote
 * mutation, onSuccess 回调 caller. 三态: idle / submitting / error.
 * Fail-Fast: mutation error 由 useMutation 暴露 → 内联 error chip, 不 silent.
 */
import { useState, type ReactElement } from 'react';
import { Button, Modal } from '@sikao/ui/ui';
import { FieldSelect, FieldTextarea } from './NoteEditorFields';
import {
  useCreateNote,
  type NoteAttachedToV2,
  type NoteCreateV2,
  type NoteOutV2,
  type NoteSourceDomain,
  type NoteType,
} from '@sikao/api-client/queries/notebookQueries';
import { logger } from '@sikao/shared-utils';
import { cn } from '@sikao/shared-utils';

// ── attach target FE-local discriminator ─────────────────────────────────────
//
// NoteAttachedToV2 schema 是 4 个 ID array (paperIds / questionTypeIds /
// wrongAnswerIds / xingceQuestionIds). caller 不需要管 schema 形状 — 只关心
// "这条笔记关联哪种实体". 本 Launcher API 接 kind+refId, 内部映射成 schema.

export type NoteAttachTargetKind =
  | 'xingce_question'
  | 'essay_question'
  | 'wrong_question';

export interface NoteAttachTarget {
  readonly kind: NoteAttachTargetKind;
  /** 实体 ID. xingce_question / essay_question 是 number, wrong_question 是 number. */
  readonly refId: number;
  /** 可选: caller 已知 sourceDomain → 默认 form 用此值. 否则从 kind 推导. */
  readonly sourceDomain?: NoteSourceDomain;
  /** 可选: caller 已知 sourceRef (e.g. "2023 国考·副省·第 3 题") → 默认 form. */
  readonly sourceRef?: string;
}

function buildAttachedTo(target: NoteAttachTarget): NoteAttachedToV2 {
  switch (target.kind) {
    case 'xingce_question':
      return { xingceQuestionIds: [target.refId] };
    case 'wrong_question':
      return { wrongAnswerIds: [target.refId] };
    case 'essay_question':
      // essay 走 questionTypeIds (BE schema 暂无独立 essay_question_id 字段,
      // 跟 paperIds 跨域 attach 二选一). caller 传 paperId 时改 paperIds.
      return { questionTypeIds: [String(target.refId)] };
    default:
      throw new Error(`unknown NoteAttachTargetKind: ${String(target.kind)}`);
  }
}

function defaultSourceDomain(target: NoteAttachTarget): NoteSourceDomain {
  if (target.sourceDomain !== undefined) return target.sourceDomain;
  if (target.kind === 'essay_question') return 'essay';
  return 'xingce';
}

function defaultSourceRef(target: NoteAttachTarget): string {
  if (target.sourceRef !== undefined && target.sourceRef.length > 0) {
    return target.sourceRef;
  }
  switch (target.kind) {
    case 'xingce_question':
      return `行测题 #${target.refId}`;
    case 'wrong_question':
      return `错题 #${target.refId}`;
    case 'essay_question':
      return `申论题 #${target.refId}`;
  }
}

function attachLabel(target: NoteAttachTarget): string {
  switch (target.kind) {
    case 'xingce_question':
      return `关联行测题 #${target.refId}`;
    case 'wrong_question':
      return `关联错题 #${target.refId}`;
    case 'essay_question':
      return `关联申论题 #${target.refId}`;
  }
}

const TYPE_OPTS: ReadonlyArray<{ value: NoteType; label: string }> = [
  { value: 'quote', label: '金句' },
  { value: 'method', label: '方法' },
  { value: 'reflect', label: '反思' },
  { value: 'material', label: '素材' },
];

const TYPE_PLACEHOLDER: Record<NoteType, string> = {
  quote: '记下打动你的那一句…',
  method: '总结一种可复用的方法…',
  reflect: '为什么这道题出错? 这次有什么启发?',
  material: '记录一段素材 / 案例…',
};

// ── props ────────────────────────────────────────────────────────────────────

export interface NoteCaptureModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly target: NoteAttachTarget;
  readonly defaultSourceQuote?: string;
  readonly defaultType?: NoteType;
  readonly onCreated?: (note: NoteOutV2) => void;
  readonly testId?: string;
}

// 截 100 char 防大段 quote 撑爆 chip + BE sourceQuote 字段
function truncateQuote(quote: string | undefined): string | undefined {
  if (quote === undefined) return undefined;
  const trimmed = quote.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length <= 100) return trimmed;
  return `${trimmed.slice(0, 100)}…`;
}

export function NoteCaptureModal({
  open,
  onClose,
  target,
  defaultSourceQuote,
  defaultType = 'reflect',
  onCreated,
  testId,
}: NoteCaptureModalProps): ReactElement {
  const [type, setType] = useState<NoteType>(defaultType);
  const [body, setBody] = useState('');
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const createMutation = useCreateNote();

  // open / target 切换时 reset form 用 derived-state-from-prop pattern
  // (React 官方推荐, 跟 FbCard.useArmedPulse 同款), 避开 useEffect+setState
  // (react-hooks/set-state-in-effect 在 React 19 strict 下报错).
  const sessionKey = `${open ? '1' : '0'}|${target.kind}|${target.refId}`;
  const [lastSessionKey, setLastSessionKey] = useState(sessionKey);
  if (sessionKey !== lastSessionKey) {
    setLastSessionKey(sessionKey);
    if (open) {
      setType(defaultType);
      setBody('');
      setQuoteExpanded(false);
      createMutation.reset();
    }
  }

  const quote = truncateQuote(defaultSourceQuote);

  const canSubmit = body.trim().length > 0 && !createMutation.isPending;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    const payload: NoteCreateV2 = {
      type,
      // body shape: text-based (quote/reflect) 直接 { text }, method/material
      // 模板太重不适合"快速捕获" — 6E modal 都用 text body. caller 想结构化
      // 走 NotesHome 主编辑器 (/notes/:id/edit).
      body: { text: body.trim() },
      sourceKind: 'practice',
      sourceRef: defaultSourceRef(target),
      sourceDomain: defaultSourceDomain(target),
      ...(quote !== undefined ? { sourceQuote: quote } : {}),
      title: '',
      tags: [],
      visibility: 'self',
      attachedTo: buildAttachedTo(target),
    };
    createMutation.mutate(payload, {
      onSuccess: (note) => {
        onCreated?.(note);
        onClose();
      },
      onError: (err) => {
        logger.error('notebook.capture.create.failed', {
          err: String(err),
          targetKind: target.kind,
          targetId: target.refId,
        });
      },
    });
  };

  const footer = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        disabled={createMutation.isPending}
        data-testid="note-capture-modal-cancel"
      >
        取消
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        isLoading={createMutation.isPending}
        disabled={!canSubmit}
        data-testid="note-capture-modal-submit"
      >
        保存笔记
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="添加到笔记"
      description="记下这一刻的灵感, 关联当前题目自动 attach."
      size="md"
      footer={footer}
      ariaLabel="添加到笔记"
    >
      <div
        className="flex flex-col gap-4"
        data-testid={testId ?? 'note-capture-modal'}
      >
        {/* attached chip — readonly, 显 caller 传入的 target */}
        <div
          className={cn(
            'inline-flex items-center gap-2 self-start px-3 py-1 rounded-tiny',
            'bg-surface-alt border border-line',
            'font-mono text-tiny tracking-wider uppercase text-ink-3',
          )}
          data-testid="note-capture-modal-attached"
        >
          <span aria-hidden="true">→</span>
          {attachLabel(target)}
        </div>

        {/* source quote — caller 传 → 默认 fold, 点击展开. 不可改, 提交时入 sourceQuote */}
        {quote !== undefined ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setQuoteExpanded((v) => !v)}
              className={cn(
                'self-start font-mono text-tiny tracking-wider uppercase',
                'text-ink-4 hover:text-ink-3',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
              data-testid="note-capture-modal-quote-toggle"
              aria-expanded={quoteExpanded}
            >
              {quoteExpanded ? '收起原文 ▴' : '查看原文 ▾'}
            </button>
            {quoteExpanded ? (
              <blockquote
                className="px-3 py-2 bg-paper-3 border-l-2 border-line-3 font-serif text-sm leading-relaxed text-ink-3 m-0"
                data-testid="note-capture-modal-quote-body"
              >
                {quote}
              </blockquote>
            ) : null}
          </div>
        ) : null}

        <FieldSelect
          label="类型"
          value={type}
          onChange={(v) => setType(v as NoteType)}
          options={TYPE_OPTS}
          testId="note-capture-modal-type"
        />

        <FieldTextarea
          label="笔记内容"
          value={body}
          onChange={setBody}
          placeholder={TYPE_PLACEHOLDER[type]}
          rows={6}
          testId="note-capture-modal-body"
        />

        {createMutation.isError ? (
          <div
            role="alert"
            className="px-3 py-2 bg-bad-bg border-l-2 border-err font-mono text-tiny tracking-wider text-err"
            data-testid="note-capture-modal-error"
          >
            保存失败, 请稍后重试
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
