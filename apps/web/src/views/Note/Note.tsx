// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.3 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useState } from 'react';
import { Badge, Chip, SpriteIcon } from '../../components/atom';
import { Drawer } from '../../components/overlay';
import { PageHeader } from '../../components/layout';
import { Search } from '../../components/form';
import { Button } from '../../components/form';
import styles from './Note.module.css';

/*
 * Note view — V5 D.4.3 desktop page skeleton.
 *
 * Why: container tree per design.md §D.4.3 — 3-row Workspace grid:
 *      header (with search input + 新建手记 CTA) → FilterBar (来源 chip
 *      multi-select + 收藏 / 近 7 天 toggle) → SubBar (count + sort) →
 *      NotesGrid (sticky 200×140 cards with -2..+2deg tilt simulating
 *      paper notes; hover lifts -2px and resets tilt). FilterBar uses
 *      bespoke chip surface — the spec calls for an inverted black active
 *      state (R2/Q1 visual) which the V5-M3 Chip primitive doesn't model
 *      yet, so we build the toggle with a plain button + [data-active].
 *
 *      Detail interaction is hard-pinned to <Drawer side="right" size="lg">
 *      per design.md §D.4.3 R2/Q1 + §D.3.35 gotcha. **Modal MUST NOT be
 *      used for note detail** — Modal's 640px max would crowd a rich-text
 *      editor and lose the notes-wall context on the left. Mobile auto-
 *      converts to <Sheet side="bottom"> in the business Phase wire-up.
 *
 *      TODO §C.4.6: dedicated sticky-shadow token (design.md §D.4.3 specs
 *      a bespoke 0 1px 0 rgba(255,255,255,.6) inset, 0 12px 28px -10px ...
 *      shadow value); Phase 5+ design-system follow-up lands the token,
 *      this skeleton uses --card-shadow-rest as a placeholder.
 */

type Source = 'all' | 'free' | 'q' | 'knowledge' | 'mistake';
type Toggle = 'favorite' | 'recent7';

const SOURCE_OPTIONS: ReadonlyArray<{ readonly key: Source; readonly label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'free', label: '自由' },
  { key: 'q', label: '题级' },
  { key: 'knowledge', label: '知识点' },
  { key: 'mistake', label: '错题反思' },
];

const TOGGLE_OPTIONS: ReadonlyArray<{ readonly key: Toggle; readonly label: string }> = [
  { key: 'favorite', label: '收藏' },
  { key: 'recent7', label: '近 7 天' },
];

interface NoteCard {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly source: Source;
  readonly time: string;
  readonly starred: boolean;
  readonly tilt: -2 | -1 | 0 | 1 | 2;
}

const PLACEHOLDER_NOTES: ReadonlyArray<NoteCard> = [
  { id: 'n1', title: '主旨概括 · 关键句优先', summary: '关键句通常出现在材料第一段或最后一段；并列结构看连接词。', source: 'q', time: '今天 10:24', starred: true, tilt: -2 },
  { id: 'n2', title: '速算 · 估算技巧', summary: '增长率综合题先估，差距 > 5pp 才精算。', source: 'mistake', time: '昨天 21:50', starred: false, tilt: 1 },
  { id: 'n3', title: '判断推理 · 类比定位', summary: '先抓核心关系，再看修饰词；并列项与递进项不通用。', source: 'knowledge', time: '前天 18:12', starred: true, tilt: -1 },
  { id: 'n4', title: '申论 · 大作文结构', summary: '总分总；分论点之间用过渡句串接。', source: 'free', time: '3 天前', starred: false, tilt: 2 },
  { id: 'n5', title: '资料分析 · 题型识别', summary: '看问句最后两个字（增长 / 比重 / 倍数 / 平均）决定公式。', source: 'q', time: '4 天前', starred: false, tilt: 0 },
  { id: 'n6', title: '判断推理 · 类比 vs 定义', summary: '类比看关系，定义看主体；切勿混淆。', source: 'knowledge', time: '5 天前', starred: true, tilt: -1 },
];

export function Note() {
  const [activeSource, setActiveSource] = useState<Source>('all');
  const [activeToggles, setActiveToggles] = useState<ReadonlySet<Toggle>>(new Set());
  const [search, setSearch] = useState('');
  const [drawerNote, setDrawerNote] = useState<NoteCard | null>(null);

  const visibleNotes = PLACEHOLDER_NOTES.filter((n) => {
    if (activeSource !== 'all' && n.source !== activeSource) return false;
    if (activeToggles.has('favorite') && !n.starred) return false;
    if (search.length > 0 && !n.title.includes(search) && !n.summary.includes(search)) return false;
    return true;
  });

  const toggleToggle = (key: Toggle) => {
    setActiveToggles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className={styles.root} data-testid="note-view">
      <PageHeader
        title="笔记"
        subtitle={`共 ${PLACEHOLDER_NOTES.length} 条 · 显示 ${visibleNotes.length} 条`}
        actions={
          <span className={styles.headerActions}>
            <Search value={search} onChange={setSearch} placeholder="搜索笔记" size="sm" />
            <Button variant="primary">新建手记</Button>
          </span>
        }
      />

      <div className={styles.filterBar} data-testid="note-filter-bar" aria-label="笔记筛选">
        <span className={styles.filterGroup} aria-label="来源">
          {SOURCE_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              size="md"
              active={activeSource === opt.key}
              onSelect={() => setActiveSource(opt.key)}
            >
              {opt.label}
            </Chip>
          ))}
        </span>
        <span className={styles.filterGroup} aria-label="状态">
          {TOGGLE_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              variant={opt.key === 'favorite' ? 'brand' : 'neutral'}
              size="md"
              active={activeToggles.has(opt.key)}
              onSelect={() => toggleToggle(opt.key)}
            >
              {opt.label}
            </Chip>
          ))}
        </span>
      </div>

      <div className={styles.subBar} data-testid="note-sub-bar">
        <span>共 {visibleNotes.length} 条 · 按时间倒序</span>
        <span>卡片视图</span>
      </div>

      <ul className={styles.notesGrid} data-testid="note-grid" role="list">
        {visibleNotes.map((note) => (
          <li key={note.id} className={styles.stickyCell}>
            <button
              type="button"
              className={styles.sticky}
              data-tilt={String(note.tilt)}
              data-testid={`note-card-${note.id}`}
              onClick={() => setDrawerNote(note)}
            >
              <span className={styles.stickyHeader}>
                <Badge variant="neutral" size="sm">{labelForSource(note.source)}</Badge>
                {note.starred ? <StarIcon /> : null}
              </span>
              <h3 className={styles.stickyTitle}>{note.title}</h3>
              <p className={styles.stickySummary}>{note.summary}</p>
              <span className={styles.stickyMeta}>
                <span>{note.time}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Drawer
        open={drawerNote !== null}
        onClose={() => setDrawerNote(null)}
        side="right"
        size="lg"
        title={drawerNote?.title ?? ''}
      >
        <div className={styles.detailBody}>
          <p>{drawerNote?.summary}</p>
          <p>笔记详情视图占位 — 真实富文本编辑由 Notes 业务 Phase（SIK-44 家族）接入。</p>
        </div>
      </Drawer>
    </div>
  );
}

function labelForSource(s: Source): string {
  switch (s) {
    case 'all': return '全部';
    case 'free': return '自由';
    case 'q': return '题级';
    case 'knowledge': return '知识点';
    case 'mistake': return '错题反思';
  }
}

function StarIcon() {
  return <SpriteIcon id="bookmark" size={14} aria-label="已收藏" />;
}
