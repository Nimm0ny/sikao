/**
 *
 * 路由 `/notes/:noteId` (编辑现有) 和 `/notes/new` (新建).
 *
 *   - editor: textarea (markdown source 渲染) + 实时预览基础版
 *   - 字段: title / type / sourceDomain / sourceRef / tags / body.text (quote /
 *     reflect) 或 body.steps (method) 或 body.rows (material)
 *
 * 数据流:
 *   - useNote(id) — 编辑模式 lazy fetch 单卡
 *   - useCreateNote() — /notes/new path
 *   - useUpdateNote() — 编辑现有
 *
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
import { NOTES_COPY } from '@/lib/ui-copy';

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
        <AuthFallbackEmptyState description={NOTES_COPY.editorRequireLogin} />
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
          title={NOTES_COPY.editorInvalidLinkTitle}
          description={NOTES_COPY.editorInvalidLinkDesc}
          action={
            <Button variant="secondary" onClick={() => navigate('/notes')}>
              {NOTES_COPY.editorBackToNotes}
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
          title={NOTES_COPY.editorLoadFailedTitle}
          description={NOTES_COPY.editorLoadFailedDesc}
          action={
            <Button
              variant="secondary"
              onClick={() => void editQuery.refetch()}
              data-testid="note-editor-retry"
            >
              {NOTES_COPY.editorRetry}
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
          toast.info(NOTES_COPY.editorCreatedToast);
          navigate(`/notes/${created.id}`, { replace: true });
        },
        onError: (err) => {
          logger.error('note.create.failed', { err: String(err) });
          toast.error(
            NOTES_COPY.editorCreateFailedTitle,
            NOTES_COPY.editorRetryHint,
          );
        },
      });
      return;
    }
    if (parsedNoteId === undefined) return;
    updateMut.mutate(
      { noteId: parsedNoteId, payload },
      {
        onSuccess: () => {
          toast.info(NOTES_COPY.editorSavedToast);
        },
        onError: (err) => {
          logger.error('note.update.failed', { err: String(err) });
          toast.error(
            NOTES_COPY.editorSaveFailedTitle,
            NOTES_COPY.editorRetryHint,
          );
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
        eyebrow={NOTES_COPY.editorEyebrow}
        title={isNew ? NOTES_COPY.editorNewTitle : NOTES_COPY.editorEditTitle}
        subtitle={NOTES_COPY.editorSubtitle}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate('/notes')}
              data-testid="note-editor-cancel"
            >
              {NOTES_COPY.editorBack}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!canSave || isSaving}
              isLoading={isSaving}
              data-testid="note-editor-save"
            >
              {isNew ? NOTES_COPY.editorSaveNew : NOTES_COPY.editorSaveEdit}
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
        label={NOTES_COPY.editorTitleLabel}
        value={state.title}
        placeholder={NOTES_COPY.editorTitlePlaceholder}
        onChange={(v) => setState({ ...state, title: v })}
        testId="note-editor-title"
      />
      <FieldSelect
        label={NOTES_COPY.editorTypeLabel}
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
          { value: 'quote', label: NOTES_COPY.editorTypeQuote },
          { value: 'method', label: NOTES_COPY.editorTypeMethod },
          { value: 'reflect', label: NOTES_COPY.editorTypeReflect },
          { value: 'material', label: NOTES_COPY.editorTypeMaterial },
        ]}
        testId="note-editor-type"
      />
      <FieldSelect
        label={NOTES_COPY.editorSourceDomainLabel}
        value={state.sourceDomain}
        onChange={(v) =>
          setState({
            ...state,
            sourceDomain: v === 'xingce' ? 'xingce' : 'essay',
          })
        }
        options={[
          { value: 'essay', label: NOTES_COPY.editorSourceDomainEssay },
          { value: 'xingce', label: NOTES_COPY.editorSourceDomainXingce },
        ]}
        testId="note-editor-source-domain"
      />
      <FieldText
        label={NOTES_COPY.editorSourceRefLabel}
        value={state.sourceRef}
        placeholder={NOTES_COPY.editorSourceRefPlaceholder}
        onChange={(v) => setState({ ...state, sourceRef: v })}
        testId="note-editor-source-ref"
      />
      <FieldText
        label={NOTES_COPY.editorTagsLabel}
        value={state.tagsRaw}
        placeholder={NOTES_COPY.editorTagsPlaceholder}
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
          label={NOTES_COPY.editorMethodTitleLabel}
          value={state.body.title}
          placeholder={NOTES_COPY.editorMethodTitlePlaceholder}
          onChange={(v) =>
            setState({
              ...state,
              body: { ...state.body, title: v } as EditorBody,
            })
          }
          testId="note-editor-method-title"
        />
        <FieldTextarea
          label={NOTES_COPY.editorMethodStepsLabel}
          value={state.body.stepsRaw}
          placeholder={NOTES_COPY.editorMethodStepsPlaceholder}
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
          label={NOTES_COPY.editorMaterialRowsLabel}
          value={state.body.rowsRaw}
          placeholder={NOTES_COPY.editorMaterialRowsPlaceholder}
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
        label={NOTES_COPY.editorBodyLabel}
        value={state.body.text}
        placeholder={
          state.type === 'quote'
            ? NOTES_COPY.editorQuotePlaceholder
            : NOTES_COPY.editorReflectPlaceholder
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
        {NOTES_COPY.editorFooterCharCount}{' '}
        <span className="font-serif font-semibold tabular-nums">{charCount}</span>
      </span>
      <span>
        {state.tagsRaw.trim().length > 0
          ? NOTES_COPY.editorFooterTagsCount(
              state.tagsRaw
                .split(',')
                .filter((t) => t.trim().length > 0).length,
            )
          : NOTES_COPY.editorFooterNoTags}
      </span>
    </footer>
  );
}
