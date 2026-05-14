import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useHighlightStore, type Mark } from '../useHighlightStore';

// P5a 划线数据层 — useHighlightStore (Zustand) 测试.
// 50-cap undoStack / clear undo / sessionId-scoped persistence / parse-fail
// soft fallback (per useThemeStore 同款 Fail-Fast 软化).

function makeMark(qid: string, suffix = 'a'): Mark {
  return {
    id: `mark-test-${suffix}`,
    questionId: qid,
    textStart: 0,
    textLength: 5,
    colorKey: 'y',
    createdAt: Date.now(),
  };
}

describe('useHighlightStore', () => {
  beforeEach(() => {
    useHighlightStore.setState({ marks: {}, undoStack: [] });
    localStorage.clear();
  });

  it('addMark 后 getMarks(qid) 返回该 mark', () => {
    const mark = makeMark('q1');
    useHighlightStore.getState().addMark(mark);
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([mark]);
  });

  it('clearMarks(qid) 清空且 undoStack 多 {kind:clear, removed:[..]}', () => {
    const m1 = makeMark('q1', 'a');
    const m2 = makeMark('q1', 'b');
    useHighlightStore.getState().addMark(m1);
    useHighlightStore.getState().addMark(m2);
    useHighlightStore.getState().clearMarks('q1');
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([]);
    const stack = useHighlightStore.getState().undoStack;
    const last = stack[stack.length - 1];
    expect(last.kind).toBe('clear');
    if (last.kind === 'clear') {
      expect(last.removed).toEqual([m1, m2]);
    }
  });

  it('undo add → marks[qid] 空', () => {
    const mark = makeMark('q1');
    useHighlightStore.getState().addMark(mark);
    expect(useHighlightStore.getState().getMarks('q1')).toHaveLength(1);
    useHighlightStore.getState().undo();
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([]);
  });

  it('undo clear → marks[qid] 恢复', () => {
    const m1 = makeMark('q1', 'a');
    const m2 = makeMark('q1', 'b');
    useHighlightStore.getState().addMark(m1);
    useHighlightStore.getState().addMark(m2);
    useHighlightStore.getState().clearMarks('q1');
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([]);
    useHighlightStore.getState().undo();
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([m1, m2]);
  });

  it('removeMarks(qid, [id1]) 只删指定 id, 其余保留 + undoStack remove op', () => {
    const m1 = makeMark('q1', 'a');
    const m2 = makeMark('q1', 'b');
    const m3 = makeMark('q1', 'c');
    useHighlightStore.getState().addMark(m1);
    useHighlightStore.getState().addMark(m2);
    useHighlightStore.getState().addMark(m3);
    useHighlightStore.getState().removeMarks('q1', [m2.id]);
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([m1, m3]);
    const stack = useHighlightStore.getState().undoStack;
    const last = stack[stack.length - 1];
    expect(last.kind).toBe('remove');
    if (last.kind === 'remove') {
      expect(last.removed).toEqual([m2]);
    }
  });

  it('removeMarks 全部 id 不存在 → no-op (不污染 undoStack)', () => {
    const m1 = makeMark('q1', 'a');
    useHighlightStore.getState().addMark(m1);
    const stackBefore = useHighlightStore.getState().undoStack;
    useHighlightStore.getState().removeMarks('q1', ['ghost-id']);
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([m1]);
    expect(useHighlightStore.getState().undoStack).toEqual(stackBefore);
  });

  it('removeMarks 空 id 集 / 空 qid → no-op', () => {
    const m1 = makeMark('q1', 'a');
    useHighlightStore.getState().addMark(m1);
    const stackBefore = useHighlightStore.getState().undoStack;
    useHighlightStore.getState().removeMarks('q1', []);
    expect(useHighlightStore.getState().undoStack).toEqual(stackBefore);
    useHighlightStore.getState().removeMarks('ghost-qid', ['x']);
    expect(useHighlightStore.getState().undoStack).toEqual(stackBefore);
  });

  it('undo remove → marks 恢复被删 mark (跟 clear 同语义)', () => {
    const m1 = makeMark('q1', 'a');
    const m2 = makeMark('q1', 'b');
    useHighlightStore.getState().addMark(m1);
    useHighlightStore.getState().addMark(m2);
    useHighlightStore.getState().removeMarks('q1', [m1.id]);
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([m2]);
    useHighlightStore.getState().undo();
    // m1 回到末尾 (undo 把 removed 追加到剩余之后, SPEC 说明语义).
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([m2, m1]);
  });

  it('removeMarks 全部删完 → 删 marks[qid] key', () => {
    const m1 = makeMark('q1', 'a');
    useHighlightStore.getState().addMark(m1);
    useHighlightStore.getState().removeMarks('q1', [m1.id]);
    expect(useHighlightStore.getState().getMarks('q1')).toEqual([]);
  });

  it('push 51 addMark → undoStack.length === 50, 最早 op 丢弃', () => {
    const first = makeMark('q1', 'first');
    useHighlightStore.getState().addMark(first);
    for (let i = 0; i < 50; i += 1) {
      useHighlightStore.getState().addMark(makeMark('q1', `extra-${i}`));
    }
    const stack = useHighlightStore.getState().undoStack;
    expect(stack).toHaveLength(50);
    // 第一个 mark 已被挤掉 — 找不到 id === first.id 的 op
    const stillThere = stack.find(
      (op) => op.kind === 'add' && op.mark.id === first.id,
    );
    expect(stillThere).toBeUndefined();
  });

  it('getMarks(unknown qid) → empty readonly []', () => {
    expect(useHighlightStore.getState().getMarks('unknown-qid')).toEqual([]);
  });

  it('localStorage parse fail → 空启动 + logger.warn 调用', async () => {
    // 模拟坏数据
    localStorage.setItem('sikao.fb-highlights-v1', '{not valid json');
    // 动态 import 触发模块初始化时的 parse + warn (vitest 隔离 module 缓存)
    vi.resetModules();
    const loggerModule = await import('@/lib/logger');
    const warnSpy = vi.spyOn(loggerModule.logger, 'warn');
    await import('../useHighlightStore');
    expect(warnSpy).toHaveBeenCalled();
  });
});
