/**
 * EssaySpecialty — SIKAO Wave 4 Phase 2C /essay/specialty hifi 升级.
 *
 * 接 Y2-BE d14b0ab 2 endpoint (summary + categories):
 *   - GET /papers/essay/specialty/summary    → StatStrip + ResumeHero
 *   - GET /papers/essay/specialty/categories → 5 CategoryCard (公文/应用文 BE 拆开
 *     2 条, FE 视觉上不再合并 — BE 返 6 cats 即 6 卡; "公文" 题库未补齐时 state='empty')
 *
 * 旧 view (chip-filter list) 整套替换为 hifi:
 *   - StatStrip 4 格 (已练 / 连续 / 本周 / 平均分)
 *   - ResumeHero (条件渲染, resume === null → 隐藏)
 *   - 5+ CategoryCard 展开 + 子行选题 → /essay/specialty/{questionId}
 *
 * 旧路由 ?subtype=&page= 已 obsolete (BE list endpoint 用法变了, 不再 chip 单选分页).
 * 调用方 nav 已切换到点击 sub-row 直跳 questionId.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CategoryCard,
  ResumeHero,
  StatStrip,
} from '@/components/essay/specialty';
import { PageHeader, Skeleton, EmptyState } from '@sikao/ui/ui';
import { QueryBoundary } from '@/components/data';
import { FileTextIcon } from '@sikao/ui/icons';
import {
  useEssaySpecialtyCategories,
  useEssaySpecialtySummary,
  type EssaySpecialtySummaryV2,
  type EssaySpecialtyCategoriesResponseV2,
  type SpecialtyCategoryV2,
} from '@sikao/api-client/queries/essaySpecialtyQueries';
import { ERROR_COPY } from '@/lib/ui-copy';

export default function EssaySpecialty() {
  const navigate = useNavigate();
  const summaryQ = useEssaySpecialtySummary();
  const catsQ = useEssaySpecialtyCategories();

  const handlePickSubtype = useCallback(
    (questionId: number): void => {
      navigate(`/essay/specialty/${questionId}`);
    },
    [navigate],
  );

  const handleStartCategory = useCallback(
    (cat: SpecialtyCategoryV2): void => {
      // 类卡 CTA: 取该类首道 subType 作为入口. 后续可扩 "全部混合" 路由.
      const first = cat.subTypes[0];
      if (first === undefined) return;
      navigate(`/essay/specialty/${first.questionId}`);
    },
    [navigate],
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="04 · Essay / Specialty"
        title={
          <>
            申论 · 专项练习
            <span className="text-ink-3"> · </span>
            <span className="font-serif font-medium">挑一类专攻</span>
          </>
        }
        subtitle="跨真题集中刷同类题型 — AI 即时批改, 五维评分. 展开任一大类查看子项分布; 进度跟着实际作答更新."
      />

      <QueryBoundary
        query={summaryQ}
        testId="essay-specialty-summary"
        skeleton={<Skeleton heightClass="h-24" />}
        errorTitle={ERROR_COPY.essayHistory.title}
        errorDescription={ERROR_COPY.essayHistory.description}
      >
        {(data: EssaySpecialtySummaryV2) => (
          <div className="space-y-4">
            <StatStrip totals={data.totals} />
            {data.resume !== null && data.resume !== undefined ? (
              <ResumeHero
                resume={data.resume}
                onContinue={handlePickSubtype}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>

      <QueryBoundary
        query={catsQ}
        testId="essay-specialty-cats"
        skeleton={
          <div className="space-y-4">
            <Skeleton heightClass="h-28" />
            <Skeleton heightClass="h-28" />
            <Skeleton heightClass="h-28" />
            <Skeleton heightClass="h-28" />
          </div>
        }
        errorTitle={ERROR_COPY.essayHistory.title}
        errorDescription={ERROR_COPY.essayHistory.description}
        emptyWhen={(data: EssaySpecialtyCategoriesResponseV2) => data.cats.length === 0}
        emptyState={
          <EmptyState
            icon={<FileTextIcon className="w-8 h-8" />}
            title="暂无分类"
            description="申论真题还在路上, 等导入后会出现在这里."
          />
        }
      >
        {(data: EssaySpecialtyCategoriesResponseV2) => (
          <CategoryList
            cats={data.cats}
            resumeQuestionId={summaryQ.data?.resume?.questionId ?? null}
            onStartCategory={handleStartCategory}
            onPickSubtype={handlePickSubtype}
          />
        )}
      </QueryBoundary>
    </div>
  );
}

interface CategoryListProps {
  readonly cats: readonly SpecialtyCategoryV2[];
  readonly resumeQuestionId: number | null;
  readonly onStartCategory: (cat: SpecialtyCategoryV2) => void;
  readonly onPickSubtype: (questionId: number) => void;
}

function CategoryList({
  cats,
  resumeQuestionId,
  onStartCategory,
  onPickSubtype,
}: CategoryListProps) {
  // 默认展开规则: 第一卡 open (跟 hifi 一致); 后续若 resume 落在某卡, 优先展开它.
  const continueCatIdx = resumeQuestionId !== null
    ? cats.findIndex((c) =>
        c.subTypes.some((s) => s.questionId === resumeQuestionId),
      )
    : -1;
  const defaultOpenIdx = continueCatIdx >= 0 ? continueCatIdx : 0;

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="essay-specialty-cat-list"
    >
      {cats.map((cat, idx) => (
        <CategoryCard
          key={cat.id}
          cat={cat}
          continueQuestionId={resumeQuestionId}
          defaultOpen={idx === defaultOpenIdx}
          onStartCategory={onStartCategory}
          onPickSubtype={onPickSubtype}
        />
      ))}
    </div>
  );
}
