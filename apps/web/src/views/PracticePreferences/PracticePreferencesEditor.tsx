// lint-allow-ui-copy: SIK-27 practice-preferences editor lands before the
// shared Practice ui-copy namespace exists. Settings labels and messages stay
// inline for this phase and will move into @/lib/ui-copy during the later
// copy consolidation pass.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/form/Button';
import { PageHeader } from '../../components/layout';
import { Banner } from '../../components/overlay';
import { usePatchPracticePreferences, usePutPracticePreferences, useResetPracticePreferences } from '@sikao/api-client/queries/practicePreferencesQueries';
import type { PracticePreferencesResponseV2, PracticePreferencesWriteResponseV2 } from '@sikao/api-client/types/practice';
import { useSessionConfigStore } from '@sikao/domain';
import { useDevice } from '@sikao/shared-utils';
import {
  buildKeyboardDuplicateMessage,
  buildPatchRequest,
  isSchemaMismatch,
  type LocalPreferencesPayload,
  type Message,
  type PreferencesSection,
  toWirePayload,
} from './PracticePreferencesModel';
import { PracticePreferencesSections } from './PracticePreferencesSections';
import styles from './PracticePreferences.module.css';

export function PracticePreferencesEditor({
  initialDraft,
  schemaVersion,
  onBack,
  onReloadLatest,
  message,
  setMessage,
}: {
  readonly initialDraft: LocalPreferencesPayload;
  readonly schemaVersion: number;
  readonly onBack: () => void;
  readonly onReloadLatest: () => Promise<PracticePreferencesResponseV2 | null>;
  readonly message: Message | null;
  readonly setMessage: (message: Message | null) => void;
}) {
  const device = useDevice();
  const patchPreferences = usePatchPracticePreferences();
  const putPreferences = usePutPracticePreferences();
  const resetPreferences = useResetPracticePreferences();
  const [draft, setDraft] = useState<LocalPreferencesPayload>(initialDraft);
  const draftRevisionRef = useRef(0);
  const hasPatchedRef = useRef(false);
  const lastSyncedFingerprintRef = useRef(JSON.stringify(initialDraft));
  const keyboardMessage = useMemo(
    () => buildKeyboardDuplicateMessage(draft.keyboard.bindings),
    [draft.keyboard.bindings],
  );
  const activeMessage = keyboardMessage ?? message;
  const draftFingerprint = useMemo(() => JSON.stringify(draft), [draft]);

  const applyWriteResponse = useCallback((response: PracticePreferencesWriteResponseV2, requestRevision: number) => {
    if (requestRevision !== draftRevisionRef.current) {
      return;
    }
    setDraft((current) => {
      const next = {
        ...current,
        ...response.payload,
        ui: response.payload.ui ? { ...current.ui, ...response.payload.ui } : current.ui,
        pacing: response.payload.pacing ? { ...current.pacing, ...response.payload.pacing } : current.pacing,
        autoSave: response.payload.autoSave ? { ...current.autoSave, ...response.payload.autoSave } : current.autoSave,
        keyboard: response.payload.keyboard
          ? {
              enabled: response.payload.keyboard.enabled ?? current.keyboard.enabled,
              bindings: {
                ...current.keyboard.bindings,
                ...(response.payload.keyboard.bindings ?? {}),
              },
            }
          : current.keyboard,
        reminders: response.payload.reminders ? { ...current.reminders, ...response.payload.reminders } : current.reminders,
        customPractice: response.payload.customPractice ? { ...current.customPractice, ...response.payload.customPractice } : current.customPractice,
      };
      lastSyncedFingerprintRef.current = JSON.stringify(next);
      return next;
    });
    const customPractice = response.payload.customPractice ?? initialDraft.customPractice;
    useSessionConfigStore.getState().bootstrapFromPracticePreferences({
      schemaVersion: response.schemaVersion,
      payload: { customPractice },
    });
  }, [initialDraft.customPractice]);

  const updateDraft: React.Dispatch<React.SetStateAction<LocalPreferencesPayload>> = useCallback((updater) => {
    draftRevisionRef.current += 1;
    setDraft((current) => (typeof updater === 'function' ? updater(current) : updater));
  }, []);

  useEffect(() => {
    if (!hasPatchedRef.current) {
      hasPatchedRef.current = true;
      return;
    }
    if (keyboardMessage) return;
    if (draftFingerprint === lastSyncedFingerprintRef.current) return;
    const requestRevision = draftRevisionRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await patchPreferences.mutateAsync(buildPatchRequest(draft, schemaVersion));
        applyWriteResponse(response, requestRevision);
      } catch (error) {
        if (isSchemaMismatch(error)) {
          await onReloadLatest();
          return;
        }
        setMessage({ variant: 'err', title: '自动同步失败', description: String(error) });
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftFingerprint, draft, schemaVersion, keyboardMessage, patchPreferences, onReloadLatest, setMessage, applyWriteResponse]);

  async function handleSave() {
    if (keyboardMessage) return;
    try {
      draftRevisionRef.current += 1;
      const requestRevision = draftRevisionRef.current;
      const response = await putPreferences.mutateAsync({
        schemaVersion,
        payload: toWirePayload(draft),
      });
      applyWriteResponse(response, requestRevision);
      setMessage({ variant: 'ok', title: '练习偏好已保存' });
    } catch (error) {
      if (isSchemaMismatch(error)) {
        await onReloadLatest();
        return;
      }
      setMessage({ variant: 'err', title: '保存失败', description: String(error) });
    }
  }

  async function handleReset(sections?: PreferencesSection[]) {
    try {
      draftRevisionRef.current += 1;
      const requestRevision = draftRevisionRef.current;
      const response = await resetPreferences.mutateAsync(
        sections
          ? { sections }
          : { sections: ['ui', 'pacing', 'auto_save', 'keyboard', 'reminders', 'custom_practice'] },
      );
      applyWriteResponse(response, requestRevision);
      setMessage({
        variant: 'ok',
        title: sections ? '本节设置已重置' : '练习偏好已恢复默认值',
      });
    } catch (error) {
      if (isSchemaMismatch(error)) {
        await onReloadLatest();
        return;
      }
      setMessage({ variant: 'err', title: '重置失败', description: String(error) });
    }
  }

  return (
    <div className={styles.root} data-testid="practice-preferences-view">
      <PageHeader
        title="练习偏好"
        subtitle="同步自定义刷题、键位、答题节奏与提醒设置"
        actions={(
          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={onBack}>返回练习中心</Button>
            <Button variant="ghost" onClick={() => void handleReset()}>恢复默认</Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={keyboardMessage !== null}>
              保存设置
            </Button>
          </div>
        )}
      />

      {activeMessage ? (
        <Banner
          variant={activeMessage.variant}
          title={activeMessage.title}
          description={activeMessage.description}
          dismissible
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      <PracticePreferencesSections
        draft={draft}
        setDraft={updateDraft}
        schemaVersion={schemaVersion}
        device={device}
        onResetSection={(section) => void handleReset([section])}
      />

      <p className={styles.footerNotice}>
        当前页面通过 GET / PUT / PATCH / RESET 同步到 practice_preferences；自定义刷题弹窗会复用这里的 customPractice 默认值。
      </p>
    </div>
  );
}
