import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import {
  CommentIcon,
  FlagIcon,
  HeartFilledIcon,
  HeartIcon,
  StarFilledIcon,
  StarIcon,
} from '@sikao/ui/icons';
import { NoteCommentsList } from './NoteCommentsList';
import {
  useToggleFavorite,
  useToggleLike,
  type CommunityNote,
} from '@sikao/domain/notes/useCommunityNotes';

/**
 * SIKAO Wave 10 Phase C · CommunityNoteCard — 题目下方"同学的笔记"单卡.
 *
 * 跟 NoteCard.tsx (Wave 4 Phase 2D) 区别:
 *   - NoteCard      = 我的笔记本 (private CRUD, 4 type 完整渲染 body)
 *   - CommunityNote = 公开社区笔记 (others 的 + 点赞/评论/收藏/举报 social UI)
 *
 * design SSOT: lhr 决议 (mobile-style-guide §3.2 + B13). 默认匿名 — userDisplayName
 * null 时渲染 "匿名同学". 调性 (docs/design/style-guide.md §1.3) 中性陈述,
 * 不打鸡血.
 *
 * Mock 阶段: toggleLike / toggleFavorite / report 走 local state, Phase B 后
 * 改 useMutation POST /api/v2/notes/{id}/like (etc).
 *
 * SVG-only 政策: footer 4 action 按钮全部 svg + Tooltip + aria-label, 不带文字
 * label (CLAUDE.md §4 答题流 SVG-only — 这条卡是 wrong-question-detail 子组件
 * 出现在答题相关 view, 沿用同款 SVG-only 政策).
 */

export interface CommunityNoteCardProps {
  readonly note: CommunityNote;
  readonly testId?: string;
}

export function CommunityNoteCard({
  note,
  testId,
}: CommunityNoteCardProps): ReactElement {
  // Optimistic local state: 用户点击立即反馈, useMutation onSuccess 拿真值;
  // invalidateQueries 会重拉 note 列表, 用户感知最终一致. (跟
  // NotePublicListItemV2.likedByMe / favoritedByMe / likesCount 同步初值.)
  const [liked, setLiked] = useState(note.likedByMe);
  const [favorited, setFavorited] = useState(note.favoritedByMe);
  const [likesCount, setLikesCount] = useState(note.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [reported, setReported] = useState(false);

  const toggleLike = useToggleLike();
  const toggleFavorite = useToggleFavorite();

  function onToggleLike(): void {
    // Optimistic UI 先翻状态, mutation 真发 BE.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikesCount((n) => Math.max(0, n + (nextLiked ? 1 : -1)));
    toggleLike.mutate(note.id, {
      onSuccess: (data) => {
        // BE 真值回写 (并发场景兜底).
        setLiked(data.liked);
        setLikesCount(data.likesCount);
      },
      onError: () => {
        // 失败回滚 optimistic 翻转.
        setLiked(liked);
        setLikesCount(note.likesCount);
      },
    });
  }

  function onToggleFavorite(): void {
    const nextFavorited = !favorited;
    setFavorited(nextFavorited);
    toggleFavorite.mutate(note.id, {
      onSuccess: (data) => {
        setFavorited(data.favorited);
      },
      onError: () => {
        setFavorited(favorited);
      },
    });
  }

  function onToggleComments(): void {
    setShowComments((v) => !v);
  }

  function onReport(): void {
    // 举报 endpoint (POST /api/v2/notebook/reports) 是 Wave 10 Phase D admin
    // slice, 当前先单击 mark reported (visual feedback only). SIKAO 调性不弹
    // toast 喊"举报成功", icon 转 ink-strong 已是反馈.
    setReported(true);
  }

  const displayName = note.userDisplayName ?? '匿名同学';
  const ago = formatAgo(note.publicAt ?? note.createdAt);

  return (
    <article
      data-testid={testId ?? `community-note-card-${note.id}`}
      data-note-id={note.id}
      className={cn(
        'bg-surface border border-line rounded-card px-5 py-4',
        'flex flex-col gap-3',
        'transition-[border-color] duration-fast ease-motion',
        'hover:border-line-3',
      )}
    >
      <header className="flex items-center gap-3">
        <Avatar name={displayName} />
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-sm font-medium text-ink truncate">
            {displayName}
          </span>
          <time
            className="text-xs text-ink-4 font-mono tabular-nums"
            dateTime={note.publicAt ?? note.createdAt}
          >
            {ago}
          </time>
        </div>
        <TypeBadge type={note.type} />
      </header>

      <NoteBodyPreview note={note} />

      {note.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {note.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-surface-alt text-xs text-ink-3 rounded-tiny"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <footer className="flex items-center gap-1 pt-2 border-t border-dashed border-line">
        <Tooltip label={liked ? '取消点赞' : '点赞'}>
          <IconBtn
            type="button"
            aria-label={liked ? '取消点赞' : '点赞'}
            aria-pressed={liked}
            variant={liked ? 'on' : 'default'}
            onClick={onToggleLike}
            data-testid={`community-note-like-${note.id}`}
            className={liked ? 'text-err' : undefined}
          >
            {liked ? (
              <HeartFilledIcon size={16} />
            ) : (
              <HeartIcon size={16} />
            )}
          </IconBtn>
        </Tooltip>
        <span
          className="text-xs text-ink-3 font-mono tabular-nums min-w-[2ch] mr-2"
          data-testid={`community-note-likes-count-${note.id}`}
        >
          {likesCount}
        </span>

        <Tooltip label={showComments ? '收起评论' : '查看评论'}>
          <IconBtn
            type="button"
            aria-label={showComments ? '收起评论' : '查看评论'}
            aria-expanded={showComments}
            variant={showComments ? 'on' : 'default'}
            onClick={onToggleComments}
            data-testid={`community-note-comments-toggle-${note.id}`}
          >
            <CommentIcon size={16} />
          </IconBtn>
        </Tooltip>
        <span
          className="text-xs text-ink-3 font-mono tabular-nums min-w-[2ch] mr-2"
          data-testid={`community-note-comments-count-${note.id}`}
        >
          {note.commentsCount}
        </span>

        <Tooltip label={favorited ? '取消收藏' : '收藏'}>
          <IconBtn
            type="button"
            aria-label={favorited ? '取消收藏' : '收藏'}
            aria-pressed={favorited}
            variant={favorited ? 'on' : 'default'}
            onClick={onToggleFavorite}
            data-testid={`community-note-favorite-${note.id}`}
            className={favorited ? 'text-ink' : undefined}
          >
            {favorited ? (
              <StarFilledIcon size={16} />
            ) : (
              <StarIcon size={16} />
            )}
          </IconBtn>
        </Tooltip>

        <span className="flex-1" />

        <Tooltip label={reported ? '已举报' : '举报'} side="left">
          <IconBtn
            type="button"
            aria-label={reported ? '已举报' : '举报'}
            aria-pressed={reported}
            variant={reported ? 'on' : 'default'}
            onClick={onReport}
            disabled={reported}
            data-testid={`community-note-report-${note.id}`}
            className={reported ? 'text-ink' : undefined}
          >
            <FlagIcon size={16} />
          </IconBtn>
        </Tooltip>
      </footer>

      {showComments ? <NoteCommentsList noteId={note.id} /> : null}
    </article>
  );
}

// ── 内部子组件 ────────────────────────────────────────────────────────────

interface NoteBodyPreviewProps {
  readonly note: CommunityNote;
}

/** 4 type 简化预览 — 比 NoteCard.NoteBody 更窄 (社区视图只需 3 行预览):
 *  - quote / reflect: line-clamp-3 单段文字
 *  - method: title + 步骤数量
 *  - material: rows 计数 + 首行 key
 *  完整 body 在 owner 笔记本视图 (Wave 4 NoteCard) 才渲染. */
function NoteBodyPreview({ note }: NoteBodyPreviewProps): ReactElement {
  switch (note.type) {
    case 'quote':
      return <TextPreview text={readString(note.body, 'text')} />;
    case 'reflect':
      return <TextPreview text={readString(note.body, 'text')} />;
    case 'method':
      return (
        <MethodPreview
          title={readString(note.body, 'title') || note.title}
          stepCount={readStepCount(note.body)}
        />
      );
    case 'material':
      return (
        <MaterialPreview
          rowCount={readRowCount(note.body)}
          firstKey={readFirstRowKey(note.body)}
        />
      );
    default:
      return <TextPreview text="" />;
  }
}

function TextPreview({ text }: { readonly text: string }): ReactElement {
  return (
    <p
      className={cn(
        'text-sm leading-relaxed text-ink m-0',
        'line-clamp-3 break-words',
      )}
    >
      {text || '(无内容)'}
    </p>
  );
}

function MethodPreview({
  title,
  stepCount,
}: {
  readonly title: string;
  readonly stepCount: number;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-serif text-md font-semibold text-ink m-0 line-clamp-2">
        {title || '(方法标题)'}
      </p>
      <p className="text-xs text-ink-3 m-0">
        共 {stepCount} 步
      </p>
    </div>
  );
}

function MaterialPreview({
  rowCount,
  firstKey,
}: {
  readonly rowCount: number;
  readonly firstKey: string;
}): ReactElement {
  return (
    <p className="text-sm text-ink-3 leading-relaxed m-0">
      共 {rowCount} 条素材
      {firstKey.length > 0 ? ` · ${firstKey}` : ''}
    </p>
  );
}

function TypeBadge({
  type,
}: {
  readonly type: CommunityNote['type'];
}): ReactNode {
  const LABEL: Record<CommunityNote['type'], string> = {
    quote: '金句',
    method: '方法',
    reflect: '反思',
    material: '素材',
  };
  return (
    <span className="text-xs font-mono tracking-loose text-ink-4 uppercase">
      {LABEL[type]}
    </span>
  );
}

function Avatar({ name }: { readonly name: string }): ReactElement {
  const initial = name.length > 0 ? name.slice(0, 1) : '?';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'shrink-0 w-8 h-8 rounded-pill inline-flex items-center justify-center',
        'bg-surface-alt text-ink text-sm font-medium',
      )}
    >
      {initial}
    </span>
  );
}

// ── body shape readers (跟 NoteCard 同款 fail-fast narrow) ────────────────

function readString(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  return typeof v === 'string' ? v : '';
}

function readStepCount(body: Record<string, unknown>): number {
  const raw = body.steps;
  return Array.isArray(raw) ? raw.length : 0;
}

function readRowCount(body: Record<string, unknown>): number {
  const raw = body.rows;
  return Array.isArray(raw) ? raw.length : 0;
}

function readFirstRowKey(body: Record<string, unknown>): string {
  const raw = body.rows;
  if (!Array.isArray(raw) || raw.length === 0) return '';
  const first = raw[0];
  if (
    typeof first !== 'object' ||
    first === null ||
    typeof (first as { key?: unknown }).key !== 'string'
  ) {
    return '';
  }
  return (first as { key: string }).key;
}

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
