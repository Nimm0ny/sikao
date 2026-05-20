import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { debounce } from 'lodash-es';
import {
  FormatBoldIcon,
  FormatCodeIcon,
  FormatItalicIcon,
  FormatListIcon,
  LinkIcon,
} from '@sikao/ui/icons';
import { Button, Modal, Tooltip } from '@sikao/ui/ui';
import { logger } from '@sikao/shared-utils';
import {
  deleteQuestionNote,
  fetchQuestionNote,
  noteKeys,
  putQuestionNote,
} from '@sikao/api-client/apiQueries';
import type { QuestionNoteV2 } from '@sikao/api-client/types/api';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// Phase 3.9 fenbi-merge — 题级笔记编辑 modal (markdown).
//
// D-决策降级: 不引 tiptap, contenteditable 也不上 — 用 textarea + markdown.
// 富文本 / qlink 都用 markdown 语法表达:
//   **粗体** *斜体* ## 标题 - 列表 `code` [[#017]] qlink
// FE 渲染时 (笔记列表 / 解析页) 走 markdown parser, 这里只管编辑源文.
//
// 自动保存: 用户停止打字 1.5s 后 PUT (debounce). 关闭 modal 立即 flush.
// "保存中" 文案 follow input, 不挡视线.

const AUTOSAVE_DEBOUNCE_MS = 1500;

// hardcode-allow: markdown qlink syntax sample (`[[#017]]`), not a CSS color literal.
// lint:hardcode 误报 `#017` 为 hex 颜色 (3-digit hex), 实际是题号引用 markdown 语法.
const MODAL_DESCRIPTION = `支持 markdown 语法; ${PRACTICE_COPY.noteEditorQuestionLabel} [[#017]] 写法`; // hardcode-allow: markdown qlink syntax sample, not a CSS color
const NOTE_PLACEHOLDER = `${PRACTICE_COPY.noteEditorPlaceholder} 粗体 **xx** / 列表 - / 标题 ## / 关联题 [[#017]]`; // hardcode-allow: markdown qlink syntax sample, not a CSS color

export interface NoteEditorProps {
  readonly open: boolean;
  readonly questionId: number | string | null;
  readonly questionNo?: number;
  readonly onClose: () => void;
  /** 关联题点击 — 由 caller 注入 qlink picker, NoteEditor 只插 markdown. */
  readonly onPickQlink?: () => void;
}

export function NoteEditor(props: NoteEditorProps) {
  const { open, questionId, questionNo, onClose, onPickQlink } = props;
  // 用 EditorBody key={initKey} 让 modal 打开 / questionId 切换时完整 remount
  // — useState lazy initializer 拿初始 content. 避开 React 19 lint 对
  // useEffect+setState 和渲染期 ref.current 访问的限制.
  const headerTitle =
    questionNo !== undefined ? `第 ${questionNo} 题 · 笔记` : '笔记';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={headerTitle}
      description={MODAL_DESCRIPTION}
      size="md"
    >
      {open && questionId !== null ? (
        <EditorBody
          key={`${questionId}`}
          questionId={questionId}
          onClose={onClose}
          onPickQlink={onPickQlink}
        />
      ) : null}
    </Modal>
  );
}

interface EditorBodyProps {
  readonly questionId: number | string;
  readonly onClose: () => void;
  readonly onPickQlink?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function EditorBody({ questionId, onClose, onPickQlink }: EditorBodyProps) {
  const queryClient = useQueryClient();
  const queryKey: QueryKey = noteKeys.byQuestion(questionId);

  const noteQuery = useQuery<QuestionNoteV2>({
    queryKey,
    queryFn: () => fetchQuestionNote(questionId),
    staleTime: 60_000,
  });

  if (noteQuery.isLoading || noteQuery.data === undefined) {
    return (
      <div className="py-8 text-center text-sm text-ink-3" data-testid="note-editor-loading">
        加载中…
      </div>
    );
  }

  return (
    <EditorBodyLoaded
      questionId={questionId}
      initialContent={noteQuery.data.content}
      hasExisting={noteQuery.data.hasNote}
      queryKey={queryKey}
      queryClient={queryClient}
      onClose={onClose}
      onPickQlink={onPickQlink}
    />
  );
}

interface EditorBodyLoadedProps {
  readonly questionId: number | string;
  readonly initialContent: string;
  readonly hasExisting: boolean;
  readonly queryKey: QueryKey;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly onClose: () => void;
  readonly onPickQlink?: () => void;
}

function EditorBodyLoaded({
  questionId,
  initialContent,
  hasExisting,
  queryKey,
  queryClient,
  onClose,
  onPickQlink,
}: EditorBodyLoadedProps) {
  const [draft, setDraft] = useState(initialContent);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useMutation({
    mutationFn: (content: string) => putQuestionNote(questionId, { content }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      setStatus('saved');
    },
    onError: (err) => {
      logger.error('note.save.failed', { questionId, err: String(err) });
      setStatus('error');
    },
  });

  // lodash debounce — useMemo 防 re-render 重建. mutation.mutate 引用稳定
  // (React Query), 不需进 deps.
  const debouncedSave = useMemo(
    () =>
      debounce((content: string) => {
        mutation.mutate(content);
      }, AUTOSAVE_DEBOUNCE_MS),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation 引用稳定
    [],
  );
  // unmount / 关闭 modal 时立即 flush 还在等的 debounced save + cancel timer
  useEffect(() => {
    return () => {
      debouncedSave.flush();
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleChange = (next: string): void => {
    setDraft(next);
    setStatus('saving');
    debouncedSave(next);
  };

  const insertAtCursor = (
    before: string,
    after: string = '',
    placeholder: string = '',
  ): void => {
    const ta = textareaRef.current;
    if (ta === null) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = draft.slice(start, end) || placeholder;
    const next = draft.slice(0, start) + before + selected + after + draft.slice(end);
    handleChange(next);
    requestAnimationFrame(() => {
      if (textareaRef.current === null) return;
      const cursor = start + before.length + selected.length + after.length;
      textareaRef.current.setSelectionRange(cursor, cursor);
      textareaRef.current.focus();
    });
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuestionNote(questionId),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, {
        hasNote: false,
        content: '',
        updatedAt: null,
      } satisfies QuestionNoteV2);
      onClose();
    },
    // review-fix #2 P1: 不能 silent fail — 至少 logger 留痕 + status 反馈
    onError: (err) => {
      logger.error('note.delete.failed', { questionId, err: String(err) });
      setStatus('error');
    },
  });

  return (
    <>
      <Toolbar onInsert={insertAtCursor} onPickQlink={onPickQlink} />
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={NOTE_PLACEHOLDER}
        aria-label="题目笔记"
        className="mt-3 w-full min-h-64 resize-y rounded-card border border-line bg-surface p-3 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
        data-testid="note-editor-textarea"
      />
      <div className="mt-3 flex w-full items-center justify-between">
        <SaveStatusChip status={status} />
        <div className="flex gap-2">
          {hasExisting ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              isLoading={deleteMutation.isPending}
              data-testid="note-editor-delete"
            >
              删除笔记
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              debouncedSave.flush();
              onClose();
            }}
            data-testid="note-editor-close"
          >
            完成
          </Button>
        </div>
      </div>
    </>
  );
}

interface ToolbarProps {
  readonly onInsert: (before: string, after?: string, placeholder?: string) => void;
  readonly onPickQlink?: () => void;
}

function Toolbar({ onInsert, onPickQlink }: ToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-line pb-2"
      role="toolbar"
      aria-label="笔记格式"
    >
      <ToolbarButton label="粗体" onClick={() => onInsert('**', '**', '加粗')}>
        <FormatBoldIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton label="斜体" onClick={() => onInsert('*', '*', '斜体')}>
        <FormatItalicIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton label="列表" onClick={() => onInsert('- ')}>
        <FormatListIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton label="代码" onClick={() => onInsert('`', '`', 'code')}>
        <FormatCodeIcon className="w-4 h-4" />
      </ToolbarButton>
      {onPickQlink !== undefined ? (
        <ToolbarButton label="关联题号" onClick={onPickQlink} testId="note-editor-qlink">
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
      ) : null}
    </div>
  );
}

interface ToolbarButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly testId?: string;
}

function ToolbarButton({ label, onClick, children, testId }: ToolbarButtonProps) {
  return (
    <Tooltip label={label}>
      {/* svg-only-allow: design system primitive; children 由 caller 注入 SVG icon (Link2 / Bold etc.) */}
      <button
        type="button"
        aria-label={label}
        // review-fix #1 P0: onMouseDown preventDefault 阻止 button 抢焦 → 让
        // textarea 保持 selection. 否则点工具栏 textarea blur, selectionStart/End
        // 都重置为 0, insertAtCursor 把文本插到开头而非用户原本光标位置.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="inline-flex h-8 w-8 items-center justify-center rounded-tiny text-ink-3 hover:bg-surface-alt hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid={testId}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function SaveStatusChip({ status }: { readonly status: SaveStatus }) {
  if (status === 'idle') return <span />;
  const tone =
    status === 'saving'
      ? 'text-ink-3'
      : status === 'saved'
        ? 'text-ok'
        : 'text-err';
  const text =
    status === 'saving' ? '保存中…' : status === 'saved' ? '已保存' : '保存失败';
  return (
    <span className={`text-xs ${tone}`} data-testid="note-editor-status">
      {text}
    </span>
  );
}
