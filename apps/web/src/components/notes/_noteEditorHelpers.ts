// Pure view-model helpers + types + constants for views/NoteEditor.tsx —
// 拆分自 NoteEditor.tsx 让主 view 保持 ≤ 500 行 (frontend/CLAUDE.md §3.5).
// 没有 React 依赖, 全 pure functions + 类型 + 常量; state ↔ BE payload 映射逻辑
// 集中在此文件, NoteEditor.tsx 只引用. 测试覆盖通过 NoteEditor view 间接验证.
//
// SIKAO Wave 4 polish (2026-05-12): 不改算法, 字符级搬运.

import type {
  NoteCreateV2,
  NoteOutV2,
  NoteSourceDomain,
  NoteSourceKind,
  NoteType,
} from '@sikao/api-client/queries/notebookQueries';

// ── editor body shape ─────────────────────────────────────────────────────
//
// 类型切换时 body shape 跟着变. text-based (quote/reflect) 复用一个 text 字段,
// method/material 切换到结构化空 state. discriminant union 让 NoteEditor 内
// 模式匹配编译期检查.

export type EditorBody =
  | { kind: 'text'; text: string }
  | { kind: 'method'; title: string; stepsRaw: string }
  | { kind: 'material'; rowsRaw: string };

export interface EditorState {
  readonly title: string;
  readonly type: NoteType;
  readonly sourceDomain: NoteSourceDomain;
  readonly sourceKind: NoteSourceKind;
  readonly sourceRef: string;
  readonly tagsRaw: string;
  readonly body: EditorBody;
}

export interface EditorPartProps {
  readonly state: EditorState;
  readonly setState: (next: EditorState) => void;
}

// ── default new-note state ────────────────────────────────────────────────

export const DEFAULT_EDITOR_STATE: EditorState = {
  title: '',
  type: 'reflect',
  sourceDomain: 'essay',
  sourceKind: 'manual',
  sourceRef: '手动整理',
  tagsRaw: '',
  body: { kind: 'text', text: '' },
};

// ── helpers (state ↔ BE payload) ──────────────────────────────────────────

export function noteToState(note: NoteOutV2): EditorState {
  const body = note.body as Record<string, unknown>;
  let editorBody: EditorBody;
  if (note.type === 'method') {
    const stepsRaw = Array.isArray(body.steps)
      ? body.steps
          .filter(
            (s): s is { index: string; text: string } =>
              typeof s === 'object' &&
              s !== null &&
              typeof (s as { index?: unknown }).index === 'string' &&
              typeof (s as { text?: unknown }).text === 'string',
          )
          .map((s) => `${s.index}|${s.text}`)
          .join('\n')
      : '';
    editorBody = {
      kind: 'method',
      title: typeof body.title === 'string' ? body.title : '',
      stepsRaw,
    };
  } else if (note.type === 'material') {
    const rowsRaw = Array.isArray(body.rows)
      ? body.rows
          .filter(
            (r): r is { key: string; value: string } =>
              typeof r === 'object' &&
              r !== null &&
              typeof (r as { key?: unknown }).key === 'string' &&
              typeof (r as { value?: unknown }).value === 'string',
          )
          .map((r) => `${r.key}|${r.value}`)
          .join('\n')
      : '';
    editorBody = { kind: 'material', rowsRaw };
  } else {
    editorBody = {
      kind: 'text',
      text: typeof body.text === 'string' ? body.text : '',
    };
  }
  return {
    title: note.title,
    type: note.type,
    sourceDomain: note.sourceDomain,
    sourceKind: note.sourceKind,
    sourceRef: note.sourceRef,
    tagsRaw: note.tags.join(', '),
    body: editorBody,
  };
}

export function stateToPayload(state: EditorState): NoteCreateV2 {
  const tags = state.tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return {
    type: state.type,
    body: editorBodyToWire(state.body),
    sourceKind: state.sourceKind,
    sourceRef: state.sourceRef || '手动整理',
    sourceDomain: state.sourceDomain,
    title: state.title,
    tags,
    visibility: 'self',
  };
}

export function editorBodyToWire(body: EditorBody): Record<string, unknown> {
  if (body.kind === 'text') return { text: body.text };
  if (body.kind === 'method') {
    const steps = body.stepsRaw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [idx, ...rest] = line.split('|');
        return { index: idx.trim(), text: rest.join('|').trim() };
      });
    return { title: body.title, steps };
  }
  // material
  const rows = body.rowsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [key, ...rest] = line.split('|');
      return { key: key.trim(), value: rest.join('|').trim() };
    });
  return { rows };
}

export function hasBodyContent(body: EditorBody): boolean {
  if (body.kind === 'text') return body.text.trim().length > 0;
  if (body.kind === 'method')
    return body.title.trim().length > 0 || body.stepsRaw.trim().length > 0;
  return body.rowsRaw.trim().length > 0;
}
