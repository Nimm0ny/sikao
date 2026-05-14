/**
 * PracticeCenter — /practice/center 行测+申论统一入口 (PR16, 2026-05-13).
 *
 * 来源 SSOT:
 *   - docs/plan/practice-center-mobile-tablet-redesign.md §1 + §4 PR16
 *   - docs/design/Mobile and Tablet Pack New.html M9 · 练习目录 + M10 · 试卷库
 *   - docs/design/Frontend Style Guide.html (PR1-5 token / primitive SSOT)
 *
 * 用户价值 (lhr 2026-05-12 supreme):
 *   把行测/申论原 4 个独立入口 (/papers + /xingce/specialty + /essay/papers +
 *   /essay/specialty) 合并为单一 hub. 顶部 tab 选科目, 2 大 card 选练习模式
 *   (分类专攻 / 套卷模考). 旧 URL 全部 redirect 到新 canonical sub-path,
 *   老书签 / 外链 0 404.
 *
 * 子路由 (router/index.tsx 配对):
 *   /practice/center/xingce/categories  → CategoryTree    (行测专项)
 *   /practice/center/xingce/papers      → Papers          (行测套卷)
 *   /practice/center/essay/categories   → EssaySpecialty  (申论专项)
 *   /practice/center/essay/papers       → EssayPapers     (申论套卷)
 *
 * 设计铁线 (lhr 拍板, 不许前端元素创新):
 *   - 0 token / radius / typography / 新 primitive
 *   - 复用 PageHeader / Card (variant=default hoverable) / 现有 SVG icon
 *   - subject tab 复用 Tabs primitive (variant='underline') — M9/M10 顶 tab 同 pattern
 *   - 大 card 复用 Card primitive 默认 padding=lg, 进入有 hover:shadow-pop
 *
 * URL state:
 *   - ?subject=xingce | essay (无值 → 默认 xingce)
 *   - 切 tab → 更新 query, 不动 path (本 view stay on /practice/center)
 *   - 点 card → navigate 到 /practice/center/{subject}/{categories|papers}
 *
 * 不做的事:
 *   - 不复刻 M9 章节树 / M10 地区列表 (那是子路由 view 的职责, 这里只是 hub)
 *   - 不渲染 device dispatch (Card grid mobile 1 列 / tablet+ 2 列, Tailwind 一行搞定)
 *   - 不挂 hover prefetch (子 view 已 lazy split, route-level 现成)
 */
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Tabs, type TabItem } from '@sikao/ui/ui';
import { PRACTICE_CENTER_COPY } from '@/lib/ui-copy';

type Subject = 'xingce' | 'essay';

const SUBJECT_TABS: readonly TabItem<Subject>[] = [
  {
    value: 'xingce',
    label: PRACTICE_CENTER_COPY.subjects.xingce,
    testId: 'practice-center-tab-xingce',
  },
  {
    value: 'essay',
    label: PRACTICE_CENTER_COPY.subjects.essay,
    testId: 'practice-center-tab-essay',
  },
];

function parseSubject(raw: string | null): Subject {
  return raw === 'essay' ? 'essay' : 'xingce';
}

export default function PracticeCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const subject = useMemo(
    () => parseSubject(searchParams.get('subject')),
    [searchParams],
  );

  const handleSubjectChange = useCallback(
    (next: Subject): void => {
      // 不动 path, 只更 query — Tabs 切换是本 view 内 state, 不该 reload children.
      const params: Record<string, string> = {};
      if (next !== 'xingce') params.subject = next;
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const handleEnterCategories = useCallback((): void => {
    navigate(`/practice/center/${subject}/categories`);
  }, [navigate, subject]);

  const handleEnterPapers = useCallback((): void => {
    navigate(`/practice/center/${subject}/papers`);
  }, [navigate, subject]);

  return (
    <div
      className="p-4 md:p-8 max-w-6xl mx-auto space-y-6"
      data-testid="practice-center-view"
    >
      <PageHeader
        eyebrow={PRACTICE_CENTER_COPY.pageEyebrow}
        title={PRACTICE_CENTER_COPY.pageTitle}
        subtitle={PRACTICE_CENTER_COPY.pageSubtitle}
      />

      <Tabs
        items={SUBJECT_TABS}
        value={subject}
        onChange={handleSubjectChange}
        variant="underline"
        ariaLabel={PRACTICE_CENTER_COPY.subjectsAriaLabel}
      />

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5"
        data-testid="practice-center-entries"
      >
        <EntryCard
          label={PRACTICE_CENTER_COPY.entries.categories.title}
          description={PRACTICE_CENTER_COPY.entries.categories.description}
          onSelect={handleEnterCategories}
          testId="practice-center-entry-categories"
          icon={<EntryCategoriesIcon />}
        />
        <EntryCard
          label={PRACTICE_CENTER_COPY.entries.papers.title}
          description={PRACTICE_CENTER_COPY.entries.papers.description}
          onSelect={handleEnterPapers}
          testId="practice-center-entry-papers"
          icon={<EntryPapersIcon />}
        />
      </div>
    </div>
  );
}

interface EntryCardProps {
  readonly label: string;
  readonly description: string;
  readonly onSelect: () => void;
  readonly testId: string;
  readonly icon: React.ReactNode;
}

function EntryCard({ label, description, onSelect, testId, icon }: EntryCardProps) {
  return (
    <Card
      as="article"
      padding="lg"
      hoverable
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={label}
      data-testid={testId}
      className="cursor-pointer min-h-[180px] flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-card bg-paper-2 text-ink-1 flex items-center justify-center"
        >
          {icon}
        </span>
        <h2 className="font-serif text-h-card font-semibold text-ink">{label}</h2>
      </div>
      <p className="text-sm leading-relaxed text-ink-3">{description}</p>
    </Card>
  );
}

// 内联 SVG, 1.6px stroke currentColor, 跟现有 components/icons SSOT 同 spec.
// 不引入 lucide / heroicons (CLAUDE.md §4 答题闭环 SVG-only 铁线).
function EntryCategoriesIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5h6v6H4z" />
      <path d="M14 5h6v6h-6z" />
      <path d="M4 13h6v6H4z" />
      <path d="M14 13h6v6h-6z" />
    </svg>
  );
}

function EntryPapersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4h14v16H5z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}
