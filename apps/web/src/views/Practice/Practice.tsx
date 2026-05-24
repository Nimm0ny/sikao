// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.2 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useState } from 'react';
import { Badge, ProgressLinear } from '../../components/atom';
import { ScopeToggle } from '../../components/business';
import { ListItem } from '../../components/list';
import { Panel, PageHeader } from '../../components/layout';
import { Button } from '../../components/form';
import styles from './Practice.module.css';

/*
 * Practice view — V5 D.4.2 desktop page skeleton.
 *
 * Why: container tree per design.md §D.4.2 — 4-row Workspace grid:
 *      header (with ScopeToggle 行测/申论) → row1 quick-grid 2×2 + 最近练习
 *      list → specialty 4-col grid → paper 4-col grid. Subtitle text
 *      below the page title swaps with the active scope (test invariant).
 *
 *      row1 height collapses from 224px → 192px under @media (max-height:
 *      800px) per spec — a CSS-only laptop-ergonomics tweak, no JS.
 *      Placeholder data only; real specialties / papers ship with the
 *      Practice business Phase (SIK-20+ family).
 */

type Scope = 'xc' | 'sl';

interface QuickItem {
  readonly key: string;
  readonly title: string;
  readonly meta: string;
}

interface RecentItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
}

interface SpecialtyItem {
  readonly key: string;
  readonly catVariant:
    | 'cat-yanyu'
    | 'cat-shuliang'
    | 'cat-panduan'
    | 'cat-ziliao'
    | 'cat-shenlun';
  readonly catLabel: string;
  readonly name: string;
  readonly count: number;
  readonly progress: number;
}

interface PaperItem {
  readonly id: string;
  readonly title: string;
  readonly count: number;
  readonly minutes: number;
  readonly status: { readonly variant: 'neutral' | 'ok' | 'warn'; readonly label: string };
}

const SCOPE_SUBTITLE: Record<Scope, string> = {
  xc: '行测 · 5 大题型按专项纵切',
  sl: '申论 · 4 类材料题 + 大作文',
};

const QUICK_ITEMS: ReadonlyArray<QuickItem> = [
  { key: 'daily', title: '每日一练', meta: '20 题 · 25 分钟' },
  { key: 'weak', title: '薄弱专项', meta: '基于错题分布推荐' },
  { key: 'mock', title: '真题模考', meta: '120 题 · 完整考试时长' },
  { key: 'review', title: '错题回顾', meta: '42 道待复习' },
];

const RECENT_ITEMS: ReadonlyArray<RecentItem> = [
  { id: 'r1', title: '言语理解 · 主旨概括 10 题', subtitle: '昨天 21:42 · 正确率 70%' },
  { id: 'r2', title: '资料分析 · 增长率综合', subtitle: '前天 19:15 · 进行中' },
  { id: 'r3', title: '判断推理 · 类比专项', subtitle: '3 天前 · 正确率 85%' },
];

const SPECIALTY_BY_SCOPE: Record<Scope, ReadonlyArray<SpecialtyItem>> = {
  xc: [
    { key: 'yy', catVariant: 'cat-yanyu', catLabel: '言语', name: '主旨概括', count: 320, progress: 0.62 },
    { key: 'sl', catVariant: 'cat-shuliang', catLabel: '数量', name: '行程问题', count: 180, progress: 0.34 },
    { key: 'pd', catVariant: 'cat-panduan', catLabel: '判断', name: '类比推理', count: 240, progress: 0.78 },
    { key: 'zl', catVariant: 'cat-ziliao', catLabel: '资料', name: '增长率综合', count: 140, progress: 0.45 },
  ],
  sl: [
    { key: 'sl1', catVariant: 'cat-shenlun', catLabel: '申论', name: '归纳概括', count: 60, progress: 0.20 },
    { key: 'sl2', catVariant: 'cat-shenlun', catLabel: '申论', name: '提出对策', count: 45, progress: 0.10 },
    { key: 'sl3', catVariant: 'cat-shenlun', catLabel: '申论', name: '综合分析', count: 50, progress: 0.05 },
    { key: 'sl4', catVariant: 'cat-shenlun', catLabel: '申论', name: '大作文', count: 30, progress: 0.0 },
  ],
};

const PAPERS: ReadonlyArray<PaperItem> = [
  { id: 'p1', title: '2024 国考 · 副省级', count: 135, minutes: 120, status: { variant: 'ok', label: '已完成' } },
  { id: 'p2', title: '2024 国考 · 地市级', count: 130, minutes: 120, status: { variant: 'warn', label: '进行中' } },
  { id: 'p3', title: '2024 联考 · 江苏 A', count: 135, minutes: 120, status: { variant: 'neutral', label: '未开始' } },
  { id: 'p4', title: '2024 联考 · 浙江 A', count: 135, minutes: 120, status: { variant: 'neutral', label: '未开始' } },
];

export function Practice() {
  const [scope, setScope] = useState<Scope>('xc');
  const specialties = SPECIALTY_BY_SCOPE[scope];

  return (
    <div className={styles.root} data-testid="practice-view">
      <PageHeader
        title="练习中心"
        subtitle={SCOPE_SUBTITLE[scope]}
        actions={<Button variant="primary">继续上次</Button>}
      />

      <div className={styles.row1}>
        <section className={styles.quickGrid} aria-label="快速入口">
          {QUICK_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={styles.quickCard}
              data-testid={`practice-quick-${item.key}`}
            >
              <h3 className={styles.quickTitle}>{item.title}</h3>
              <p className={styles.quickMeta}>{item.meta}</p>
            </button>
          ))}
        </section>

        <Panel
          title="最近练习"
          trailing={
            <ScopeToggle
              scopes={[
                { key: 'xc', label: '行测' },
                { key: 'sl', label: '申论' },
              ]}
              active={scope}
              onChange={(key) => setScope(key as Scope)}
              aria-label="练习范围"
            />
          }
        >
          <ul className={styles.recentList} role="list">
            {RECENT_ITEMS.map((item) => (
              <li key={item.id}>
                <ListItem size="sm" title={item.title} subtitle={item.subtitle} onPress={() => {}} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="专项练习">
        <div
          className={styles.specialtyGrid}
          data-testid="practice-specialty-grid"
          aria-label="专项题型列表"
        >
          {specialties.map((s) => (
            <article key={s.key} className={styles.specialtyCard} data-testid={`practice-specialty-${s.key}`}>
              <div className={styles.specialtyHeader}>
                <Badge variant={s.catVariant} size="sm">{s.catLabel}</Badge>
                <span className={styles.specialtyName}>{s.name}</span>
              </div>
              <span className={styles.specialtyMeta}>{s.count} 题</span>
              <ProgressLinear value={s.progress * 100} aria-label={`${s.name}掌握进度`} />
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="套卷">
        <div className={styles.paperGrid} aria-label="套卷列表">
          {PAPERS.map((p) => (
            <article key={p.id} className={styles.paperCard} data-testid={`practice-paper-${p.id}`}>
              <span className={styles.paperTitle}>{p.title}</span>
              <span className={styles.paperMeta}>
                <span>{p.count} 题 · {p.minutes} 分钟</span>
                <Badge variant={p.status.variant} size="sm">{p.status.label}</Badge>
              </span>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
