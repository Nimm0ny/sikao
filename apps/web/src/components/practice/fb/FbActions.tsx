import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { NoteIcon, StarFilledIcon, StarIcon } from '@sikao/ui/icons';
import { NoteCaptureLauncher } from '@/components/notes';
import { FbMarkIcon } from './icons/FbMarkIcon';

// SIKAO Phase 3 (2026-05-09): 单题操作条 (收藏 / 标记 / 笔记 / 划线).
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md.
//
// P1 (2026-05-11): 改纵向 layout 嵌入 FbCard 72px 左列 (SPEC §3.2).
// P5b/2 (2026-05-11): 划线 stub 解 disabled — onHighlightArm 注入后点击 → arm()
//   触发 SelectionToolbar; 未注入则维持 disabled (safety).
//
// 全 SVG icon (CLAUDE.md §4 SVG-only 行测/申论按钮硬约束). 四按钮独立 toggle:
//   - favorite: 收藏题 (当前仅通过 onToggle 通知 caller; 本阶段不新增后端契约)
//   - marked: 标记 (≠ favorited; 已 ship via flaggedQuestions store SSOT —
//     用 caller 的 isMarked + onToggleMark 接现有 store)
//   - hasNote: 题级 markdown note (走 BE NoteEditor — caller 注入 hasNote 状态
//     + 点击触发 NoteEditor modal; 跟 scratchClips 跨题笔记是两条独立 channel)
//   - highlight (P5b): 点击 → caller arm(qid) → SelectionToolbar 启动
//
// Dumb by contract (frontend/CLAUDE.md §2.2): 无 store / fetch; toggle 由 caller.

export interface FbActionsProps {
  readonly questionId: string;
  readonly isFavorited: boolean;
  readonly isMarked: boolean;
  readonly hasNote: boolean;
  readonly onToggleFavorite: (questionId: string, next: boolean) => void;
  readonly onToggleMark: (questionId: string, next: boolean) => void;
  readonly onOpenNote: (questionId: string) => void;
  /**
   * P5b/2: 点 🖋 划线 → caller arm(questionId) 启动 SelectionToolbar.
   * 未注入 → 按钮 disabled (safety, P1 stub 兼容).
   */
  readonly onHighlightArm?: (questionId: string) => void;
  /**
   * Wave 6E (2026-05-12): 题干截断 → 注入 NoteCaptureLauncher 作为
   * sourceQuote pre-fill, 让用户保存笔记时自动带上原文上下文.
   */
  readonly captureSourceQuote?: string;
}

export function FbActions({
  questionId,
  isFavorited,
  isMarked,
  hasNote,
  onToggleFavorite,
  onToggleMark,
  onOpenNote,
  onHighlightArm,
  captureSourceQuote,
}: FbActionsProps) {
  const highlightEnabled = onHighlightArm !== undefined;
  // Wave 6E: questionId 是 string → 转 number 给 NoteAttachTarget. 行测
  // questionId 始终是 digit-only string (BE schema xingce_question_id INT).
  const captureRefId = Number(questionId);
  const captureTarget = Number.isFinite(captureRefId) && captureRefId > 0
    ? { kind: 'xingce_question' as const, refId: captureRefId }
    : null;
  return (
    <div
      className="flex flex-col items-center gap-1"
      role="toolbar"
      aria-label="题目操作"
      aria-orientation="vertical"
      data-testid="fb-actions"
    >
      <Tooltip label={isFavorited ? '取消收藏' : '收藏'}>
        <IconBtn
          size="sm"
          variant={isFavorited ? 'on' : 'default'}
          aria-label={isFavorited ? '已收藏' : '收藏'}
          aria-pressed={isFavorited}
          onClick={() => onToggleFavorite(questionId, !isFavorited)}
          data-testid={`fb-action-fav-${questionId}`}
        >
          {isFavorited ? <StarFilledIcon size={16} /> : <StarIcon size={16} />}
        </IconBtn>
      </Tooltip>
      <Tooltip label={isMarked ? '取消标记' : '标记'}>
        <IconBtn
          size="sm"
          variant={isMarked ? 'on' : 'default'}
          aria-label={isMarked ? '已标记' : '标记'}
          aria-pressed={isMarked}
          onClick={() => onToggleMark(questionId, !isMarked)}
          data-testid={`fb-action-mark-${questionId}`}
        >
          <FbMarkIcon size={16} />
        </IconBtn>
      </Tooltip>
      <Tooltip label={hasNote ? '查看笔记' : '写笔记'}>
        <IconBtn
          size="sm"
          variant={hasNote ? 'on' : 'default'}
          aria-label={hasNote ? '笔记 (已写)' : '笔记'}
          aria-pressed={hasNote}
          onClick={() => onOpenNote(questionId)}
          data-testid={`fb-action-note-${questionId}`}
        >
          <NoteIcon size={16} />
        </IconBtn>
      </Tooltip>
      {/* P5b/2: 划线触发浮工具条 (SPEC §5). onHighlightArm 注入 → 解 disabled. */}
      {/* svg-only-allow: NoteIcon 复用占位避免新增 HighlightIcon file (后续 design 落地再替换) */}
      <Tooltip label={highlightEnabled ? '划线' : '划线 (即将上线)'}>
        <IconBtn
          size="sm"
          variant="default"
          disabled={!highlightEnabled}
          aria-label="划线"
          aria-hidden={highlightEnabled ? undefined : 'true'}
          onClick={
            highlightEnabled
              ? () => onHighlightArm(questionId)
              : undefined
          }
          data-testid={`fb-action-highlight-${questionId}`}
        >
          <NoteIcon size={16} />
        </IconBtn>
      </Tooltip>
      {/* Wave 6E (2026-05-12): "添加到笔记本" 跨域 attached note. 跟 onOpenNote
          (题级 markdown 草稿) 是不同 channel — 走 /api/v2/notebook/notes,
          attachedTo.xingceQuestionIds=[qid] 自动 pre-fill. */}
      {captureTarget !== null ? (
        <NoteCaptureLauncher
          target={captureTarget}
          sourceQuote={captureSourceQuote}
          tooltip="添加到笔记本"
          testId={`fb-action-capture-${questionId}`}
        />
      ) : null}
    </div>
  );
}
