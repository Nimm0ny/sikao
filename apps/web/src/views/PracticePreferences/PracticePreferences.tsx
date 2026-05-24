// lint-allow-ui-copy: SIK-27 practice-preferences page lands before the
// shared Practice ui-copy namespace exists. Settings labels and messages stay
// inline for this phase and will move into @/lib/ui-copy during the later
// copy consolidation pass.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../../components/atom';
import { PageHeader, Panel } from '../../components/layout';
import { Banner } from '../../components/overlay';
import { usePracticePreferences } from '@sikao/api-client/queries/practicePreferencesQueries';
import { useSessionConfigStore } from '@sikao/domain';
import { PracticePreferencesEditor } from './PracticePreferencesEditor';
import { mergePayload, type Message } from './PracticePreferencesModel';
import styles from './PracticePreferences.module.css';

export function PracticePreferences() {
  const navigate = useNavigate();
  const preferencesQuery = usePracticePreferences();
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (!preferencesQuery.data) return;
    useSessionConfigStore.getState().bootstrapFromPracticePreferences({
      schemaVersion: preferencesQuery.data.schemaVersion,
      payload: { customPractice: mergePayload(preferencesQuery.data.payload).customPractice },
    });
  }, [preferencesQuery.data]);

  const initialDraft = useMemo(
    () => mergePayload(preferencesQuery.data?.payload),
    [preferencesQuery.data],
  );

  if (preferencesQuery.isLoading) {
    return (
      <div className={styles.root} data-testid="practice-preferences-view">
        <PageHeader title="练习偏好" subtitle="同步自定义刷题、键位、答题节奏与提醒设置" />
        <div className={styles.grid}>
          {Array.from({ length: 4 }, (_, index) => (
            <Panel key={index} title="加载中">
              <div className={styles.panelBody}>
                <Skeleton variant="text" lines={5} />
              </div>
            </Panel>
          ))}
        </div>
      </div>
    );
  }

  if (preferencesQuery.isError || !preferencesQuery.data) {
    return (
      <div className={styles.root} data-testid="practice-preferences-view">
        <PageHeader title="练习偏好" subtitle="同步自定义刷题、键位、答题节奏与提醒设置" />
        <Banner
          variant="err"
          title="练习偏好加载失败"
          description="请重试，或稍后再打开该页面。"
          action={{ label: '重试', onClick: () => void preferencesQuery.refetch() }}
        />
      </div>
    );
  }

  return (
    <PracticePreferencesEditor
      key={`${preferencesQuery.data.schemaVersion}-${preferencesQuery.data.updatedAt ?? 'default'}`}
      initialDraft={initialDraft}
      schemaVersion={preferencesQuery.data.schemaVersion}
      onBack={() => navigate('/practice')}
      onReloadLatest={async () => {
        const next = await preferencesQuery.refetch();
        if (next.data) {
          setMessage({
            variant: 'warn',
            title: '已加载最新配置',
            description: '服务端 schemaVersion 已更新，请基于最新配置重新确认后再保存。',
          });
          return next.data;
        }
        return null;
      }}
      message={message}
      setMessage={setMessage}
    />
  );
}
