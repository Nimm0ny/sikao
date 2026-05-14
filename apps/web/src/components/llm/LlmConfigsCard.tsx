import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { AlertCircleIcon, ActionPlusIcon, RefreshIcon } from '@sikao/ui/icons';
import { Badge, Button, Card, EmptyState, Modal, Skeleton } from '@sikao/ui/ui';
import { LlmConfigForm, type LlmConfigFormValues } from '@/components/llm/LlmConfigForm';
import {
  createLlmConfig,
  deleteLlmConfig,
  fetchMyLlmConfigs,
  llmConfigsKeys,
  setDefaultLlmConfig,
  testLlmConfig,
  updateLlmConfig,
} from '@sikao/api-client/apiQueries';
import { BYOM_COPY, ERROR_COPY } from '@/lib/ui-copy';
import { toast } from '@sikao/shared-utils';
import type {
  LlmConfigCreateRequest,
  LlmConfigTestStatus,
  LlmConfigUpdateRequest,
  LlmConfigV2,
} from '@sikao/api-client/types/api';

// LlmConfigsCard — Slice 0c BYOM 用户配置面板.
//
// Profile 嵌入: 列出我的所有 BYOM configs + 添加 / 编辑 / 删除 / 设默认 /
// 测连通性. api_key 永远 mask 显示, 不返 raw.
//
// Form 三态: 'closed' | 'create' | { type: 'edit', id: number }. 同时只允许一
// 个 form 打开 (避免 mutation 状态混乱).

type FormMode = 'closed' | 'create' | { type: 'edit'; id: number };

interface ApiErrorBody {
  readonly code?: string;
  readonly detail?: string;
}

const TEST_STATUS_LABEL: Record<LlmConfigTestStatus, string> = {
  ok: BYOM_COPY.testStatusOk,
  auth_failed: BYOM_COPY.testStatusAuth,
  timeout: BYOM_COPY.testStatusTimeout,
  unreachable: BYOM_COPY.testStatusUnreach,
};

function classifyMutationError(err: AxiosError<ApiErrorBody>): string {
  const code = err.response?.data?.code;
  if (code === 'ssrf_blocked') return ERROR_COPY.llmConfigSsrf.title;
  if (code === 'llm_config_label_taken') return ERROR_COPY.llmConfigTaken.title;
  return err.response?.data?.detail ?? ERROR_COPY.llmConfigs.description;
}

export function LlmConfigsCard() {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [formError, setFormError] = useState<string | null>(null);
  // 删除二次确认 Modal — 替代 window.confirm (CLAUDE.md frontend §3.3 禁
  // alert/confirm). null 表 Modal 关, set 为 LlmConfigV2 表 Modal 显该 config.
  const [pendingDelete, setPendingDelete] = useState<LlmConfigV2 | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: llmConfigsKeys.list(),
    queryFn: fetchMyLlmConfigs,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: llmConfigsKeys.all });
  };

  const createMutation = useMutation({
    mutationFn: createLlmConfig,
    onSuccess: () => {
      invalidate();
      setFormMode('closed');
      setFormError(null);
    },
    onError: (err: AxiosError<ApiErrorBody>) => {
      setFormError(classifyMutationError(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: LlmConfigUpdateRequest }) =>
      updateLlmConfig(id, payload),
    onSuccess: () => {
      invalidate();
      setFormMode('closed');
      setFormError(null);
    },
    onError: (err: AxiosError<ApiErrorBody>) => {
      setFormError(classifyMutationError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLlmConfig,
    onSuccess: invalidate,
    // 5th-review P2 #C: confirmDelete 后 Modal 立即关闭, 失败时用户无感知.
    // 加 toast.error 跟 createMutation/updateMutation 错误处理对齐.
    onError: (err: AxiosError<ApiErrorBody>) => {
      toast.error(classifyMutationError(err));
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultLlmConfig,
    onSuccess: invalidate,
  });

  const testMutation = useMutation({
    mutationFn: testLlmConfig,
    onSuccess: (resp) => {
      invalidate();
      toast.info(TEST_STATUS_LABEL[resp.status]);
    },
  });

  const handleSubmit = (values: LlmConfigFormValues): void => {
    setFormError(null);
    if (formMode === 'create') {
      const payload: LlmConfigCreateRequest = {
        label: values.label,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        model: values.model,
      };
      createMutation.mutate(payload);
      return;
    }
    if (typeof formMode === 'object' && formMode.type === 'edit') {
      // edit 模式: apiKey 空表示不修改 (PATCH partial)
      const payload: LlmConfigUpdateRequest = {
        label: values.label,
        baseUrl: values.baseUrl,
        model: values.model,
      };
      if (values.apiKey !== '') {
        payload.apiKey = values.apiKey;
      }
      updateMutation.mutate({ id: formMode.id, payload });
    }
  };

  const handleDelete = (config: LlmConfigV2): void => {
    // 不直接 mutate, 弹 Modal 二次确认 (avoid window.confirm).
    setPendingDelete(config);
  };

  const confirmDelete = (): void => {
    if (pendingDelete !== null) {
      deleteMutation.mutate(pendingDelete.id);
      setPendingDelete(null);
    }
  };

  const cancelDelete = (): void => {
    setPendingDelete(null);
  };

  const closeForm = (): void => {
    setFormMode('closed');
    setFormError(null);
  };

  const configs = data?.items ?? [];
  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Card padding="md" data-testid="profile-llm-configs-card">
      <header className="flex items-start justify-between mb-3 gap-2">
        <div>
          <h2 className="font-bold text-ink">{BYOM_COPY.cardTitle}</h2>
          <p className="text-sm text-ink-3 mt-1">{BYOM_COPY.cardSubtitle}</p>
        </div>
        {formMode === 'closed' ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ActionPlusIcon className="w-4 h-4" />}
            onClick={() => setFormMode('create')}
            data-testid="llm-configs-add-btn"
          >
            {BYOM_COPY.addNew}
          </Button>
        ) : null}
      </header>

      {isLoading ? (
        <Skeleton widthClass="w-full" heightClass="h-12" testId="llm-configs-skeleton" />
      ) : isError ? (
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-6 h-6" aria-hidden="true" />}
          title={ERROR_COPY.llmConfigs.title}
          description={ERROR_COPY.llmConfigs.description}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { void refetch(); }}
              data-testid="llm-configs-retry"
            >
              <RefreshIcon className="w-4 h-4 mr-2" aria-hidden="true" />
              重试
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {configs.length === 0 && formMode !== 'create' ? (
            <p className="text-sm text-ink-3" data-testid="llm-configs-empty">
              {BYOM_COPY.emptyHint}
            </p>
          ) : null}
          {configs.map((config) => {
            const isEditingThis =
              typeof formMode === 'object' && formMode.type === 'edit' && formMode.id === config.id;
            if (isEditingThis) {
              return (
                <div key={config.id} data-testid={`llm-config-edit-${config.id}`}>
                  <LlmConfigForm
                    mode="edit"
                    initial={config}
                    isSubmitting={updateMutation.isPending}
                    errorMessage={formError}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                  />
                </div>
              );
            }
            return (
              <ConfigRow
                key={config.id}
                config={config}
                onSetDefault={() => setDefaultMutation.mutate(config.id)}
                onTest={() => testMutation.mutate(config.id)}
                onEdit={() => {
                  setFormMode({ type: 'edit', id: config.id });
                  setFormError(null);
                }}
                onDelete={() => handleDelete(config)}
                isTesting={testMutation.isPending && testMutation.variables === config.id}
                isSettingDefault={
                  setDefaultMutation.isPending && setDefaultMutation.variables === config.id
                }
              />
            );
          })}
          {formMode === 'create' ? (
            <LlmConfigForm
              mode="create"
              isSubmitting={isMutating}
              errorMessage={formError}
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          ) : null}
        </div>
      )}
      <Modal
        open={pendingDelete !== null}
        onClose={cancelDelete}
        title="确认删除"
        description={BYOM_COPY.deleteConfirm}
        ariaLabel="confirm-delete-llm-config"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelDelete}
              disabled={deleteMutation.isPending}
              data-testid="llm-config-delete-cancel"
            >
              {BYOM_COPY.cancelBtn}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="llm-config-delete-confirm"
            >
              {BYOM_COPY.delete}
            </Button>
          </div>
        }
      />
    </Card>
  );
}

interface ConfigRowProps {
  readonly config: LlmConfigV2;
  readonly onSetDefault: () => void;
  readonly onTest: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly isTesting: boolean;
  readonly isSettingDefault: boolean;
}

function ConfigRow({
  config,
  onSetDefault,
  onTest,
  onEdit,
  onDelete,
  isTesting,
  isSettingDefault,
}: ConfigRowProps) {
  return (
    <div
      className="border border-line rounded-card px-3 py-3"
      data-testid={`llm-config-row-${config.id}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-ink truncate">{config.label}</span>
          {config.isDefault ? (
            <Badge data-testid={`llm-config-default-badge-${config.id}`}>
              {BYOM_COPY.isDefault}
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTest}
            disabled={isTesting}
            data-testid={`llm-config-test-${config.id}`}
          >
            {isTesting ? BYOM_COPY.testing : BYOM_COPY.test}
          </Button>
          {!config.isDefault ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSetDefault}
              disabled={isSettingDefault}
              data-testid={`llm-config-set-default-${config.id}`}
            >
              {BYOM_COPY.setDefault}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            data-testid={`llm-config-edit-btn-${config.id}`}
          >
            {BYOM_COPY.edit}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            data-testid={`llm-config-delete-${config.id}`}
          >
            {BYOM_COPY.delete}
          </Button>
        </div>
      </div>
      <div className="text-xs text-ink-3 font-mono break-all">
        {config.baseUrl} · {config.model} · {config.apiKeyMasked}
      </div>
      {config.lastTestedStatus !== null ? (
        <div className="text-xs text-ink-3 mt-1">
          上次测试: {TEST_STATUS_LABEL[config.lastTestedStatus]}
        </div>
      ) : null}
    </div>
  );
}
