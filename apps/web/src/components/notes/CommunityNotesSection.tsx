import { type ReactElement } from 'react';
import { Button, EmptyState } from '@sikao/ui/ui';
import { CommentIcon } from '@sikao/ui/icons';
import {
  useCommunityNotesForQuestion,
  type CommunityNote,
} from '@sikao/domain/notes/useCommunityNotes';
import { CommunityNoteCard } from './CommunityNoteCard';

/**
 * SIKAO Wave 10 Phase C · CommunityNotesSection — 题目下方"同学的笔记".
 *
 * 位置 (WrongQuestionDetailView 集成): 答题解析 / 错因分析之后, AI 推荐之前.
 * 在 question detail view 内 inline 渲染 (不是 modal 不是 sheet — lhr 要求).
 *
 * 数据流:
 *   - useCommunityNotesForQuestion(questionId) mock → 之后 useQuery GET
 *     /api/v2/questions/{id}/public-notes (Wave 10 Phase B ship).
 *   - top 3 preview + "查看全部 N 条" 跳独立 sheet/page (Phase D 推, 当前
 *     按钮 onClick 给 testId 触发占位 toast / 无副作用)
 *
 * 调性 (docs/design/style-guide.md §1.3): "图书馆隔壁桌的同学" — 安静、靠谱、
 * 不打鸡血. 标题用 serif 中文 (font-serif, CJK 禁 italic, CLAUDE.md §4 italic
 * 政策).
 *
 * CLAUDE.md §4 view 纵向预算: 默认只渲 top 3 卡 + "查看全部" 跳独立 view,
 * 不在主体内 list 铺所有评论 — 防止 question detail 纵向超 2 屏.
 */

export interface CommunityNotesSectionProps {
  readonly questionId: number;
  /** 点击"查看全部"时的导航 callback. 由父 view 决定跳 sheet 还是 page. */
  readonly onViewAll?: (questionId: number) => void;
  /** 点击"写一条"empty state CTA 的 callback. 通常跳 NoteCaptureModal. */
  readonly onCompose?: (questionId: number) => void;
  readonly testId?: string;
}

const PREVIEW_LIMIT = 3;

export function CommunityNotesSection({
  questionId,
  onViewAll,
  onCompose,
  testId,
}: CommunityNotesSectionProps): ReactElement {
  // PREVIEW_LIMIT 同步给 BE limit 参数, 减少 over-fetch (Phase D wire 真 useQuery).
  const { data } = useCommunityNotesForQuestion(questionId, PREVIEW_LIMIT);
  const items: readonly CommunityNote[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const preview = items.slice(0, PREVIEW_LIMIT);
  const hasMore = total > PREVIEW_LIMIT;

  return (
    <section
      data-testid={testId ?? 'community-notes'}
      data-question-id={questionId}
      className="mt-6"
    >
      <Header total={total} />
      {items.length === 0 ? (
        <EmptyState
          icon={<CommentIcon size={20} />}
          title={<span className="font-serif">还没有同学的笔记</span>}
          description="把你的解题思路记下来, 别人也能看到."
          action={
            onCompose !== undefined ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onCompose(questionId)}
                data-testid="community-notes-empty-compose"
              >
                写一条
              </Button>
            ) : null
          }
        />
      ) : (
        <CommunityNotesList
          preview={preview}
          hasMore={hasMore}
          total={total}
          questionId={questionId}
          onViewAll={onViewAll}
        />
      )}
    </section>
  );
}

interface HeaderProps {
  readonly total: number;
}

function Header({ total }: HeaderProps): ReactElement {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h3 className="font-serif text-lg font-semibold text-ink m-0">
        同学的笔记
      </h3>
      <span
        className="text-xs text-ink-4 font-mono tracking-loose tabular-nums"
        data-testid="community-notes-total"
      >
        共 {total} 条
      </span>
    </div>
  );
}

interface CommunityNotesListProps {
  readonly preview: readonly CommunityNote[];
  readonly hasMore: boolean;
  readonly total: number;
  readonly questionId: number;
  readonly onViewAll?: (questionId: number) => void;
}

function CommunityNotesList({
  preview,
  hasMore,
  total,
  questionId,
  onViewAll,
}: CommunityNotesListProps): ReactElement {
  return (
    <>
      <ul
        className="space-y-3 list-none m-0 p-0"
        data-testid="community-notes-list"
      >
        {preview.map((note) => (
          <li key={note.id}>
            <CommunityNoteCard note={note} />
          </li>
        ))}
      </ul>
      {hasMore && onViewAll !== undefined ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => onViewAll(questionId)}
            data-testid="community-notes-view-all"
            rightIcon={
              <span className="font-serif italic" aria-hidden="true">
                →
              </span>
            }
          >
            查看全部 {total} 条
          </Button>
        </div>
      ) : null}
    </>
  );
}
