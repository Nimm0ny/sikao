import { create } from 'zustand';
import { logger } from '@sikao/shared-utils';

// P5a 划线数据层 — Zustand store for fb (xingce) 题干 highlight.
//
// 数据模型 (textIndex-based, 不用 DOM Range 序列化):
//   - Mark: { id, questionId, textStart, textLength, colorKey, createdAt }
//   - marks: Record<questionId, readonly Mark[]>
//   - undoStack: HighlightOp[] (50 cap)
//
// 持久化:
//   - localStorage key: 'sikao.fb-highlights-v1'
//   - shape: { [sessionId]: { marks: Record<qid, Mark[]> } }
//   - sessionId-scoped (历史 session 不 leak)
//   - 只持久 marks, 不持 undoStack (跨刷新撤销栈 SPEC 未覆盖)
//   - debounce 500ms write (P5a SPEC §11 第 3 条)
//   - 不用 zustand persist middleware (默认 sync 写) — 自己管 subscribe + debounce
//   - parse fail → logger.warn + 空启动 (跟 useThemeStore 同款 Fail-Fast 软化)
//
// 不暴露 redo (lhr 拍板 audit E.6).

export type HighlightColorKey = 'y' | 'g' | 'b' | 'p';

export interface Mark {
  readonly id: string;
  readonly questionId: string;
  readonly textStart: number;
  readonly textLength: number;
  readonly colorKey: HighlightColorKey;
  readonly createdAt: number;
}

export type HighlightOp =
  | { readonly kind: 'add'; readonly mark: Mark }
  | { readonly kind: 'clear'; readonly removed: readonly Mark[] }
  // P5b/0: 'remove' op — selectionToolbar 清除按钮按 SPEC §5 精确范围
  // (selection 内 fb-hl)删除. clearMarks 是全清当前题, 跟 SPEC 差异.
  | { readonly kind: 'remove'; readonly removed: readonly Mark[] };

interface HighlightState {
  readonly marks: Record<string, readonly Mark[]>;
  readonly undoStack: readonly HighlightOp[];
  readonly addMark: (m: Mark) => void;
  readonly clearMarks: (questionId: string) => void;
  // P5b/0: 从 marks[qid] 删除指定 mark id 集合. 50 cap 在 push 处.
  // 空集合 / 全部不存在 → no-op (跟 clearMarks 同款不污染 undoStack).
  readonly removeMarks: (questionId: string, markIds: readonly string[]) => void;
  readonly undo: () => void;
  readonly getMarks: (questionId: string) => readonly Mark[];
}

const STORAGE_KEY = 'sikao.fb-highlights-v1';
const UNDO_CAP = 50;

interface PersistedShape {
  readonly [sessionId: string]: { readonly marks: Record<string, readonly Mark[]> };
}

/** 从 localStorage 拉一次 — module load 时跑. parse fail 软化为空 + warn. */
function loadFromStorage(): Record<string, readonly Mark[]> {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PersistedShape;
    // P5a: sessionId 来源未 wire (P5b 时补). 当前用 fixed 'default' bucket
    // 让 fixture 起步 — 未来 wire 时换 usePracticeStore.getState().sessionData?.sessionId.
    // TODO(P5b wire): swap to dynamic sessionId from usePracticeStore.
    const bucket = parsed['default'];
    return bucket?.marks ?? {};
  } catch (err) {
    logger.warn('useHighlightStore: localStorage parse failed, starting empty', {
      err: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

/** debounce 500ms write — module-level singleton, 跟 React lifecycle 无关. */
let writeTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedWrite(marks: Record<string, readonly Mark[]>): void {
  if (typeof localStorage === 'undefined') return;
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    // sessionId-scoped 持久化. P5a 用 'default' bucket; P5b wire 时换成
    // 从 usePracticeStore 读 sessionId.
    // TODO(P5b wire): replace 'default' with usePracticeStore.getState().sessionData?.sessionId.
    const payload: PersistedShape = { default: { marks } };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      logger.warn('useHighlightStore: localStorage write failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }, 500);
}

export const useHighlightStore = create<HighlightState>((set, get) => ({
  marks: loadFromStorage(),
  undoStack: [],
  addMark: (mark) => {
    set((state) => {
      const existing = state.marks[mark.questionId] ?? [];
      const nextStack = capUndoStack([
        ...state.undoStack,
        { kind: 'add', mark },
      ]);
      return {
        marks: { ...state.marks, [mark.questionId]: [...existing, mark] },
        undoStack: nextStack,
      };
    });
  },
  clearMarks: (questionId) => {
    set((state) => {
      const removed = state.marks[questionId] ?? [];
      if (removed.length === 0) {
        return state; // no-op, 不污染 undoStack
      }
      const nextMarks = { ...state.marks };
      delete nextMarks[questionId];
      const nextStack = capUndoStack([
        ...state.undoStack,
        { kind: 'clear', removed },
      ]);
      return { marks: nextMarks, undoStack: nextStack };
    });
  },
  removeMarks: (questionId, markIds) => {
    set((state) => {
      const existing = state.marks[questionId] ?? [];
      if (existing.length === 0 || markIds.length === 0) {
        return state; // no-op
      }
      const idSet = new Set(markIds);
      const removed = existing.filter((m) => idSet.has(m.id));
      if (removed.length === 0) {
        return state; // 全部 id 不存在 → no-op (不污染 undoStack)
      }
      const kept = existing.filter((m) => !idSet.has(m.id));
      const nextMarks = { ...state.marks };
      if (kept.length === 0) {
        delete nextMarks[questionId];
      } else {
        nextMarks[questionId] = kept;
      }
      const nextStack = capUndoStack([
        ...state.undoStack,
        { kind: 'remove', removed },
      ]);
      return { marks: nextMarks, undoStack: nextStack };
    });
  },
  undo: () => {
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const last = state.undoStack[state.undoStack.length - 1];
      const nextStack = state.undoStack.slice(0, -1);
      if (last.kind === 'add') {
        const list = state.marks[last.mark.questionId] ?? [];
        const filtered = list.filter((m) => m.id !== last.mark.id);
        const nextMarks = { ...state.marks };
        if (filtered.length === 0) {
          delete nextMarks[last.mark.questionId];
        } else {
          nextMarks[last.mark.questionId] = filtered;
        }
        return { marks: nextMarks, undoStack: nextStack };
      }
      if (last.kind === 'clear') {
        if (last.removed.length === 0) return { ...state, undoStack: nextStack };
        const qid = last.removed[0].questionId;
        return {
          marks: { ...state.marks, [qid]: last.removed },
          undoStack: nextStack,
        };
      }
      // kind === 'remove' — 合并 removed 回 marks[qid], 保留剩余原序后追加
      // (removeMarks 不保证再次 add 时位置回原, 但回 stack 时跟 clear undo 同语义)
      if (last.removed.length === 0) return { ...state, undoStack: nextStack };
      const qid = last.removed[0].questionId;
      const remainingNow = state.marks[qid] ?? [];
      return {
        marks: { ...state.marks, [qid]: [...remainingNow, ...last.removed] },
        undoStack: nextStack,
      };
    });
  },
  getMarks: (questionId) => {
    return get().marks[questionId] ?? [];
  },
}));

/** 取最新 UNDO_CAP 个 op (新的在末尾). */
function capUndoStack(stack: readonly HighlightOp[]): readonly HighlightOp[] {
  if (stack.length <= UNDO_CAP) return stack;
  return stack.slice(-UNDO_CAP);
}

// Module-level subscribe — debounce write marks → localStorage.
// 不依赖 React lifecycle, store 一旦 import 就挂. SSR 安全 (localStorage 检查).
useHighlightStore.subscribe((state, prev) => {
  if (state.marks === prev.marks) return;
  debouncedWrite(state.marks);
});
