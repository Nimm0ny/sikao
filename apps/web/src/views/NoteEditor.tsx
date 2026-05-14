/**
 * SIKAO Wave 4 Phase 2D · NoteEditor — 笔记编辑器.
 *
 * 路由 `/notes/:noteId` (编辑现有) 和 `/notes/new` (新建).
 *
 * 简版 scope (Phase 2D ship):
 *   - layout: 单列 ed-main (ed-side 元数据栏推 Phase 5)
 *   - editor: textarea (markdown source 渲染) + 实时预览基础版
 *   - 字段: title / type / sourceDomain / sourceRef / tags / body.text (quote /
 *     reflect) 或 body.steps (method) 或 body.rows (material)
 *   - 自动保存: useEffect debounce 1.5s (P2 复用 essay V2 auto-save hook 推 Phase 5)
 *
 * 数据流:
 *   - useNote(id) — 编辑模式 lazy fetch 单卡
 *   - useCreateNote() — /notes/new path
 *   - useUpdateNote() — 编辑现有
 *
 * 拆分 (SIKAO Wave 4 polish 2026-05-12, frontend/CLAUDE.md §3.5):
 *   - 类型 / 常量 / pure helpers → `@/components/notes/_noteEditorHelpers`
 *   - 3 个 primitive field 原子 → `@/components/notes/NoteEditorFields`
 */
import {
  useMemo,
  useState,
  type ReactElement,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useNote,
  useCreateNote,
  useUpdateNote,
  type NoteType,
} from '@sikao/api-client/queries/notebookQueries';
import { isAuthError } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { logger } from '@sikao/shared-utils';
import { PageHeader } from '@sikao/ui/ui/PageHeader';
import {
  Button,
  EmptyState,
  Skeleton,
  AuthFallbackEmptyState,
} from '@sikao/ui/ui';
import { AlertCircleIcon, NoteIcon } from '@sikao/ui/icons';
import {
  DEFAULT_EDITOR_STATE,
  hasBodyContent,
  noteToState,
  stateToPayload,
  type EditorBody,
  type EditorPartProps,
  type EditorState,
} from '@/components/notes/_noteEditorHelpers';
import {
  FieldSelect,
  FieldText,
  FieldTextarea,
} from '@/components/notes/NoteEditorFields';

export default function NoteEditor(): ReactElement {
  const navigate = useNavigate();
  const params = useParams<{ noteId?: string }>();
  const isNew = params.noteId === undefined || params.noteId === 'new';

  // edit path: 解析 noteId. NaN / 负数 → invalid (走 not-found 兜底).
  const parsedNoteId = isNew
    ? undefined
    : Number.parseInt(params.noteId ?? '', 10);
  const editQuery = useNote(parsedNoteId ?? -1);

  const createMut = useCreateNote();
  const updateMut = useUpdateNote();

  // hydrate state 从 BE note (编辑 path). React 19 官方推荐 "derived state
  // from prop" pattern: 用 useState + 记忆上次 prop, prop 变 → re-derive.
  // 避免 useEffect 内 setState (react-hooks/set-state-in-effect 警告) 跟
  // ref 访问 render 内 (react-hooks/refs 警告).
  const [hydratedFromId, setHydratedFromId] = useState<number | null>(null);
  const [state, setState] = useState<EditorState>(DEFAULT_EDITOR_STATE);
  if (
    editQuery.data &&
    editQuery.data.id !== hydratedFromId
  ) {
    setHydratedFromId(editQuery.data.id);
    setState(noteToState(editQuery.data));
  }

  // ── auth fallback ─────────────────────────────────────────────────────
  if (isAuthError(editQuery.error)) {
    return (
      <div
        className="p-4 md:p-8 max-w-4xl mx-auto"
        data-testid="note-editor-auth-fallback"
      >
        <AuthFallbackEmptyState description="登录后即可编辑笔记." />
      </div>
    );
  }

  // ── invalid id ─────────────────────────────────────────────────────────
  if (
    !isNew &&
    (parsedNoteId === undefined || Number.isNaN(parsedNoteId) || parsedNoteId < 1)
  ) {
    return (
      <div
        className="p-4 md:p-8 max-w-4xl mx-auto"
        data-testid="note-editor-invalid"
      >
        <EmptyState
          icon={<NoteIcon className="w-8 h-8" />}
          title="笔记链接无效"
          description="ID 解析失败, 可能已被删除或链接有误."
          action={
            <Button variant="secondary" onClick={() => navigate('/notes')}>
              返回笔记本
            </Button>
          }
        />
      </div>
    );
  }

  // ── loading (edit path) ────────────────────────────────────────────────
  if (!isNew && editQuery.isLoading) {
    return (
      <div
        className="p-4 md:p-8 max-w-4xl mx-auto space-y-4"
        data-testid="note-editor-loading"
      >
        <Skeleton heightClass="h-16" />
        <Skeleton heightClass="h-12" />
        <Skeleton heightClass="h-72" />
      </div>
    );
  }

  // ── error (edit path) ──────────────────────────────────────────────────
  if (!isNew && editQuery.isError) {
    return (
      <div
        className="p-4 md:p-8 max-w-4xl mx-auto"
        data-testid="note-editor-error"
      >
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title="笔记加载失败"
          description="检查网络后重试."
          action={
            <Button
              variant="secondary"
              onClick={() => void editQuery.refetch()}
              data-testid="note-editor-retry"
            >
              重试
            </Button>
          }
        />
      </div>
    );
  }

  // ── data path ──────────────────────────────────────────────────────────
  const handleSave = (): void => {
    const payload = stateToPayload(state);
    if (isNew) {
      createMut.mutate(payload, {
        onSuccess: (created) => {
          toast.info('笔记已创建');
          navigate(`/notes/${created.id}`, { replace: true });
        },
        onError: (err) => {
          logger.error('note.create.failed', { err: String(err) });
          toast.error('创建失败', '检查网络后重试');
        },
      });
      return;
    }
    if (parsedNoteId === undefined) return;
    updateMut.mutate(
      { noteId: parsedNoteId, payload },
      {
        onSuccess: () => {
          toast.info('已保存');
        },
        onError: (err) => {
          logger.error('note.update.failed', { err: String(err) });
          toast.error('保存失败', '检查网络后重试');
        },
      },
    );
  };

  const isSaving = createMut.isPending || updateMut.isPending;
  const canSave = state.title.trim().length > 0 || hasBodyContent(state.body);

  return (
    <div
      className="p-4 md:p-8 max-w-4xl mx-auto space-y-5"
      data-testid="note-editor-view"
    >
      <PageHeader
        eyebrow="Editor · 思考"
        title={isNew ? '新建笔记' : '编辑笔记'}
        subtitle="选择类型 + 来源, 写下要点. 跨领域单池, 复习自动入队列."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate('/notes')}
              data-testid="note-editor-cancel"
            >
              返回
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!canSave || isSaving}
              isLoading={isSaving}
              data-testid="note-editor-save"
            >
              {isNew ? '保存笔记' : '保存修改'}
            </Button>
          </div>
        }
      />

      <EditorMetadata state={state} setState={setState} />

      <EditorBodyField state={state} setState={setState} />

      <EditorFooter state={state} />
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────

function EditorMetadata({ state, setState }: EditorPartProps): ReactElement {
  return (
    <section
      data-testid="note-editor-metadata"
      className="bg-surface border border-line rounded-card p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      <FieldText
        label="标题"
        value={state.title}
        placeholder="给笔记起个名字"
        onChange={(v) => setState({ ...state, title: v })}
        testId="note-editor-title"
      />
      <FieldSelect
        label="类型"
        value={state.type}
        onChange={(v) => {
          const t = v as NoteType;
          // 类型切换时 body shape 跟着变. text-based (quote/reflect) 复用一个
          // text 字段, method/material 切换到结构化空 state.
          if (t === 'method') {
            setState({
              ...state,
              type: t,
              body: { kind: 'method', title: '', stepsRaw: '' },
            });
          } else if (t === 'material') {
            setState({
              ...state,
              type: t,
              body: { kind: 'material', rowsRaw: '' },
            });
          } else {
            const text = state.body.kind === 'text' ? state.body.text : '';
            setState({ ...state, type: t, body: { kind: 'text', text } });
          }
        }}
        options={[
          { value: 'quote', label: '金句' },
          { value: 'method', label: '方法论' },
          { value: 'reflect', label: '反思' },
          { value: 'material', label: '素材' },
        ]}
        testId="note-editor-type"
      />
      <FieldSelect
        label="学习域"
        value={state.sourceDomain}
        onChange={(v) =>
          setState({
            ...state,
            sourceDomain: v === 'xingce' ? 'xingce' : 'essay',
          })
        }
        options={[
          { value: 'essay', label: '申论' },
          { value: 'xingce', label: '行测' },
        ]}
        testId="note-editor-source-domain"
      />
      <FieldText
        label="来源"
        value={state.sourceRef}
        placeholder="例如: 2023 国考副省 第三题"
        onChange={(v) => setState({ ...state, sourceRef: v })}
        testId="note-editor-source-ref"
      />
      <FieldText
        label="标签 (逗号分隔)"
        value={state.tagsRaw}
        placeholder="#治理之细, #政策梳理"
        onChange={(v) => setState({ ...state, tagsRaw: v })}
        className="md:col-span-2"
        testId="note-editor-tags"
      />
    </section>
  );
}

function EditorBodyField({ state, setState }: EditorPartProps): ReactElement {
  if (state.body.kind === 'method') {
    return (
      <section
        data-testid="note-editor-body-method"
        className="bg-surface border border-line rounded-card p-4 space-y-3"
      >
        <FieldText
          label="方法标题"
          value={state.body.title}
          placeholder="例: 归纳概括 · 三步法"
          onChange={(v) =>
            setState({
              ...state,
              body: { ...state.body, title: v } as EditorBody,
            })
          }
          testId="note-editor-method-title"
        />
        <FieldTextarea
          label="步骤 (每行一步, 格式: 序号|说明)"
          value={state.body.stepsRaw}
          placeholder={'1|抓主体\n2|分维度\n3|整合表达'}
          onChange={(v) =>
            setState({
              ...state,
              body: { ...state.body, stepsRaw: v } as EditorBody,
            })
          }
          rows={6}
          testId="note-editor-method-steps"
        />
      </section>
    );
  }
  if (state.body.kind === 'material') {
    return (
      <section
        data-testid="note-editor-body-material"
        className="bg-surface border border-line rounded-card p-4 space-y-3"
      >
        <FieldTextarea
          label="字段 (每行一条, 格式: 字段名|值)"
          value={state.body.rowsRaw}
          placeholder={'人物|周一同\n地点|江西省\n核心动作|主导政策梳理工程'}
          onChange={(v) =>
            setState({
              ...state,
              body: { ...state.body, rowsRaw: v } as EditorBody,
            })
          }
          rows={8}
          testId="note-editor-material-rows"
        />
      </section>
    );
  }
  // text-based (quote / reflect)
  return (
    <section
      data-testid="note-editor-body-text"
      className="bg-surface border border-line rounded-card p-4 space-y-3"
    >
      <FieldTextarea
        label="正文"
        value={state.body.text}
        placeholder={
          state.type === 'quote'
            ? '记下精彩的论述或表达'
            : '写下你的反思与思考'
        }
        onChange={(v) =>
          setState({ ...state, body: { kind: 'text', text: v } })
        }
        rows={10}
        testId="note-editor-body-textarea"
      />
    </section>
  );
}

function EditorFooter({ state }: { readonly state: EditorState }): ReactElement {
  const charCount = useMemo(() => {
    if (state.body.kind === 'text') return state.body.text.length;
    if (state.body.kind === 'method') {
      return state.body.title.length + state.body.stepsRaw.length;
    }
    return state.body.rowsRaw.length;
  }, [state.body]);
  return (
    <footer
      data-testid="note-editor-footer"
      className="flex items-center justify-between font-mono text-tiny tracking-loose uppercase text-ink-4 px-3"
    >
      <span>
        字数 <span className="font-serif font-semibold tabular-nums">{charCount}</span>
      </span>
      <span>
        {state.tagsRaw.trim().length > 0
          ? `引用 ${state.tagsRaw.split(',').filter((t) => t.trim().length > 0).length} 个标签`
          : '尚无引用'}
      </span>
    </footer>
  );
}
