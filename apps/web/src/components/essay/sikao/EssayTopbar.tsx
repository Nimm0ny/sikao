import { useState } from 'react';
import { IconBtn } from '@sikao/ui/ui/IconBtn';
import { Button } from '@sikao/ui/ui/Button';
import { Modal } from '@sikao/ui/ui/Modal';
import { Tooltip } from '@sikao/ui/ui/Tooltip';
import {
  ActionMarkIcon,
  ClockIcon,
  FontSizePlusIcon,
  HelpIcon,
  NavBackIcon,
  NavSubmitIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PauseIcon,
  PlayIcon,
  ToolFullscreenIcon,
  ToolScratchIcon,
} from '@sikao/ui/icons';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { bodyChars } from '@sikao/answer-engine/word-limit/bodyChars';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy/essay-sikao';

interface Props {
  readonly onSubmit: () => void;
  readonly onTogglePause: () => void;
  readonly onOpenDraft: () => void;
  readonly marked: boolean;
  readonly onToggleMark: () => void;
  readonly onToggleFullscreen: () => void;
  readonly mobileMode?: 'editor' | 'material';
  readonly onToggleMobileMode?: () => void;
}

const GRID_FONT_SIZES = [16, 18, 20, 22] as const;

function formatExamTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;
  return [hours, minutes, rest]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function examMetaItems(code: string, name: string): readonly string[] {
  const haystack = `${name} ${code}`;
  const year = haystack.match(/20\d{2}/)?.[0];
  const category = haystack.match(/国考|省考|联考|选调|事业单位/)?.[0];
  const level = haystack.match(/副省|市地|地市|行政执法|县乡/)?.[0];
  const items = [year, category, level].filter((item): item is string => item !== undefined);
  return items.length >= 2 ? items : [name];
}

export function EssayTopbar({
  onSubmit,
  onTogglePause,
  onOpenDraft,
  marked,
  onToggleMark,
  onToggleFullscreen,
  mobileMode = 'editor',
  onToggleMobileMode,
}: Props) {
  const paper = useExamSession((s) => s.paper);
  const phase = useExamSession((s) => s.phase);
  const textsByQ = useExamSession((s) => s.textsByQ);
  const elapsedByQ = useExamSession((s) => s.elapsedByQ);
  const gridFontSize = useExamSession((s) => s.gridFontSize);
  const setGridFontSize = useExamSession((s) => s.setGridFontSize);
  const [exitOpen, setExitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  if (!paper) return null;

  const totalChars = textsByQ.reduce((sum, text) => sum + bodyChars(text), 0);
  const totalDuration = paper.questions.reduce((sum, item) => sum + item.durationSec, 0);
  const totalElapsed = elapsedByQ.reduce((sum, seconds) => sum + seconds, 0);
  const remaining = Math.max(0, totalDuration - totalElapsed);
  const isPaused = phase === 'paused';
  const submitting = phase === 'submitting';
  const submitDisabled = phase !== 'running' && phase !== 'paused';
  const metaItems = examMetaItems(paper.code, paper.name);

  const cycleGridFontSize = () => {
    const index = GRID_FONT_SIZES.findIndex((size) => size === gridFontSize);
    const next = GRID_FONT_SIZES[(index + 1) % GRID_FONT_SIZES.length];
    setGridFontSize(next);
  };

  return (
    <>
      <header
        className="essay-proto-topbar"
        data-testid="essay-topbar"
      >
        <div className="essay-proto-topbar__left">
          <Tooltip label={ESSAY_SIKAO_COPY.topbarExitExam} side="bottom">
            <IconBtn
              aria-label={ESSAY_SIKAO_COPY.topbarExitExam}
              className="essay-proto-iconbtn"
              onClick={() => setExitOpen(true)}
              data-testid="essay-topbar-exit"
            >
              <NavBackIcon size={15} />
            </IconBtn>
          </Tooltip>
          <div
            className="essay-proto-timer"
            aria-label={ESSAY_SIKAO_COPY.topbarTimerLabel}
            data-testid="essay-topbar-timer"
          >
            <ClockIcon size={14} />
            <span>{formatExamTime(remaining)}</span>
          </div>
        </div>

        <div className="essay-proto-topbar__center">
          {metaItems.map((item, index) => (
            <span key={`${item}-${index}`} className="essay-proto-meta-item">
              {index > 0 ? <span className="essay-proto-separator" aria-hidden="true" /> : null}
              <span>{item}</span>
            </span>
          ))}
        </div>

        <div className="essay-proto-topbar__right">
          <span className="essay-proto-total" aria-label={ESSAY_SIKAO_COPY.topbarTotalChars}>
            {totalChars}
          </span>
          {onToggleMobileMode ? (
            <div className="md:hidden">
            <Tooltip
              label={
                mobileMode === 'editor'
                  ? ESSAY_SIKAO_COPY.topbarViewMaterials
                  : ESSAY_SIKAO_COPY.topbarReturnAnswer
              }
              side="bottom"
            >
              <IconBtn
                aria-label={
                  mobileMode === 'editor'
                    ? ESSAY_SIKAO_COPY.topbarViewMaterials
                    : ESSAY_SIKAO_COPY.topbarReturnAnswer
                }
                aria-pressed={mobileMode === 'material'}
                className="essay-proto-iconbtn"
                variant={mobileMode === 'material' ? 'on' : 'default'}
                onClick={onToggleMobileMode}
                data-testid="essay-topbar-mobile-mode"
              >
                {mobileMode === 'material' ? (
                  <PanelLeftCloseIcon size={14} />
                ) : (
                  <PanelLeftOpenIcon size={14} />
                )}
              </IconBtn>
            </Tooltip>
            </div>
          ) : null}
        <Tooltip label={ESSAY_SIKAO_COPY.topbarFontSize} side="bottom">
          <IconBtn
            aria-label={ESSAY_SIKAO_COPY.topbarFontSize}
            className="essay-proto-iconbtn"
            onClick={cycleGridFontSize}
            data-testid="essay-topbar-font-size"
          >
            <FontSizePlusIcon size={15} />
          </IconBtn>
        </Tooltip>
        <Tooltip label={ESSAY_SIKAO_COPY.topbarDraftPaper} side="bottom">
          <IconBtn
            aria-label={ESSAY_SIKAO_COPY.topbarDraftPaper}
            className="essay-proto-iconbtn"
            onClick={onOpenDraft}
            data-testid="essay-topbar-draft"
          >
            <ToolScratchIcon size={15} />
          </IconBtn>
        </Tooltip>
        <Tooltip label={ESSAY_SIKAO_COPY.topbarMarkQuestion} side="bottom">
          <IconBtn
            aria-label={ESSAY_SIKAO_COPY.topbarMarkQuestion}
            aria-pressed={marked}
            className="essay-proto-iconbtn"
            variant={marked ? 'on' : 'default'}
            onClick={onToggleMark}
            data-testid="essay-topbar-mark"
          >
            <ActionMarkIcon size={15} />
          </IconBtn>
        </Tooltip>
        <Tooltip label={ESSAY_SIKAO_COPY.topbarHelp} side="bottom">
          <IconBtn
            aria-label={ESSAY_SIKAO_COPY.topbarHelp}
            className="essay-proto-iconbtn"
            onClick={() => setHelpOpen(true)}
            data-testid="essay-topbar-help"
          >
            <HelpIcon size={15} />
          </IconBtn>
        </Tooltip>
        <Tooltip label={ESSAY_SIKAO_COPY.topbarFullscreen} side="bottom">
          <IconBtn
            aria-label={ESSAY_SIKAO_COPY.topbarFullscreen}
            className="essay-proto-iconbtn"
            onClick={onToggleFullscreen}
            data-testid="essay-topbar-fullscreen"
          >
            <ToolFullscreenIcon size={15} />
          </IconBtn>
        </Tooltip>
        <Tooltip
          label={
            isPaused ? ESSAY_SIKAO_COPY.topbarContinueExam : ESSAY_SIKAO_COPY.topbarPauseExam
          }
          side="bottom"
        >
          <IconBtn
            aria-label={
              isPaused ? ESSAY_SIKAO_COPY.topbarContinueExam : ESSAY_SIKAO_COPY.topbarPauseExam
            }
            className="essay-proto-iconbtn"
            onClick={onTogglePause}
            disabled={phase === 'prestart' || phase === 'submitting' || phase === 'submitted'}
            data-testid="essay-topbar-pause"
          >
            {isPaused ? <PlayIcon size={15} /> : <PauseIcon size={15} />}
          </IconBtn>
        </Tooltip>
        <IconBtn
          aria-label={ESSAY_SIKAO_COPY.topbarSubmitEssay}
          className="essay-proto-submit"
          onClick={onSubmit}
          disabled={submitDisabled}
          data-testid="essay-topbar-submit"
        >
          <NavSubmitIcon size={16} />
          <span className="sr-only">
            {submitting ? ESSAY_SIKAO_COPY.topbarSubmitting : ESSAY_SIKAO_COPY.topbarSubmitShort}
          </span>
        </IconBtn>
        </div>
      </header>

      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title={ESSAY_SIKAO_COPY.topbarExitTitle}
        description={ESSAY_SIKAO_COPY.topbarExitDescription}
        ariaLabel={ESSAY_SIKAO_COPY.topbarExitTitle}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setExitOpen(false)}
              data-testid="essay-topbar-exit-cancel"
            >
              {ESSAY_SIKAO_COPY.topbarContinueExam}
            </Button>
            <Button
              variant="primary"
              onClick={() => window.history.back()}
              data-testid="essay-topbar-exit-confirm"
            >
              {ESSAY_SIKAO_COPY.topbarConfirmExit}
            </Button>
          </>
        }
      />
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={ESSAY_SIKAO_COPY.helpTitle}
        description={ESSAY_SIKAO_COPY.helpDescription}
        ariaLabel={ESSAY_SIKAO_COPY.helpTitle}
        footer={
          <Button variant="secondary" onClick={() => setHelpOpen(false)}>
            {ESSAY_SIKAO_COPY.helpClose}
          </Button>
        }
      />
    </>
  );
}
