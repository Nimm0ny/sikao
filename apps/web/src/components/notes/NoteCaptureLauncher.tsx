/**
 * SIKAO Wave 6E · NoteCaptureLauncher — ✎ 入口按钮 (IconBtn + Tooltip + modal state).
 *
 * 答题 / 复盘流的 ✎ icon button. 点击 → 弹 NoteCaptureModal pre-fill target +
 * sourceQuote → 保存即生成笔记 (POST /api/v2/notebook/notes).
 *
 * 接入点 (Wave 6E):
 *   - FbActions (xingce 答题): toolbar 末尾, target=xingce_question
 *   - EditorPanel / EssayShellSikao (申论作答): footer toolbar, target=essay_question
 *   - WrongQuestionDetailView (错题详情): banner / section header, target=wrong_question
 *   - WrongQuestionRedoView (错题重做): topbar, target=wrong_question
 *
 * Dumb-ish: 自管 modal open state, 不接外部 store. caller 只传 target +
 * 可选 sourceQuote / tooltip 文案. 跟 NoteEditor (题级 markdown) / CaptureBar
 * (NotesHome sticky) 是两条独立 channel — 不会冲突.
 *
 * SVG-only IconBtn + aria-label + Tooltip — 符合 CLAUDE.md §4 答题系统按钮
 * 硬约束 (DetailB / FbActions 在 lint:practice-svg-only 巡检范围内).
 */
import { useState, type ReactElement } from 'react';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { NoteEditIcon } from '@sikao/ui/icons';
import {
  NoteCaptureModal,
  type NoteAttachTarget,
} from './NoteCaptureModal';
import type { NoteOutV2, NoteType } from '@sikao/api-client/queries/notebookQueries';
import { NOTES_COPY } from '@/lib/ui-copy';

export interface NoteCaptureLauncherProps {
  readonly target: NoteAttachTarget;
  readonly sourceQuote?: string;
  readonly defaultType?: NoteType;
  readonly tooltip?: string;
  readonly testId?: string;
  readonly iconSize?: number;
  readonly onCreated?: (note: NoteOutV2) => void;
}

export function NoteCaptureLauncher({
  target,
  sourceQuote,
  defaultType,
  tooltip = NOTES_COPY.launcherTooltip,
  testId,
  iconSize = 16,
  onCreated,
}: NoteCaptureLauncherProps): ReactElement {
  const [open, setOpen] = useState(false);
  const aria = tooltip;
  const launcherTestId = testId ?? 'note-capture-launcher';
  // Modal lazy-mount: 只有用户点开后才挂载 NoteCaptureModal — 这是为了避免
  // 在 launcher 接入的所有 view (FbActions / EditorPanel / WrongView) 测试
  // 中强制要求 QueryClientProvider (NoteCaptureModal 内 useCreateNote 需要).
  // 关闭后保持挂载让 Modal AnimatePresence 跑 exit 动画 (一次 open 后此组件
  // tree 内永远有 modal child).
  const [hasOpened, setHasOpened] = useState(false);
  return (
    <>
      <Tooltip label={tooltip}>
        <IconBtn
          size="sm"
          aria-label={aria}
          onClick={() => {
            setHasOpened(true);
            setOpen(true);
          }}
          data-testid={launcherTestId}
        >
          <NoteEditIcon size={iconSize} />
        </IconBtn>
      </Tooltip>
      {hasOpened ? (
        <NoteCaptureModal
          open={open}
          onClose={() => setOpen(false)}
          target={target}
          defaultSourceQuote={sourceQuote}
          defaultType={defaultType}
          onCreated={onCreated}
          testId={`${launcherTestId}-modal`}
        />
      ) : null}
    </>
  );
}
