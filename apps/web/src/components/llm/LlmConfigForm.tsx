import { useState, type FormEvent } from 'react';
import { Button, FormField } from '@sikao/ui/ui';
import { BYOM_COPY } from '@/lib/ui-copy';
import type { LlmConfigV2 } from '@sikao/api-client/types/api';

// LlmConfigForm — 创建 / 编辑 BYOM config.
//
// Dumb component: 不调 API, 不管 mutation state. caller 传 onSubmit 处理
// create / update mutation, isSubmitting 控制 disabled/loading 文案.
//
// Edit 模式 apiKey 输入为空时表示不修改现有 key (后端 partial update 跳过).

export interface LlmConfigFormValues {
  readonly label: string;
  readonly baseUrl: string;
  readonly apiKey: string; // empty in edit mode = "don't change"
  readonly model: string;
}

export interface LlmConfigFormProps {
  readonly mode: 'create' | 'edit';
  readonly initial?: LlmConfigV2;
  readonly isSubmitting: boolean;
  readonly errorMessage?: string | null;
  readonly onSubmit: (values: LlmConfigFormValues) => void;
  readonly onCancel: () => void;
}

export function LlmConfigForm({
  mode,
  initial,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: LlmConfigFormProps) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? 'https://api.deepseek.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(initial?.model ?? 'deepseek-v4-flash');

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    onSubmit({ label, baseUrl, apiKey, model });
  };

  const isEdit = mode === 'edit';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 px-3 py-4 border border-line rounded-card bg-elevated"
      data-testid="llm-config-form"
    >
      <FormField
        label={BYOM_COPY.labelLabel}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={BYOM_COPY.labelPlaceholder}
        required
        maxLength={64}
        autoComplete="off"
        data-testid="llm-config-form-label"
      />
      <FormField
        label={BYOM_COPY.baseUrlLabel}
        type="url"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder={BYOM_COPY.baseUrlPlaceholder}
        required
        maxLength={255}
        autoComplete="off"
        data-testid="llm-config-form-base-url"
      />
      <FormField
        label={BYOM_COPY.apiKeyLabel}
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={BYOM_COPY.apiKeyPlaceholder}
        required={!isEdit}
        maxLength={256}
        autoComplete="new-password"
        hint={isEdit ? BYOM_COPY.apiKeyEditHint : undefined}
        data-testid="llm-config-form-api-key"
      />
      <FormField
        label={BYOM_COPY.modelLabel}
        type="text"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={BYOM_COPY.modelPlaceholder}
        required
        maxLength={64}
        autoComplete="off"
        data-testid="llm-config-form-model"
      />

      {errorMessage !== undefined && errorMessage !== null ? (
        <div
          className="px-3 py-2 border border-err rounded-card text-sm text-ink"
          role="alert"
          data-testid="llm-config-form-error"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          data-testid="llm-config-form-cancel"
        >
          {BYOM_COPY.cancelBtn}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isSubmitting}
          data-testid="llm-config-form-submit"
        >
          {isSubmitting ? BYOM_COPY.saving : BYOM_COPY.saveBtn}
        </Button>
      </div>
    </form>
  );
}
