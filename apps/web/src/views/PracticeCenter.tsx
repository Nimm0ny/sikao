import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookMarked,
  ChevronRight,
  Filter,
  FileText,
  History,
  Layers,
  Loader2,
  Star,
  Target,
} from 'lucide-react';
import {
  useContinueLastSession,
  useWeakModules,
  type PracticeSessionSummary,
  type WeakModule,
} from '@sikao/domain/dashboard/useHomeData';
import {
  MvpButton,
  MvpCard,
  MvpChip,
  MvpFilterPanel,
  MvpPage,
} from '@/components/mvp';

type Subject = 'xingce' | 'essay';
type FilterKey = 'all' | 'easy' | 'normal' | 'hard';

const subjectTabs: ReadonlyArray<{ value: Subject; label: string }> = [
  { value: 'xingce', label: '行测' },
  { value: 'essay', label: '申论' },
];

const filters: ReadonlyArray<{
  key: 'difficulty' | 'type' | 'source';
  label: string;
  options: ReadonlyArray<{ value: FilterKey; label: string }>;
}> = [
  {
    key: 'difficulty',
    label: '难度',
    options: [
      { value: 'all', label: '全部' },
      { value: 'easy', label: '基础' },
      { value: 'normal', label: '提高' },
      { value: 'hard', label: '冲刺' },
    ],
  },
  {
    key: 'type',
    label: '题型',
    options: [
      { value: 'all', label: '全部' },
      { value: 'easy', label: '专项' },
      { value: 'normal', label: '套卷' },
      { value: 'hard', label: '错题' },
    ],
  },
  {
    key: 'source',
    label: '来源',
    options: [
      { value: 'all', label: '全部' },
      { value: 'easy', label: '真题' },
      { value: 'normal', label: '智能推荐' },
      { value: 'hard', label: '收藏' },
    ],
  },
];

function parseSubject(raw: string | null): Subject {
  return raw === 'essay' ? 'essay' : 'xingce';
}

export default function PracticeCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const subject = useMemo(() => parseSubject(searchParams.get('subject')), [searchParams]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, FilterKey>>({
    difficulty: 'all',
    type: 'all',
    source: 'all',
  });
  const lastSessionQ = useContinueLastSession();
  const weakQ = useWeakModules({ limit: 3 });

  const changeSubject = useCallback(
    (next: Subject) => {
      const params = new URLSearchParams(searchParams);
      if (next === 'xingce') params.delete('subject');
      else params.set('subject', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const applyFilter = (key: string, value: FilterKey) => {
    setSelectedFilters((current) => ({ ...current, [key]: value }));
  };

  const activeFilterCount = Object.values(selectedFilters).filter((value) => value !== 'all').length;

  return (
    <MvpPage
      title="练习中心"
      hideHeading
      action={
        <div className="relative">
          <MvpButton
            variant="secondary"
            icon={<Filter className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
            data-testid="practice-filter-toggle"
          >
            筛选{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
          </MvpButton>
          <MvpFilterPanel open={filterOpen}>
            <div className="space-y-4" data-testid="practice-filter-panel">
              {filters.map((filter) => (
                <label key={filter.key} className="grid gap-2 text-sm font-semibold text-[#111827]">
                  <span>{filter.label}</span>
                  <select
                    value={selectedFilters[filter.key] ?? 'all'}
                    onChange={(event) => applyFilter(filter.key, event.target.value as FilterKey)}
                    className="h-10 rounded-lg border border-[#D7DFEC] bg-white px-3 text-sm font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <MvpButton className="w-full" onClick={() => setFilterOpen(false)}>
                应用
              </MvpButton>
            </div>
          </MvpFilterPanel>
        </div>
      }
      testId="practice-center-view"
    >
      <div className="mb-5 inline-flex rounded-lg border border-[#D7DFEC] bg-white p-1" role="tablist" aria-label="练习科目">
        {subjectTabs.map((tab) => {
          const active = tab.value === subject;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={[
                'min-h-10 rounded-md px-5 text-sm font-semibold transition-colors',
                active ? 'bg-[#2563EB] text-white' : 'text-[#4B5563] hover:bg-[#EFF6FF] hover:text-[#2563EB]',
              ].join(' ')}
              onClick={() => changeSubject(tab.value)}
              data-testid={`practice-center-tab-${tab.value}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="练习入口">
            <PracticeEntryCard
              icon={<Target className="h-5 w-5" aria-hidden="true" />}
              title="推荐练习"
              label={subject === 'xingce' ? '资料分析 · 综合提高' : '概括归纳 · 结构训练'}
              description={subject === 'xingce' ? '按当前薄弱模块推荐一组短练。' : '从申论高频题型开始写一题。'}
              chip="推荐"
              onClick={() => navigate(subject === 'xingce' ? '/practice/xingce/categories' : '/practice/essay/categories')}
              testId="practice-entry-recommended"
            />
            <PracticeEntryCard
              icon={<Layers className="h-5 w-5" aria-hidden="true" />}
              title="专项练习"
              label={subject === 'xingce' ? '言语 / 判断 / 数量 / 资料 / 常识' : '概括 / 对策 / 公文 / 作文'}
              description="按知识点和题型拆开练，适合补弱。"
              onClick={() => navigate(`/practice/${subject}/categories`)}
              testId="practice-entry-categories"
            />
            <PracticeEntryCard
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
              title="套卷模考"
              label={subject === 'xingce' ? '全真模拟 · 行测套卷' : '申论套卷 · 限时作答'}
              description="按整卷节奏完成，交卷后看结果页。"
              onClick={() => navigate(`/practice/${subject}/papers`)}
              testId="practice-entry-papers"
            />
          </section>

          <section className="grid gap-5 md:grid-cols-2" aria-label="练习辅助">
            <RecentPracticeCard
              loading={lastSessionQ.isLoading}
              error={lastSessionQ.isError}
              session={lastSessionQ.data ?? null}
              onResume={(session) => navigate(`/practice/sessions/${session.id}`)}
              onOpenPapers={() => navigate(`/practice/${subject}/papers`)}
            />
            <FavoritesCard />
          </section>
        </div>

        <aside className="space-y-5">
          <WeakRecommendationCard
            loading={weakQ.isLoading}
            error={weakQ.isError}
            modules={weakQ.data?.modules ?? []}
            onPractice={(module) => navigate(`/practice/${subject}/categories#${encodeURIComponent(module.subject)}`)}
          />
          <ReasonCard subject={subject} />
        </aside>
      </div>
    </MvpPage>
  );
}

function PracticeEntryCard({
  icon,
  title,
  label,
  description,
  chip,
  onClick,
  testId,
}: {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly label: string;
  readonly description: string;
  readonly chip?: string;
  readonly onClick: () => void;
  readonly testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}：${label}`}
      className="group text-left"
      data-testid={testId}
    >
      <MvpCard className="flex h-full min-h-52 flex-col p-5 transition-transform group-hover:-translate-y-0.5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">{icon}</span>
          {chip ? <MvpChip tone="amber">{chip}</MvpChip> : <ChevronRight className="h-5 w-5 text-[#9CA3AF]" aria-hidden="true" />}
        </div>
        <h2 className="text-base font-semibold text-[#111827]">{title}</h2>
        <p className="mt-3 text-sm font-semibold text-[#111827]">{label}</p>
        <p className="mt-2 text-sm leading-6 text-[#4B5563]">{description}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-[#2563EB]">
          开始练习
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </MvpCard>
    </button>
  );
}

function RecentPracticeCard({
  loading,
  error,
  session,
  onResume,
  onOpenPapers,
}: {
  readonly loading: boolean;
  readonly error: boolean;
  readonly session: PracticeSessionSummary | null;
  readonly onResume: (session: PracticeSessionSummary) => void;
  readonly onOpenPapers: () => void;
}) {
  return (
    <MvpCard className="p-5" testId="practice-recent-card">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
        <h2 className="text-base font-semibold text-[#111827]">最近练习</h2>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#4B5563]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载最近练习
        </p>
      ) : error ? (
        <p className="text-sm text-[#B91C1C]">最近练习接口加载失败。</p>
      ) : session ? (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-[#111827]">{session.paperTitle}</p>
            <p className="mt-1 text-sm text-[#4B5563]">{session.answeredCount} / {session.total} 题</p>
          </div>
          <MvpButton variant="secondary" onClick={() => onResume(session)}>
            继续练习
          </MvpButton>
        </div>
      ) : (
        <div>
          <p className="text-sm leading-6 text-[#4B5563]">暂无最近练习记录。</p>
          <MvpButton variant="secondary" className="mt-4" onClick={onOpenPapers}>
            选择套卷
          </MvpButton>
        </div>
      )}
    </MvpCard>
  );
}

function FavoritesCard() {
  return (
    <MvpCard className="p-5" testId="practice-favorites-card">
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
        <h2 className="text-base font-semibold text-[#111827]">收藏</h2>
      </div>
      <p className="text-sm leading-6 text-[#4B5563]">
        收藏列表当前没有独立 API，本页不展示伪数据。进入题目页收藏后，可在接口补齐后接入。
      </p>
    </MvpCard>
  );
}

function WeakRecommendationCard({
  loading,
  error,
  modules,
  onPractice,
}: {
  readonly loading: boolean;
  readonly error: boolean;
  readonly modules: readonly WeakModule[];
  readonly onPractice: (module: WeakModule) => void;
}) {
  return (
    <MvpCard className="p-5" testId="practice-weak-card">
      <div className="mb-4 flex items-center gap-2">
        <BookMarked className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
        <h2 className="text-base font-semibold text-[#111827]">薄弱推荐</h2>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#4B5563]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载薄弱模块
        </p>
      ) : error ? (
        <p className="text-sm text-[#B91C1C]">薄弱模块接口加载失败。</p>
      ) : modules.length === 0 ? (
        <p className="text-sm leading-6 text-[#4B5563]">暂无薄弱模块数据，先完成一次练习。</p>
      ) : (
        <div className="space-y-3">
          {modules.map((module) => (
            <button
              key={module.subject}
              type="button"
              onClick={() => onPractice(module)}
              className="flex w-full items-center justify-between rounded-lg border border-[#E1E6F0] bg-[#F7F8FB] p-3 text-left transition-colors hover:border-[#BFDBFE] hover:bg-[#EFF6FF]"
            >
              <span>
                <span className="block text-sm font-semibold text-[#111827]">{module.subject}</span>
                <span className="mt-1 block text-xs text-[#4B5563]">{module.suggestedAction}</span>
              </span>
              <MvpChip tone={module.score >= 70 ? 'amber' : 'blue'}>{Math.round(module.score)}</MvpChip>
            </button>
          ))}
        </div>
      )}
    </MvpCard>
  );
}

function ReasonCard({ subject }: { readonly subject: Subject }) {
  return (
    <MvpCard className="p-5" testId="practice-reason-card">
      <h2 className="text-base font-semibold text-[#111827]">推荐理由</h2>
      <p className="mt-3 text-sm leading-6 text-[#4B5563]">
        {subject === 'xingce'
          ? '优先根据错题率和完成率推荐行测模块；如果没有统计数据，则显示明确空态。'
          : '申论当前以专项和套卷入口为主，评分结果页继续复用现有接口。'}
      </p>
    </MvpCard>
  );
}
