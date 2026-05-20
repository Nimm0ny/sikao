import { useCallback, useMemo, useState, type ReactElement } from 'react';
import {
  useEssayDraftAutosave,
  type SaveStatus as DraftSaveStatus,
} from '@sikao/domain/shenlun/useEssayDraft';
import { useEssaySessionElapsed } from '@sikao/domain/shenlun/useEssaySessionElapsed';
import { bodyChars } from '@sikao/answer-engine/word-limit/bodyChars';
import TopBar, { type SaveStatus as TopBarSaveStatus } from './TopBar';
import MaterialPane from './MaterialPane';
import TypedEditor from './TypedEditor';
import OutlineAside from './OutlineAside';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { MOCK_SHENLUN_SESSION } from './mockSession';

// mockSession 的 question id 是 string 'q1'-'q4' (非 BE int). map 函数同
// landscape shell — 全 numeric → Number, 否则 -1 (enabled guard 走 useEssayDraftAutosave
// 内 ≤0 不 call BE). 真 BE session 接入后自动开. 复制定义而不抽到 utils 是因为
// 这是 mock data 适配, 替换 mock 后整个函数应该删除 (不是长期 SSOT).
function mockQuestionIdToInt(id: string): number {
  if (/^\d+$/.test(id)) {
    return Number(id);
  }
  return -1;
}

// 同 landscape shell — 'idle' → 'saved' 视觉收口.
function mapDraftStatusToTopBar(status: DraftSaveStatus): TopBarSaveStatus {
  if (status === 'idle') return 'saved';
  return status;
}

//
// 布局: TopBar (60px, 同 TD1) + 上下叠 body (MaterialPane 顶部 + editor 占位
//       下方). 竖屏空间窄, MaterialPane 走全宽 (overflow scroll), 不固定 340.
//
// 跟横屏 shell 的差异: 没有 mode prop (TD2 不区分手写/键入 - 竖屏 = pencil
// pad + 触控键盘, 同一 editor stub). 直接 default editor 占位.

export default function TabletPortraitShell(): ReactElement {
  const { examLabel, materials, questions } = MOCK_SHENLUN_SESSION;

  const initialQuestionId = useMemo(() => {
    const target = questions.find((q) => !q.done) ?? questions[0];
    if (!target) {
      throw new Error('TabletPortraitShell: mock session has no questions.');
    }
    return target.id;
  }, [questions]);

  const [activeQuestionId, setActiveQuestionId] = useState<string>(initialQuestionId);
  const [activeMaterialId, setActiveMaterialId] = useState<string>(() => {
    return materials[0]?.id ?? '';
  });

  // P3 typed draft state — TD2 竖屏只走 typed (pencil pad + on-screen keyboard
  // 仍是 textarea 输入, 不分 typed/handwritten). 同 landscape per-question key.
  const [typedDrafts, setTypedDrafts] = useState<Record<string, string>>({});
  const currentTypedDraft = typedDrafts[activeQuestionId] ?? '';

  const handleTypedDraftChange = useCallback(
    (next: string): void => {
      setTypedDrafts((prev) => ({ ...prev, [activeQuestionId]: next }));
    },
    [activeQuestionId],
  );

  // P4 outline state — 跟 landscape shell 同 pattern. portrait 不显示 OcrPanel
  // 走 OutlineAside collapsed 浮条放右下角, 不显示 OcrPanel; spec 显式说 OcrPanel
  // 只在 Pencil/TD1b 模式出现).
  const [outlinesByQuestion, setOutlinesByQuestion] = useState<Record<string, string>>({});
  const currentOutline =
    outlinesByQuestion[activeQuestionId] ?? ESSAY_SIKAO_COPY.outlineAsidePrefillFive;

  const handleOutlineChange = useCallback(
    (next: string): void => {
      setOutlinesByQuestion((prev) => ({ ...prev, [activeQuestionId]: next }));
    },
    [activeQuestionId],
  );

  const currentWordCount = useMemo(
    () => bodyChars(currentTypedDraft),
    [currentTypedDraft],
  );

  const activeQuestion = useMemo(() => {
    const found = questions.find((q) => q.id === activeQuestionId);
    if (!found) {
      throw new Error(`TabletPortraitShell: activeQuestionId=${activeQuestionId} 不在 mock questions 中.`);
    }
    return found;
  }, [questions, activeQuestionId]);

  const activeIndex = useMemo(
    () => questions.findIndex((q) => q.id === activeQuestionId),
    [questions, activeQuestionId],
  );

  const handlePrev = useCallback((): void => {
    if (activeIndex <= 0) return;
    const prev = questions[activeIndex - 1];
    if (prev) setActiveQuestionId(prev.id);
  }, [activeIndex, questions]);

  const handleNext = useCallback((): void => {
    if (activeIndex >= questions.length - 1) return;
    const next = questions[activeIndex + 1];
    if (next) setActiveQuestionId(next.id);
  }, [activeIndex, questions]);

  const handleExit = useCallback((): void => {
    // P5 wire.
  }, []);

  const handleSubmit = useCallback((): void => {
    // P5 wire.
  }, []);

  // P5 wire: 真计时 + 真 autosave 状态机 (同 landscape shell).
  const elapsedSeconds = useEssaySessionElapsed();
  const draftQuestionIdInt = mockQuestionIdToInt(activeQuestion.id);
  const { saveStatus: draftStatus } = useEssayDraftAutosave({
    questionId: draftQuestionIdInt,
    typedDraft: currentTypedDraft,
    handwrittenDraftMetadata: null,
  });
  const saveStatus = mapDraftStatusToTopBar(draftStatus);

  return (
    <div
      data-testid="shenlun-tablet-portrait"
      className="flex flex-col h-full w-full bg-paper-1"
    >
      <TopBar
        examLabel={examLabel}
        elapsedSeconds={elapsedSeconds}
        currentWordCount={currentWordCount}
        maxWordCount={activeQuestion.maxWordCount}
        saveStatus={saveStatus}
        onExit={handleExit}
        onPrev={handlePrev}
        onNext={handleNext}
        onSubmit={handleSubmit}
        canPrev={activeIndex > 0}
        canNext={activeIndex < questions.length - 1}
      />
      <div className="flex flex-col flex-1 min-h-0 relative">
        {/* 竖屏 MaterialPane 走全宽 strip (TD2 spec): fullWidth=true 让 width
            从 340 切到 100% + 撤掉右侧 border (整行 strip 右边没东西要分隔). */}
        <MaterialPane
          fullWidth
          materials={materials}
          activeId={activeMaterialId}
          onActiveChange={setActiveMaterialId}
        />
        <main
          className="flex-1 min-h-0 flex flex-col"
          data-testid="shenlun-editor-root"
        >
          <TypedEditor
            questionId={activeQuestion.id}
            questionLabel={activeQuestion.label}
            questionStem={activeQuestion.label}
            value={currentTypedDraft}
            onChange={handleTypedDraftChange}
            maxWordCount={activeQuestion.maxWordCount}
            className="flex-1"
          />
        </main>
        <div className="absolute top-0 right-0 bottom-0 z-10 flex pointer-events-none">
          <div className="pointer-events-auto">
            <OutlineAside
              questionId={activeQuestion.id}
              questionLabel={activeQuestion.label}
              value={currentOutline}
              onChange={handleOutlineChange}
              defaultCollapsed
            />
          </div>
        </div>
      </div>
    </div>
  );
}
