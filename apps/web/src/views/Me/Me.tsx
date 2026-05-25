// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.4 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Numeric } from '../../components/atom';
import { ListItem } from '../../components/list';
import { ConfirmDialog } from '../../components/overlay';
import { Panel, PageHeader, ScreenLockShell } from '../../components/layout';
import styles from './Me.module.css';

interface MeStats {
  readonly streakDays: number;
  readonly totalQuestions: number;
  readonly accuracyPct: number;
}

const PLACEHOLDER_STATS: MeStats = {
  streakDays: 23,
  totalQuestions: 5862,
  accuracyPct: 76.4,
};

interface SettingItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
}

const STUDY_SETTINGS: ReadonlyArray<SettingItem> = [
  { id: 'practice-preferences', title: '练习偏好', subtitle: '自定义刷题、键位、提醒与答题节奏' },
  { id: 'remind', title: '提醒时间', subtitle: '每天 09:00 / 21:00' },
  { id: 'theme', title: '外观主题', subtitle: '跟随系统' },
  { id: 'density', title: '密度', subtitle: '舒适' },
];

const ACCOUNT_SETTINGS: ReadonlyArray<SettingItem> = [
  { id: 'email', title: '邮箱', subtitle: 'lhr@example.com' },
  { id: 'password', title: '密码', subtitle: '上次修改 30 天前' },
  { id: 'export', title: '导出数据', subtitle: '笔记 / 错题 / 学习记录' },
];

const DANGER_SETTINGS: ReadonlyArray<SettingItem> = [
  { id: 'logout', title: '退出登录', subtitle: '当前设备结束会话' },
  { id: 'cache', title: '清除缓存', subtitle: '本地题库与笔记缓存' },
  { id: 'delete', title: '注销账号', subtitle: '永久删除全部数据，不可恢复' },
];

export function Me() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <ScreenLockShell rows="auto auto auto minmax(0, 1fr)" testId="me-view">
      <PageHeader title="我的" subtitle="账号 / 设置 / 学习数据" />

      <article className={styles.hero} data-testid="me-hero">
        <Avatar fallback="L" size="xl" status="online" alt="lhr" />
        <div className={styles.heroInfo}>
          <h2 className={styles.heroName}>lhr</h2>
          <span className={styles.heroMeta}>
            注册 2 年 142 天
            <Badge variant="brand" size="sm">Lv 12</Badge>
          </span>
        </div>
        <div className={styles.heroStats}>
          <span className={styles.heroStatCell}>
            <span className={styles.heroStatLabel}>连续学习</span>
            <Numeric value={PLACEHOLDER_STATS.streakDays} unit="天" size="h2" emphasis="value" />
          </span>
          <span className={styles.heroStatCell}>
            <span className={styles.heroStatLabel}>累计做题</span>
            <Numeric value={PLACEHOLDER_STATS.totalQuestions} size="h2" emphasis="value" />
          </span>
          <span className={styles.heroStatCell}>
            <span className={styles.heroStatLabel}>正确率</span>
            <Numeric value={PLACEHOLDER_STATS.accuracyPct} unit="%" size="h2" emphasis="value" />
          </span>
        </div>
      </article>

      <section className={styles.grid} aria-label="账号与设置">
        <Panel title="学习设置">
          <ul className={styles.list} role="list">
            {STUDY_SETTINGS.map((setting) => (
              <li key={setting.id}>
                <ListItem
                  title={setting.title}
                  subtitle={setting.subtitle}
                  onPress={() => {
                    if (setting.id === 'practice-preferences') {
                      navigate('/profile/practice-preferences');
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="账号">
          <ul className={styles.list} role="list">
            {ACCOUNT_SETTINGS.map((setting) => (
              <li key={setting.id}>
                <ListItem title={setting.title} subtitle={setting.subtitle} onPress={() => {}} />
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <Panel title="危险操作" variant="danger">
        <ul
          className={`${styles.list} ${styles.dangerList}`}
          role="list"
          data-testid="me-danger-list"
        >
          {DANGER_SETTINGS.map((setting) => (
            <li key={setting.id}>
              <ListItem
                title={setting.title}
                subtitle={setting.subtitle}
                onPress={() => {
                  if (setting.id === 'delete' || setting.id === 'logout') {
                    setConfirmOpen(true);
                  }
                }}
              />
            </li>
          ))}
        </ul>
      </Panel>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="确认操作"
        description="此操作将结束当前会话或删除账号数据，无法撤销。"
        confirmText="确认"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
        }}
      />
    </ScreenLockShell>
  );
}
