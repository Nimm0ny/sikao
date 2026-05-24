// lint-allow-ui-copy: SIK-27 practice-preferences sections land before the
// shared Practice ui-copy namespace exists. Settings labels remain inline for
// this phase and will move into @/lib/ui-copy later.
import { Input, Radio, Select, Slider, Switch, TimePicker } from '../../components/form';
import { Button } from '../../components/form/Button';
import { Panel } from '../../components/layout';
import type { LocalCustomPracticePreferences, LocalPacingPreferences, LocalPreferencesPayload, LocalUiPreferences, PreferencesSection } from './PracticePreferencesModel';
import { fromTimeString, normalizeInteger, toTimeString } from './PracticePreferencesModel';
import styles from './PracticePreferences.module.css';

export function PracticePreferencesSections({
  draft,
  setDraft,
  schemaVersion,
  device,
  onResetSection,
}: {
  readonly draft: LocalPreferencesPayload;
  readonly setDraft: React.Dispatch<React.SetStateAction<LocalPreferencesPayload>>;
  readonly schemaVersion: number;
  readonly device: 'mobile' | 'tablet' | 'desktop';
  readonly onResetSection: (section: PreferencesSection) => void;
}) {
  const sections: ReadonlyArray<{
    title: string;
    key: PreferencesSection;
    content: React.ReactNode;
  }> = [
    {
      title: '界面',
      key: 'ui',
      content: (
        <>
          <div className={styles.split}>
            <LabeledField label="主题">
              <Select
                value={draft.ui.themePreference}
                onChange={(value) => setDraft({ ...draft, ui: { ...draft.ui, themePreference: value as LocalUiPreferences['themePreference'] } })}
                options={[
                  { value: 'system', label: '跟随系统' },
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                ]}
              />
            </LabeledField>
            <LabeledField label="字体大小">
              <Select
                value={draft.ui.fontSize}
                onChange={(value) => setDraft({ ...draft, ui: { ...draft.ui, fontSize: value as LocalUiPreferences['fontSize'] } })}
                options={[
                  { value: 'sm', label: '小' },
                  { value: 'base', label: '标准' },
                  { value: 'lg', label: '大' },
                  { value: 'xl', label: '特大' },
                ]}
              />
            </LabeledField>
          </div>
          <LabeledField label="行高">
            <div className={styles.inlineOptions}>
              {[
                ['compact', '紧凑'],
                ['comfortable', '舒适'],
                ['spacious', '宽松'],
              ].map(([value, label]) => (
                <Radio key={value} name="line-height" value={value} label={label} checked={draft.ui.lineHeight === value} onChange={(value) => setDraft({ ...draft, ui: { ...draft.ui, lineHeight: value as LocalUiPreferences['lineHeight'] } })} />
              ))}
            </div>
          </LabeledField>
          <LabeledField label="答题面板位置">
            <div className={styles.inlineOptions}>
              {[
                ['right', '右侧'],
                ['bottom', '底部'],
              ].map(([value, label]) => (
                <Radio key={value} name="answer-panel-position" value={value} label={label} checked={draft.ui.answerPanelPosition === value} onChange={(value) => setDraft({ ...draft, ui: { ...draft.ui, answerPanelPosition: value as LocalUiPreferences['answerPanelPosition'] } })} />
              ))}
            </div>
          </LabeledField>
          <Switch checked={draft.ui.showQuestionIndex} onChange={(checked) => setDraft({ ...draft, ui: { ...draft.ui, showQuestionIndex: checked } })} label="显示题号 / 总题数" />
          <Switch checked={draft.ui.showTimingIndicator} onChange={(checked) => setDraft({ ...draft, ui: { ...draft.ui, showTimingIndicator: checked } })} label="显示单题用时" />
          <Switch checked={draft.ui.showOvertimeWarning} onChange={(checked) => setDraft({ ...draft, ui: { ...draft.ui, showOvertimeWarning: checked } })} label="显示超时提示" />
        </>
      ),
    },
    {
      title: '答题节奏',
      key: 'pacing',
      content: (
        <>
          <LabeledField label="默认答题模式">
            <div className={styles.inlineOptions}>
              {[
                ['full_set', '整组'],
                ['per_question', '逐题'],
              ].map(([value, label]) => (
                <Radio key={value} name="default-practice-mode" value={value} label={label} checked={draft.pacing.defaultPracticeMode === value} onChange={(value) => setDraft({ ...draft, pacing: { ...draft.pacing, defaultPracticeMode: value as LocalPacingPreferences['defaultPracticeMode'] } })} />
              ))}
            </div>
          </LabeledField>
          <Switch checked={draft.pacing.autoAdvanceAfterAnswer} onChange={(checked) => setDraft({ ...draft, pacing: { ...draft.pacing, autoAdvanceAfterAnswer: checked } })} label="答完自动切下一题" />
          <LabeledField label="自动切题延迟（秒）">
            <Input type="number" value={String(draft.pacing.autoAdvanceDelaySeconds)} onChange={(value) => setDraft({ ...draft, pacing: { ...draft.pacing, autoAdvanceDelaySeconds: normalizeInteger(value, 1) } })} />
          </LabeledField>
          <Switch checked={draft.pacing.confirmBeforeSubmit} onChange={(checked) => setDraft({ ...draft, pacing: { ...draft.pacing, confirmBeforeSubmit: checked } })} label="提交前确认" />
          <LabeledField label="未答题数达到多少时强制确认">
            <Input type="number" value={String(draft.pacing.confirmWhenUnansweredCountGte)} onChange={(value) => setDraft({ ...draft, pacing: { ...draft.pacing, confirmWhenUnansweredCountGte: normalizeInteger(value, 1) } })} />
          </LabeledField>
        </>
      ),
    },
    {
      title: '自动保存',
      key: 'auto_save',
      content: (
        <>
          <Switch checked={draft.autoSave.enabled} onChange={(checked) => setDraft({ ...draft, autoSave: { ...draft.autoSave, enabled: checked } })} label="启用自动保存" />
          <LabeledField label="自动保存间隔（秒）">
            <Input type="number" value={String(draft.autoSave.intervalSeconds)} onChange={(value) => setDraft({ ...draft, autoSave: { ...draft.autoSave, intervalSeconds: normalizeInteger(value, 30) } })} />
          </LabeledField>
          <Switch checked={draft.autoSave.saveToLocalStorage} onChange={(checked) => setDraft({ ...draft, autoSave: { ...draft.autoSave, saveToLocalStorage: checked } })} label="本地备份草稿" />
        </>
      ),
    },
    {
      title: '提醒',
      key: 'reminders',
      content: (
        <>
          <Switch checked={draft.reminders.dailyPracticeReminderEnabled} onChange={(checked) => setDraft({ ...draft, reminders: { ...draft.reminders, dailyPracticeReminderEnabled: checked } })} label="每日一练提醒" />
          <LabeledField label="每日提醒时间">
            <TimePicker value={fromTimeString(draft.reminders.dailyPracticeReminderTime)} onChange={(value) => setDraft({ ...draft, reminders: { ...draft.reminders, dailyPracticeReminderTime: toTimeString(value) } })} />
          </LabeledField>
          <Switch checked={draft.reminders.weeklySummaryReminderEnabled} onChange={(checked) => setDraft({ ...draft, reminders: { ...draft.reminders, weeklySummaryReminderEnabled: checked } })} label="周总结提醒" />
          <div className={styles.split}>
            <LabeledField label="超时提示阈值（秒）">
              <Input type="number" value={String(draft.reminders.overtimeThresholdSeconds)} onChange={(value) => setDraft({ ...draft, reminders: { ...draft.reminders, overtimeThresholdSeconds: normalizeInteger(value, 0) } })} />
            </LabeledField>
            <LabeledField label="长时段休息提醒（分钟）">
              <Input type="number" value={String(draft.reminders.longSessionBreakReminderMinutes)} onChange={(value) => setDraft({ ...draft, reminders: { ...draft.reminders, longSessionBreakReminderMinutes: normalizeInteger(value, 0) } })} />
            </LabeledField>
          </div>
        </>
      ),
    },
    {
      title: '自定义刷题默认值',
      key: 'custom_practice',
      content: (
        <>
          <LabeledField label="默认来源">
            <div className={styles.inlineOptions}>
              {[
                ['real_exam', '真题'],
                ['ai_generated', 'AI 出题'],
              ].map(([value, label]) => (
                <Radio key={value} name="source-mode" value={value} label={label} checked={draft.customPractice.lastUsedSourceMode === value} onChange={(value) => setDraft({ ...draft, customPractice: { ...draft.customPractice, lastUsedSourceMode: value as LocalCustomPracticePreferences['lastUsedSourceMode'] } })} />
              ))}
            </div>
          </LabeledField>
          <LabeledField label="默认年份范围">
            <Select
              value={draft.customPractice.lastUsedYearRange}
              onChange={(value) => setDraft({ ...draft, customPractice: { ...draft.customPractice, lastUsedYearRange: value as LocalCustomPracticePreferences['lastUsedYearRange'] } })}
              options={[
                { value: 'all', label: '不限' },
                { value: 'recent_3', label: '近 3 年' },
                { value: 'recent_5', label: '近 5 年' },
                { value: 'recent_10', label: '近 10 年' },
              ]}
            />
          </LabeledField>
          <LabeledField label="默认题量">
            <Select
              value={String(draft.customPractice.lastUsedCount)}
              onChange={(value) => setDraft({ ...draft, customPractice: { ...draft.customPractice, lastUsedCount: Number(value) as LocalCustomPracticePreferences['lastUsedCount'] } })}
              options={[
                { value: '5', label: '5 题' },
                { value: '10', label: '10 题' },
                { value: '15', label: '15 题' },
                { value: '20', label: '20 题' },
                { value: '30', label: '30 题' },
              ]}
            />
          </LabeledField>
          <LabeledField label={`难度下限 ${Math.round(draft.customPractice.lastUsedDifficultyRange[0] * 100)}%`}>
            <Slider min={0} max={100} step={5} value={Math.round(draft.customPractice.lastUsedDifficultyRange[0] * 100)} onChange={(value) => setDraft({ ...draft, customPractice: { ...draft.customPractice, lastUsedDifficultyRange: [Math.min(value / 100, draft.customPractice.lastUsedDifficultyRange[1]), draft.customPractice.lastUsedDifficultyRange[1]] } })} showValue />
          </LabeledField>
          <LabeledField label={`难度上限 ${Math.round(draft.customPractice.lastUsedDifficultyRange[1] * 100)}%`}>
            <Slider min={0} max={100} step={5} value={Math.round(draft.customPractice.lastUsedDifficultyRange[1] * 100)} onChange={(value) => setDraft({ ...draft, customPractice: { ...draft.customPractice, lastUsedDifficultyRange: [draft.customPractice.lastUsedDifficultyRange[0], Math.max(value / 100, draft.customPractice.lastUsedDifficultyRange[0])] } })} showValue />
          </LabeledField>
          <Switch checked={draft.customPractice.lastUsedExcludeDone} onChange={(checked) => setDraft({ ...draft, customPractice: { ...draft.customPractice, lastUsedExcludeDone: checked } })} label="默认排除已做" />
          <Switch checked={draft.customPractice.lastUsedOnlyWrong} onChange={(checked) => setDraft({ ...draft, customPractice: { ...draft.customPractice, lastUsedOnlyWrong: checked } })} label="默认只刷错题" />
        </>
      ),
    },
  ];

  return (
    <div className={styles.grid}>
      {sections.map((section) => (
        <Panel key={section.key} title={section.title}>
          <div className={styles.panelBody}>
            <SectionHeader title={section.title} meta={section.key === 'ui' ? `schemaVersion ${schemaVersion}` : undefined} onReset={() => onResetSection(section.key)} />
            {section.content}
          </div>
        </Panel>
      ))}
      {device !== 'mobile' ? (
        <Panel title="键位">
          <div className={styles.panelBody}>
            <SectionHeader title="键位" onReset={() => onResetSection('keyboard')} />
            <Switch checked={draft.keyboard.enabled} onChange={(checked) => setDraft({ ...draft, keyboard: { ...draft.keyboard, enabled: checked } })} label="启用键盘快捷键" />
            <div className={styles.keyboardGrid}>
              {Object.entries(draft.keyboard.bindings).map(([key, value]) => (
                <LabeledField key={key} label={key}>
                  <Input
                    value={value}
                    onChange={(next) => setDraft({
                      ...draft,
                      keyboard: {
                        ...draft.keyboard,
                        bindings: {
                          ...draft.keyboard.bindings,
                          [key]: next,
                        },
                      },
                    })}
                  />
                </LabeledField>
              ))}
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function SectionHeader({
  title,
  meta,
  onReset,
}: {
  readonly title: string;
  readonly meta?: string;
  readonly onReset: () => void;
}) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        {meta ? <div className={styles.sectionMeta}>{meta}</div> : null}
      </div>
      <Button variant="ghost" onClick={onReset}>重置本节</Button>
    </div>
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
