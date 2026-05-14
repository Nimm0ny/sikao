import { useState, type ReactElement } from 'react';
import { Button } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import {
  useCommunityNoteComments,
  useCreateNoteComment,
  type CommunityNoteComment,
} from '@sikao/domain/notes/useCommunityNotes';

/**
 * SIKAO Wave 10 Phase C · NoteCommentsList — 评论 + 一级嵌套.
 *
 * 设计 SSOT: lhr 决议 (mobile-style-guide §3.2 + B13) — 评论一级嵌套
 * (parent_comment_id nullable 单层). BE schema: NoteCommentOutV2 (apps/exam-api/
 * app/domain/schemas.py L2104).
 *
 * Mock 阶段: comments 从 useCommunityNoteComments(noteId) 拉静态 sample.
 * submit 走 local state (no-op append), Phase B 后改 useMutation POST
 * /api/v2/notes/{id}/comments.
 *
 * 调性 (docs/design/style-guide.md §1.3): "图书馆隔壁桌的同学" — 中性陈述,
 * 不打鸡血. 禁词 emoji / 双感叹号.
 */

export interface NoteCommentsListProps {
  readonly noteId: number;
  readonly testId?: string;
}

const MAX_COMMENT_LENGTH = 500;

export function NoteCommentsList({
  noteId,
  testId,
}: NoteCommentsListProps): ReactElement {
  const { data } = useCommunityNoteComments(noteId);
  const createComment = useCreateNoteComment();
  const [draft, setDraft] = useState('');

  // 一级嵌套结构: parent comment + 其 child. 顶层 comment = parentCommentId === null.
  // 多层嵌套时 grand-child 拍平到 child 同层 (BE Phase B service 校验
  // parent.parent_id IS NULL 拒绝 grand-child, FE 兜底).
  const items: readonly CommunityNoteComment[] = data?.items ?? [];
  const topLevel = items.filter((c) => c.parentCommentId === null);

  function getReplies(parentId: number): readonly CommunityNoteComment[] {
    return items.filter((c) => c.parentCommentId === parentId);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_COMMENT_LENGTH) return;
    if (createComment.isPending) return;
    // POST /api/v2/notebook/notes/{id}/comments — 一级嵌套顶层 (parent_comment_id null).
    // onSuccess 由 hook 内 invalidate 重拉 comments, draft 在 mutation 成功后清空.
    createComment.mutate(
      { noteId, payload: { content: trimmed, parentCommentId: null } },
      {
        onSuccess: () => {
          setDraft('');
        },
      },
    );
  }

  return (
    <div
      data-testid={testId ?? `community-note-comments-${noteId}`}
      className="mt-4 pt-4 border-t border-dashed border-line space-y-3"
    >
      {topLevel.length === 0 ? (
        <p className="text-sm text-ink-4">
          还没有评论, 写一条 →
        </p>
      ) : (
        <ul className="space-y-3 list-none m-0 p-0">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
            />
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={`comment-textarea-${noteId}`}>
          写一条评论
        </label>
        {/* a11y: cross-node <label htmlFor> + <textarea id> 是 W3C 标准 a11y pattern.
            plugin 不识别, 行级 escape. */}
        {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
        <textarea
          id={`comment-textarea-${noteId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={2}
          placeholder="写一条评论 (最多 500 字)"
          className={cn(
            'w-full bg-surface-alt border border-line rounded-card px-3 py-2',
            'text-sm text-ink placeholder:text-ink-4',
            'focus:outline-none focus:border-ink resize-none',
          )}
          data-testid={`community-note-comment-input-${noteId}`}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-4 font-mono tabular-nums">
            {draft.length} / {MAX_COMMENT_LENGTH}
          </span>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={draft.trim().length === 0 || createComment.isPending}
            data-testid={`community-note-comment-submit-${noteId}`}
          >
            {createComment.isPending ? '发布中…' : '发布'}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface CommentItemProps {
  readonly comment: CommunityNoteComment;
  readonly replies: readonly CommunityNoteComment[];
}

function CommentItem({ comment, replies }: CommentItemProps): ReactElement {
  const displayName = comment.userDisplayName ?? '匿名同学';
  const ago = formatAgo(comment.createdAt);
  return (
    <li className="space-y-2">
      <div className="flex items-start gap-3">
        <Avatar name={displayName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink">{displayName}</span>
            <span className="text-xs text-ink-4 font-mono tabular-nums">
              {ago}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-3 m-0 whitespace-pre-wrap">
            {comment.content}
          </p>
        </div>
      </div>
      {replies.length > 0 ? (
        <ul className="ml-11 space-y-2 list-none m-0 p-0 pl-3 border-l border-line">
          {replies.map((reply) => {
            const replyName = reply.userDisplayName ?? '匿名同学';
            return (
              <li
                key={reply.id}
                className="flex items-start gap-2"
              >
                <Avatar name={replyName} small />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ink">{replyName}</span>
                    <span className="text-xs text-ink-4 font-mono tabular-nums">
                      {formatAgo(reply.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-3 m-0 whitespace-pre-wrap">
                    {reply.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

function Avatar({
  name,
  small = false,
}: {
  readonly name: string;
  readonly small?: boolean;
}): ReactElement {
  const initial = name.length > 0 ? name.slice(0, 1) : '?';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'shrink-0 rounded-pill inline-flex items-center justify-center',
        'bg-surface-alt text-ink text-xs font-medium',
        small ? 'w-6 h-6' : 'w-8 h-8',
      )}
    >
      {initial}
    </span>
  );
}

/** 跟 NoteCard.formatAgo 同款相对时间. 不抽到 lib/ 因这是 wrapper 周边小工具,
 *  抽出来会让 lib/ 多一个低复用 export. CLAUDE.md §4 SRP. */
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
