import { useCallback, useMemo, useState, type ReactElement } from 'react';
import type { InputMode } from '@sikao/shared-utils/hooks/useInputMode';
import {
  useEssayDraftAutosave,
  type SaveStatus as DraftSaveStatus,
} from '@sikao/domain/shenlun/useEssayDraft';
import { useEssaySessionElapsed } from '@sikao/domain/shenlun/useEssaySessionElapsed';
import { bodyChars } from '@sikao/answer-engine/word-limit/bodyChars';
import TopBar, { type SaveStatus as TopBarSaveStatus } from './TopBar';
import MaterialPane from './MaterialPane';
import TypedEditor from './TypedEditor';
import HandwriteEditor from './HandwriteEditor';
import OutlineAside from './OutlineAside';
import OcrPanel from './OcrPanel';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { MOCK_SHENLUN_SESSION } from './mockSession';

// mockSession 的 question id 是 string 'q1'-'q4' (P2 落档, 非真 BE int).
// P5 BE wire 时 hook 需要 real Question.id from DB int. 这里走一个简单 map
// 函数: 全 numeric 字符串 → Number; 否则 → -1 (autosave enabled guard 兜底,
// useEssayDraftAutosave 内判 questionId ≤0 不 call BE). 真 BE session 接入
// 后 mockSession 替换为真实数据, map 函数自然返回正整数, autosave 自动开.
function mockQuestionIdToInt(id: string): number {
  if (/^\d+$/.test(id)) {
    return Number(id);
  }
  return -1;
}

// useEssayDraftAutosave 返 4 态 'idle'|'saving'|'saved'|'unsaved'; TopBar 接 3 态
// (没 'idle'). 'idle' = 用户还没输入 / autosave 未触发 → 视觉等同 'saved' (干净态,
// 无 pending write). 失败 / 输入中 / 成功三态走原 mapping.
function mapDraftStatusToTopBar(status: DraftSaveStatus): TopBarSaveStatus {
  if (status === 'idle') return 'saved';
  return status;
}

// TabletLandscapeShell — TD1 / TD1b 横屏统一容器 (PR13 P2, 2026-05-13).
//
// 布局: TopBar (60px) + 三栏 body (左 340 MaterialPane / 中 flex-1 editor 占位
//       / 右 32-320 OutlineAside 占位). 编辑器在 P3 实施, OutlineAside 在 P4
//       实施, BE wire 在 P5 替换 mock 数据.
//
// `mode` 由 ShenlunSession dispatcher 下发: 'typed' = TD1 / 'handwritten' = TD1b.
// PR13 P2 只在 data-mode 上反映, 视觉差异 (TypedEditor / HandwriteEditor 切换)
// 由 P3 完成.
//
// 状态管理: PR13 P2 用本地 useState 持有 activeQuestionId / saveStatus / elapsed
// 等. P5 接 BE 后由 react-query + sessionStore 替换. 不引 zustand store 现在
// 是因为 mock 数据是 readonly const, 没有跨组件同步需求.

export interface TabletLandscapeShellProps {
  readonly mode: Extract<InputMode, 'typed' | 'handwritten'>;
}

export default function TabletLandscapeShell({
  mode,
}: TabletLandscapeShellProps): ReactElement {
  const { examLabel, materials, questions } = MOCK_SHENLUN_SESSION;

  // 默认聚焦第三题 (与 TD1 设计稿 line 2250 高亮一致, 让 layout 直观看到
  // chip selected 态). P5 BE wire 时换成 lastTouchedQuestionId.
  const initialQuestionId = useMemo(() => {
    const target = questions.find((q) => !q.done) ?? questions[0];
    if (!target) {
      throw new Error('TabletLandscapeShell: mock session has no questions.');
    }
    return target.id;
  }, [questions]);

  const [activeQuestionId, setActiveQuestionId] = useState<string>(initialQuestionId);
  // P2 阶段 material chip nav 跟 question 1:1 联动 (mock 简化). 真实结构是
  // 一题可引多材料, P5 BE 拆开后这里换成独立 activeMaterialId.
  const [activeMaterialId, setActiveMaterialId] = useState<string>(() => {
    return materials[0]?.id ?? '';
  });

  // P3 typed draft per-question state. key=questionId, value=current textarea
  // content. P5 替换为 useEssayDraft react-query mutation + autosave 2s
  // debounce. 手写 draft (HandwriteEditor canvas) 当前是 canvas-local pixel
  // buffer, P4 OcrPanel 引入后才需要序列化, P5 一起 BE 持久化.
  const [typedDrafts, setTypedDrafts] = useState<Record<string, string>>({});
  const currentTypedDraft = typedDrafts[activeQuestionId] ?? '';

  const handleTypedDraftChange = useCallback(
    (next: string): void => {
      setTypedDrafts((prev) => ({ ...prev, [activeQuestionId]: next }));
    },
    [activeQuestionId],
  );

  // P4 outline state per-question. 跟 typedDrafts 同 pattern (Record<questionId, outline>),
  // 默认 prefill 五段法骨架. P5 BE wire 后挪到 useEssayDraft 内当 handwritten_draft_metadata
  // 一部分 (五段法 outline 跟手写 draft 关联性最强). 现在不引 zustand 是因为 mock
  // session readonly, 只有 OutlineAside 一处消费, 单组件 state 升级走简单.
  const [outlinesByQuestion, setOutlinesByQuestion] = useState<Record<string, string>>({});
  const currentOutline =
    outlinesByQuestion[activeQuestionId] ?? ESSAY_SIKAO_COPY.outlineAsidePrefillFive;

  const handleOutlineChange = useCallback(
    (next: string): void => {
      setOutlinesByQuestion((prev) => ({ ...prev, [activeQuestionId]: next }));
    },
    [activeQuestionId],
  );

  const handleSubmitHandwritten = useCallback((): void => {
    // P5 wire: useSubmitEssay mutation with handwritten_draft_metadata path. P4 noop.
  }, []);

  // typed mode 字数走真实 draft (bodyChars 去 punct + whitespace). handwritten
  // mode 暂时 fallback 0 (P5 OCR 落地后再升级 — strokes → recognized text →
  // bodyChars 同一公式).
  const typedWordCount = useMemo(
    () => bodyChars(currentTypedDraft),
    [currentTypedDraft],
  );
  const currentWordCount = mode === 'typed' ? typedWordCount : 0;

  const activeQuestion = useMemo(() => {
    const found = questions.find((q) => q.id === activeQuestionId);
    if (!found) {
      throw new Error(`TabletLandscapeShell: activeQuestionId=${activeQuestionId} 不在 mock questions 中.`);
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
    // P5 wire: router back / confirm modal. P2 silent noop.
  }, []);

  const handleSubmit = useCallback((): void => {
    // P5 wire: useSubmitEssay mutation. P2 silent noop.
  }, []);

  // P5 wire: 真计时 + 真 autosave 状态机.
  // - elapsed: useEssaySessionElapsed mount-time setInterval 1s tick.
  // - saveStatus: useEssayDraftAutosave 2s debounce → BE POST /essay/drafts.
  //   mock data 阶段 questionId map 到 -1 (非 numeric mock id) → enabled false,
  //   autosave 不真 call BE, saveStatus = 'idle'. 真 BE session 接入后 question
  //   id 是正整数, autosave 自动开.
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
      data-testid="shenlun-tablet-landscape"
      data-mode={mode}
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
      <div className="flex flex-1 min-h-0">
        <MaterialPane
          materials={materials}
          activeId={activeMaterialId}
          onActiveChange={setActiveMaterialId}
        />
        <main
          className="flex-1 min-h-0 flex flex-col"
          data-testid="shenlun-editor-root"
          data-mode={mode}
        >
          {mode === 'typed' ? (
            <TypedEditor
              questionId={activeQuestion.id}
              questionLabel={activeQuestion.label}
              questionStem={activeQuestion.label}
              value={currentTypedDraft}
              onChange={handleTypedDraftChange}
              maxWordCount={activeQuestion.maxWordCount}
              className="flex-1"
            />
          ) : (
            <HandwriteEditor
              questionId={activeQuestion.id}
              questionLabel={activeQuestion.label}
              questionStem={activeQuestion.label}
              className="flex-1"
            />
          )}
        </main>
        {/* Pencil 模式右侧 OCR stub 240w (handoff §2.6 spec); typed 模式不出现.
            OcrPanel 紧贴 OutlineAside 浮条左侧, 视觉权重: editor > OcrPanel > OutlineAside. */}
        {mode === 'handwritten' ? (
          <OcrPanel onSubmitHandwritten={handleSubmitHandwritten} />
        ) : null}
        {/* 大纲浮条默认 collapsed 32px (handoff §2.5 spec); 跨 typed / handwritten
            模式共用同一 outline state (用户即使切模式 outline 也不丢). */}
        <OutlineAside
          questionId={activeQuestion.id}
          questionLabel={activeQuestion.label}
          value={currentOutline}
          onChange={handleOutlineChange}
          defaultCollapsed
        />
      </div>
    </div>
  );
}
