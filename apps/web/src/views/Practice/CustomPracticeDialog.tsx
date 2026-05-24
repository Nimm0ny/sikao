// lint-allow-ui-copy: SIK-27 PracticeCenter subcomponents still ship with
// interim business copy before the shared Practice ui-copy namespace exists.
import { useState } from 'react';
import { Button, Radio, Select, Slider, Switch } from '../../components/form';
import { Modal, Sheet } from '../../components/overlay';
import type { CatalogItemV2, PracticePreferencesResponseV2 } from '@sikao/api-client/types/practice';
import { useDevice } from '@sikao/shared-utils';
import { buildDraftFromPreferences, type CustomPracticeDraft } from './PracticeModel';
import styles from './Practice.module.css';

export function CustomPracticeDialog({
  open,
  scope,
  categoryItems,
  preferencesResponse,
  preset,
  device,
  busy,
  onClose,
  onSubmit,
}: {
  readonly open: boolean;
  readonly scope: 'xingce' | 'essay';
  readonly categoryItems: readonly CatalogItemV2[];
  readonly preferencesResponse?: PracticePreferencesResponseV2;
  readonly preset: Pick<CustomPracticeDraft, 'categoryL1' | 'categoryL2'> | null;
  readonly device: ReturnType<typeof useDevice>;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (draft: CustomPracticeDraft) => void;
}) {
  const [draft, setDraft] = useState<CustomPracticeDraft>(() => {
    const next = buildDraftFromPreferences(preferencesResponse);
    return {
      ...next,
      categoryL1: preset?.categoryL1 ?? next.categoryL1,
      categoryL2: preset?.categoryL2 ?? next.categoryL2,
    };
  });

  const categoryL1Options = Array.from(new Set(categoryItems.map((item) => item.categoryL1).filter((value): value is string => Boolean(value))))
    .map((value) => ({ value, label: value }));
  const categoryL2Options = categoryItems
    .filter((item) => (item.categoryL1 ?? '') === draft.categoryL1)
    .map((item) => ({ value: item.categoryL2 ?? '', label: item.title }));

  const content = (
    <div className={styles.dialogBody}>
      <div className={styles.dialogGrid}>
        <LabeledField label="来源模式">
          <div className={styles.inlineOptions}>
            {[
              ['real_exam', '真题'],
              ['ai_generated', 'AI 出题'],
            ].map(([value, label]) => (
              <Radio key={value} name="custom-source-mode" value={value} label={label} checked={draft.sourceMode === value} onChange={(next) => setDraft({ ...draft, sourceMode: next as CustomPracticeDraft['sourceMode'] })} />
            ))}
          </div>
        </LabeledField>
        <LabeledField label="题量">
          <Select
            value={String(draft.count)}
            onChange={(value) => setDraft({ ...draft, count: Number(value) as CustomPracticeDraft['count'] })}
            options={[
              { value: '5', label: '5 题' },
              { value: '10', label: '10 题' },
              { value: '15', label: '15 题' },
              { value: '20', label: '20 题' },
              { value: '30', label: '30 题' },
            ]}
          />
        </LabeledField>
        <LabeledField label="年份范围">
          <Select
            value={draft.yearRange}
            onChange={(value) => setDraft({ ...draft, yearRange: value as CustomPracticeDraft['yearRange'] })}
            options={[
              { value: 'all', label: '不限' },
              { value: 'recent_3', label: '近 3 年' },
              { value: 'recent_5', label: '近 5 年' },
              { value: 'recent_10', label: '近 10 年' },
            ]}
          />
        </LabeledField>
        <LabeledField label="答题模式">
          <div className={styles.inlineOptions}>
            {[
              ['full_set', '整组'],
              ['per_question', '逐题'],
            ].map(([value, label]) => (
              <Radio key={value} name="custom-practice-mode" value={value} label={label} checked={draft.practiceMode === value} onChange={(next) => setDraft({ ...draft, practiceMode: next as CustomPracticeDraft['practiceMode'] })} />
            ))}
          </div>
        </LabeledField>
        <LabeledField label="一级分类">
          <Select value={draft.categoryL1 || 'all'} onChange={(value) => setDraft({ ...draft, categoryL1: value === 'all' ? '' : value, categoryL2: '' })} options={[{ value: 'all', label: '不限' }, ...categoryL1Options]} />
        </LabeledField>
        <LabeledField label="二级分类">
          <Select value={draft.categoryL2 || 'all'} onChange={(value) => setDraft({ ...draft, categoryL2: value === 'all' ? '' : value })} options={[{ value: 'all', label: '不限' }, ...categoryL2Options]} />
        </LabeledField>
      </div>
      <LabeledField label={`难度下限 ${Math.round(draft.difficultyMin * 100)}%`}>
        <Slider min={0} max={100} step={5} value={Math.round(draft.difficultyMin * 100)} onChange={(value) => setDraft({ ...draft, difficultyMin: Math.min(value / 100, draft.difficultyMax) })} showValue />
      </LabeledField>
      <LabeledField label={`难度上限 ${Math.round(draft.difficultyMax * 100)}%`}>
        <Slider min={0} max={100} step={5} value={Math.round(draft.difficultyMax * 100)} onChange={(value) => setDraft({ ...draft, difficultyMax: Math.max(value / 100, draft.difficultyMin) })} showValue />
      </LabeledField>
      <div className={styles.inlineOptions}>
        <Switch checked={draft.excludeDone} onChange={(checked) => setDraft({ ...draft, excludeDone: checked })} label="排除已做" />
        <Switch checked={draft.onlyWrong} onChange={(checked) => setDraft({ ...draft, onlyWrong: checked })} label="只刷错题" />
      </div>
      <p className={styles.dialogHint}>
        当前范围：{scope === 'xingce' ? '行测' : '申论'}。提交后会同步 customPractice 默认值；AI 出题模式会直接触发后端生成并完成 handoff。
      </p>
    </div>
  );

  const actions = (
    <div className={styles.dialogFooter}>
      <Button variant="secondary" onClick={onClose}>取消</Button>
      <Button variant="primary" onClick={() => onSubmit(draft)} disabled={busy}>
        {busy ? '处理中...' : '开始创建'}
      </Button>
    </div>
  );

  if (device === 'mobile') {
    return (
      <Sheet open={open} onClose={onClose} title="自定义刷题" footer={actions}>
        {content}
      </Sheet>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="自定义刷题"
      description="支持真题 / AI 出题、自定义范围、难度与节奏。"
      secondaryAction={{ label: '取消', onClick: onClose }}
      primaryAction={{ label: busy ? '处理中...' : '开始创建', onClick: () => onSubmit(draft) }}
      size="lg"
    >
      {content}
    </Modal>
  );
}

function LabeledField({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className={styles.fieldGroup}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
