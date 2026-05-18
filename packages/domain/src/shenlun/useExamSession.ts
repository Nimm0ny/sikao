import { create } from 'zustand';
import type { AnswerSession, Highlight, LeftMode, Paper, Phase } from '@sikao/domain/shenlun/types';
import type {
  Citation,
  ScratchClip,
  ScratchNote,
} from '@sikao/domain/shenlun/sikaoTypes';

// Single source of truth for the exam session.
// One store per session is acceptable here — we mount it once per /essay/exam route.

interface ExamSessionState {
  // session identity
  paper: Paper | null;
  startedAt: number;

  // phase + question
  phase: Phase;
  currentQ: number;

  // per-question content (length === paper.questions.length once hydrated)
  textsByQ: string[];
  elapsedByQ: number[];
  warned5min: Record<number, true>;

  // shared workspace
  scratch: string;
  highlights: Record<string, Highlight[]>;

  // SIKAO V3 (additive — old textarea-based ScratchPanel still reads `scratch`
  // above, untouched). New double-column ScratchPad reads scratchClips +
  // scratchNotes; EditorPanel reads citationsByQ. All additive — old grading
  // link, snapshot, autosave do not touch these unless SIKAO view writes.
  scratchClips: ScratchClip[];
  scratchNotes: ScratchNote[];
  // Per-question citations array (length === paper.questions.length).
  citationsByQ: Citation[][];

  // ui state — left panel
  leftMode: LeftMode;
  leftWidthPx: number;
  matIdx: number;
  drawerOpen: boolean;
  overview: boolean;
  marking: boolean;
  query: string;
  fontSize: number;
  // gridFontSize drives the 田字格 character size (CJK; ASCII renders 3pt
  // smaller for visual parity in mixed-script writing). Independent of
  // fontSize (which is the materials reader prose size) — the two surfaces
  // have different ergonomics and the user adjusts them separately.
  gridFontSize: number;

  // ui state — right panel
  rightOpen: boolean;
  rightWidthPx: number;

  // autosave bookkeeping
  savedAt: number;

  // celebration trigger (transient)
  celebrateQ: number;

  // 5-min warn toast (transient — ExamShell hides after 4s)
  warnToastQ: number;

  // ⌘F → "focus the materials search input" pulse. MaterialsPanel owns the
  // input ref; ExamShell just bumps this counter when the user hits ⌘F. The
  // alternative (querySelector + setTimeout) reaches across component
  // boundaries and races with the drawer's max-height transition.
  searchFocusPulse: number;

  // actions
  hydrate: (paper: Paper, snapshot?: AnswerSession | null) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  // submit 进行中 — EssayExam.handleSubmit 调用. UI 层在此态下:
  //   - tick / autosave 自动停 (现有 guard `phase !== 'running'/'paused'`)
  //   - togglePause 自动 no-op (现有 if 链不命中 submitting)
  //   - 交卷按钮 disabled + loading
  // submit 成功 → finish() (→ 'submitted'), 失败 → 直接 setState phase='running'
  // 让用户重交.
  startSubmitting: () => void;
  finish: () => void;
  setCurrentQ: (q: number) => void;
  setText: (q: number, value: string | ((prev: string) => string)) => void;
  setScratch: (value: string | ((prev: string) => string)) => void;
  setHighlights: (
    value:
      | Record<string, Highlight[]>
      | ((prev: Record<string, Highlight[]>) => Record<string, Highlight[]>),
  ) => void;
  tick: () => void;
  warn5min: (q: number) => void;
  triggerWarnToast: (q: number) => void;
  hideWarnToast: () => void;
  appendScratchToSheet: () => void;
  appendLineToScratch: (line: string) => void;
  collectAllHighlightsToScratch: () => void;
  setLeftMode: (mode: LeftMode) => void;
  setLeftWidthPx: (px: number) => void;
  setMatIdx: (idx: number) => void;
  setDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setOverview: (open: boolean | ((prev: boolean) => boolean)) => void;
  setMarking: (open: boolean | ((prev: boolean) => boolean)) => void;
  setQuery: (q: string) => void;
  setFontSize: (px: number | ((prev: number) => number)) => void;
  setGridFontSize: (px: number | ((prev: number) => number)) => void;
  bumpFontSize: (delta: 1 | -1) => void;
  bumpGridFontSize: (delta: 1 | -1) => void;
  setRightOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setRightWidthPx: (px: number) => void;
  jumpToMaterial: (mid: string) => void;
  markSaved: () => void;
  setCelebrateQ: (q: number) => void;
  requestFocusSearch: () => void;
  toSnapshot: () => AnswerSession | null;

  // SIKAO V3 actions (additive — no existing call site changes).
  addScratchClip: (clip: ScratchClip) => void;
  removeScratchClip: (id: string) => void;
  reorderScratchClips: (ids: readonly string[]) => void;
  addScratchNote: (note: ScratchNote) => void;
  updateScratchNote: (id: string, body: string) => void;
  removeScratchNote: (id: string) => void;
  addCitation: (q: number, cite: Citation) => void;
  removeCitation: (q: number, citeId: string) => void;
}

const initialUI = {
  leftMode: 'normal' as LeftMode,
  leftWidthPx: 320,
  matIdx: 0,
  drawerOpen: false,
  overview: false,
  marking: false,
  query: '',
  fontSize: 15,
  gridFontSize: 18,
  rightOpen: true,
  rightWidthPx: 260,
  celebrateQ: -1,
  warnToastQ: -1,
  searchFocusPulse: 0,
};

const normalizeCitationsByQ = (
  citationsByQ: Citation[][] | undefined,
  questionCount: number,
): Citation[][] =>
  Array.from({ length: questionCount }, (_, index) => citationsByQ?.[index] ?? []);

export const useExamSession = create<ExamSessionState>((set, get) => ({
  paper: null,
  startedAt: 0,
  phase: 'prestart',
  currentQ: 0,
  textsByQ: [],
  elapsedByQ: [],
  warned5min: {},
  scratch: '',
  highlights: {},
  scratchClips: [],
  scratchNotes: [],
  citationsByQ: [],
  savedAt: Date.now(),
  ...initialUI,

  hydrate: (paper, snapshot) => {
    if (snapshot && snapshot.paperId === paper.id) {
      set({
        paper,
        startedAt: snapshot.startedAt,
        phase: snapshot.phase,
        currentQ: snapshot.currentQ,
        textsByQ: snapshot.textsByQ,
        elapsedByQ: snapshot.elapsedByQ,
        scratch: snapshot.scratch,
        highlights: snapshot.highlights,
        savedAt: snapshot.savedAt,
        warned5min: {},
        // Local snapshot schema migration: older localStorage records do not
        // have SIKAO V3 workspace arrays, so initialize them empty.
        scratchClips: snapshot.scratchClips ?? [],
        scratchNotes: snapshot.scratchNotes ?? [],
        citationsByQ: normalizeCitationsByQ(
          snapshot.citationsByQ,
          paper.questions.length,
        ),
        ...initialUI,
      });
      return;
    }
    set({
      paper,
      startedAt: Date.now(),
      phase: 'prestart',
      currentQ: 0,
      textsByQ: paper.questions.map(() => ''),
      elapsedByQ: paper.questions.map(() => 0),
      warned5min: {},
      scratch: '',
      highlights: {},
      scratchClips: [],
      scratchNotes: [],
      citationsByQ: paper.questions.map(() => []),
      savedAt: Date.now(),
      ...initialUI,
    });
  },

  // 状态机合法迁移 (PR3 review P1 #6 — 显式 guard, 不靠 if/else 链涌现):
  //   prestart → running       (start)
  //   running ↔ paused          (pause / resume / togglePause)
  //   running / paused → submitting   (startSubmitting)
  //   submitting → running       (失败回滚, EssayExam.tsx 走 setState)
  //   submitting → submitted     (finish)
  //   submitted    (terminal, 等 hydrate 重置回 prestart)
  // 任一非法迁移 (e.g. submitted → running 不该再出现) 在此 fail-fast 阻断.
  start: () => set({ phase: 'running' }),
  pause: () => {
    if (get().phase !== 'running') return;
    set({ phase: 'paused' });
  },
  resume: () => {
    if (get().phase !== 'paused') return;
    set({ phase: 'running' });
  },
  togglePause: () => {
    const { phase } = get();
    if (phase === 'running') set({ phase: 'paused' });
    else if (phase === 'paused') set({ phase: 'running' });
    // submitting / submitted / prestart 显式 no-op (review P2 #5 audit).
  },
  startSubmitting: () => {
    const { phase } = get();
    if (phase !== 'running' && phase !== 'paused') return;
    set({ phase: 'submitting' });
  },
  finish: () => {
    const { phase } = get();
    // 允许 submitting → submitted (正常成功路径) + running → submitted (老
    // 路径兼容, e.g. 测试或单题流). 拒绝 prestart / submitted 自我转 submitted.
    if (phase === 'prestart' || phase === 'submitted') return;
    set({ phase: 'submitted' });
  },

  setCurrentQ: (q) => set({ currentQ: q }),

  setText: (q, value) =>
    set((state) => {
      const next = [...state.textsByQ];
      next[q] = typeof value === 'function' ? value(state.textsByQ[q] ?? '') : value;
      return { textsByQ: next };
    }),

  setScratch: (value) =>
    set((state) => ({
      scratch: typeof value === 'function' ? value(state.scratch) : value,
    })),

  setHighlights: (value) =>
    set((state) => ({
      highlights: typeof value === 'function' ? value(state.highlights) : value,
    })),

  tick: () =>
    set((state) => {
      if (state.phase !== 'running' || !state.paper) return state;
      const q = state.currentQ;
      const duration = state.paper.questions[q].durationSec;
      const next = [...state.elapsedByQ];
      next[q] = Math.min(duration, next[q] + 1);
      return { elapsedByQ: next };
    }),

  warn5min: (q) =>
    set((state) => ({
      warned5min: { ...state.warned5min, [q]: true },
    })),

  triggerWarnToast: (q) => set({ warnToastQ: q }),
  hideWarnToast: () => set({ warnToastQ: -1 }),

  appendScratchToSheet: () =>
    set((state) => {
      if (!state.paper || !state.scratch.trim()) return state;
      const indented = state.scratch
        .split('\n')
        .map((ln) => (ln.trim() ? '　　' + ln.trim() : ''))
        .filter(Boolean)
        .join('\n');
      const next = [...state.textsByQ];
      const cur = next[state.currentQ];
      next[state.currentQ] = cur ? cur + '\n' + indented : indented;
      return { textsByQ: next };
    }),

  appendLineToScratch: (line) =>
    set((state) => ({
      scratch: state.scratch ? state.scratch.replace(/\s+$/, '') + '\n' + line : line,
    })),

  collectAllHighlightsToScratch: () =>
    set((state) => {
      if (!state.paper) return state;
      const groups = state.paper.materials
        .map((mat) => {
          const items = state.highlights[mat.id] ?? [];
          if (items.length === 0) return null;
          const sorted = [...items].sort((a, b) => a.start - b.start);
          const lines = sorted.map((r) => `· 「${mat.body.slice(r.start, r.end)}」`);
          return { title: mat.title, lines };
        })
        .filter((g): g is { title: string; lines: string[] } => g !== null);
      if (groups.length === 0) return state;
      const block = groups.map((g) => `▼ ${g.title}\n${g.lines.join('\n')}`).join('\n\n');
      const cur = state.scratch.trim() ? state.scratch.replace(/\s+$/, '') + '\n\n' : '';
      return { scratch: cur + block };
    }),

  setLeftMode: (mode) => set({ leftMode: mode }),
  setLeftWidthPx: (px) => set({ leftWidthPx: Math.max(240, Math.min(720, px)) }),
  setMatIdx: (idx) => set({ matIdx: idx }),
  setDrawerOpen: (open) =>
    set((state) => ({
      drawerOpen: typeof open === 'function' ? open(state.drawerOpen) : open,
    })),
  setOverview: (open) =>
    set((state) => ({
      overview: typeof open === 'function' ? open(state.overview) : open,
    })),
  setMarking: (open) =>
    set((state) => ({
      marking: typeof open === 'function' ? open(state.marking) : open,
    })),
  setQuery: (q) => set({ query: q }),
  setFontSize: (px) =>
    set((state) => ({
      fontSize: typeof px === 'function' ? px(state.fontSize) : px,
    })),
  setGridFontSize: (px) =>
    set((state) => {
      const next = typeof px === 'function' ? px(state.gridFontSize) : px;
      return { gridFontSize: Math.max(14, Math.min(22, next)) };
    }),
  bumpFontSize: (delta) =>
    set((state) => ({
      fontSize: Math.max(13, Math.min(20, state.fontSize + delta)),
    })),
  bumpGridFontSize: (delta) =>
    set((state) => ({
      gridFontSize: Math.max(14, Math.min(22, state.gridFontSize + delta)),
    })),
  setRightOpen: (open) =>
    set((state) => ({
      rightOpen: typeof open === 'function' ? open(state.rightOpen) : open,
    })),
  setRightWidthPx: (px) => set({ rightWidthPx: Math.max(200, Math.min(480, px)) }),

  jumpToMaterial: (mid) => {
    const { paper, leftMode } = get();
    if (!paper) return;
    const idx = paper.materials.findIndex((m) => m.id === mid);
    if (idx >= 0) {
      set({ matIdx: idx, leftMode: leftMode === 'collapsed' ? 'normal' : leftMode });
    }
  },

  markSaved: () => set({ savedAt: Date.now() }),

  setCelebrateQ: (q) => set({ celebrateQ: q }),

  requestFocusSearch: () =>
    set((state) => ({ searchFocusPulse: state.searchFocusPulse + 1 })),

  toSnapshot: () => {
    const s = get();
    if (!s.paper) return null;
    return {
      paperId: s.paper.id,
      startedAt: s.startedAt,
      phase: s.phase,
      currentQ: s.currentQ,
      textsByQ: s.textsByQ,
      elapsedByQ: s.elapsedByQ,
      highlights: s.highlights,
      scratch: s.scratch,
      scratchClips: s.scratchClips,
      scratchNotes: s.scratchNotes,
      citationsByQ: normalizeCitationsByQ(s.citationsByQ, s.paper.questions.length),
      savedAt: s.savedAt,
    };
  },

  // SIKAO V3 actions — pure additive list mutations. Dedupe: addScratchClip
  // refuses to push a clip whose `id` already exists (prevents double-fires
  // from React 18 strict-mode StrictMode dev re-effects + drag handler races).
  addScratchClip: (clip) =>
    set((state) => {
      if (state.scratchClips.some((c) => c.id === clip.id)) return state;
      return { scratchClips: [...state.scratchClips, clip] };
    }),

  removeScratchClip: (id) =>
    set((state) => ({
      scratchClips: state.scratchClips.filter((c) => c.id !== id),
    })),

  reorderScratchClips: (ids) =>
    set((state) => {
      const map = new Map(state.scratchClips.map((c) => [c.id, c] as const));
      const reordered: ScratchClip[] = [];
      ids.forEach((id, idx) => {
        const c = map.get(id);
        if (c) reordered.push({ ...c, position: idx });
      });
      return { scratchClips: reordered };
    }),

  addScratchNote: (note) =>
    set((state) => {
      if (state.scratchNotes.some((n) => n.id === note.id)) return state;
      return { scratchNotes: [...state.scratchNotes, note] };
    }),

  updateScratchNote: (id, body) =>
    set((state) => ({
      scratchNotes: state.scratchNotes.map((n) =>
        n.id === id ? { ...n, body } : n,
      ),
    })),

  removeScratchNote: (id) =>
    set((state) => ({
      scratchNotes: state.scratchNotes.filter((n) => n.id !== id),
    })),

  addCitation: (q, cite) =>
    set((state) => {
      const arr = state.citationsByQ[q] ?? [];
      if (arr.some((c) => c.id === cite.id)) return state;
      const next = [...state.citationsByQ];
      next[q] = [...arr, cite];
      return { citationsByQ: next };
    }),

  removeCitation: (q, citeId) =>
    set((state) => {
      const arr = state.citationsByQ[q] ?? [];
      const next = [...state.citationsByQ];
      next[q] = arr.filter((c) => c.id !== citeId);
      return { citationsByQ: next };
    }),
}));
