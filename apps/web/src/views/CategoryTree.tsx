/**
 * CategoryTree — SIKAO Wave 5A /categories 行测专项 hifi 升级.
 *
 * 接 Xa-BE 7a06b94 2 endpoint (mirror EssaySpecialty):
 *   - GET /papers/xingce/specialty/summary    → StatStrip + ResumeHero
 *   - GET /papers/xingce/specialty/categories → 5 CategoryCard (5 大类固定)
 *
 * 5 大类: 言语 / 判断 / 数量 / 资料 / 常识 (BE 服务端硬编码 _XINGCE_CATEGORIES).
 *
 * 旧 view (6 卡 ProgressBar grid) 整套替换为 hifi:
 *   - StatStrip 4 格 (已练 / 连续 / 本周 / 正确率)
 *   - ResumeHero (条件渲染, resume === null → 隐藏)
 *   - 5 CategoryCard 展开 + 子行选题 → /practice/custom/start?topType=X
 *     (子行点 → 复用现有自定义刷题入口, 后续可演化为 jump-to-question)
 *
 * 视觉子组件复用 essay/specialty (mode='xingce'): StatStrip / ResumeHero /
 * CategoryCard / SubtypeRow 全部 generic 化, mode 驱动 testid prefix + lang 微调.
 * Master 拍板理由: BE schema shape 跟 essay 完全 mirror (字段名 + 字段类型对等),
 * UI 差异仅 StatStrip avgScore suffix (essay /100, xingce %) + aria-label. 复用
 * 比复制 ~600 行更 SRP. 详 fixer 报告.
 *
 * 路由保持 /categories (避免动 sidebar nav, IA cleanup 留 Wave 5c).
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CategoryCard,
  ResumeHero,
  StatStrip,
  type AnyCategory,
} from '@/components/essay/specialty';
import { PageHeader, Skeleton, EmptyState } from '@sikao/ui/ui';
import { QueryBoundary } from '@/components/data';
import { FileTextIcon } from '@sikao/ui/icons';
import {
  useXingceSpecialtyCategories,
  useXingceSpecialtySummary,
  type XingceSpecialtySummaryV2,
  type XingceSpecialtyCategoriesResponseV2,
  type XingceSpecialtyCategoryV2,
} from '@sikao/api-client/queries/xingceSpecialtyQueries';
import { ERROR_COPY } from '@/lib/ui-copy';

export default function CategoryTree() {
  const navigate = useNavigate();
  const summaryQ = useXingceSpecialtySummary();
  const catsQ = useXingceSpecialtyCategories();

  // 子行点 → 跳到自定义刷题, 带 questionId param. 行测 BE subtype row 是
  // per-question (id=q-{questionId}), CustomPracticeStart 当前消费 topType,
  // 后续可扩 questionId override 直接定位单题. 此处先传 param 不破坏现有
  // 路由形态; CustomPracticeStart 当前忽略未知 param.
  const handlePickSubtype = useCallback(
    (questionId: number): void => {
      navigate(`/practice/custom/start?questionId=${questionId}`);
    },
    [navigate],
  );

  const handleStartCategory = useCallback(
    (cat: AnyCategory): void => {
      // cat.id 是 canonical id (e.g. "yanyu"), name 是中文 "言语理解" — 与
      // CustomPracticeStart 消费 topType 一致 (后者读中文 topType).
      navigate(
        `/practice/custom/start?topType=${encodeURIComponent(cat.name)}`,
      );
    },
    [navigate],
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6" data-testid="xingce-specialty-view">
      <PageHeader
        eyebrow="03 · Xingce / Specialty"
        title={
          <>
            行测 · 专项练习
            <span className="text-ink-3"> · </span>
            <span className="font-serif font-medium">挑一类专攻</span>
          </>
        }
        subtitle="按模块集中刷同类题型 — 五大类一目了然. 展开任一大类查看子项分布; 进度跟着实际作答更新."
      />

      <QueryBoundary
        query={summaryQ}
        testId="xingce-specialty-summary"
        skeleton={<Skeleton heightClass="h-24" />}
        errorTitle={ERROR_COPY.paperLoad.title}
        errorDescription={ERROR_COPY.paperLoad.description}
      >
        {(data: XingceSpecialtySummaryV2) => (
          <div className="space-y-4">
            <StatStrip totals={data.totals} mode="xingce" />
            {data.resume !== null && data.resume !== undefined ? (
              <ResumeHero
                resume={data.resume}
                mode="xingce"
                onContinue={() => {
                  // 行测续答 questionId 走 jump 路由暂未上线, 回退到 cat 入口
                  // (5 大类 + resume.typeName 暂只在 hero 显示). 后续可加
                  // /practice/question/{questionId} 直跳.
                  if (data.resume === null || data.resume === undefined) return;
                  navigate(
                    `/practice/custom/start?topType=${encodeURIComponent(data.resume.typeName)}`,
                  );
                }}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>

      <QueryBoundary
        query={catsQ}
        testId="xingce-specialty-cats"
        skeleton={
          <div className="space-y-4">
            <Skeleton heightClass="h-28" />
            <Skeleton heightClass="h-28" />
            <Skeleton heightClass="h-28" />
            <Skeleton heightClass="h-28" />
            <Skeleton heightClass="h-28" />
          </div>
        }
        errorTitle={ERROR_COPY.paperLoad.title}
        errorDescription={ERROR_COPY.paperLoad.description}
        emptyWhen={(data: XingceSpecialtyCategoriesResponseV2) => data.cats.length === 0}
        emptyState={
          <EmptyState
            icon={<FileTextIcon className="w-8 h-8" />}
            title="题库准备中"
            description="行测题库分类导入后会显示在这里."
          />
        }
      >
        {(data: XingceSpecialtyCategoriesResponseV2) => (
          <XingceCategoryList
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

interface XingceCategoryListProps {
  readonly cats: readonly XingceSpecialtyCategoryV2[];
  readonly resumeQuestionId: number | null;
  readonly onStartCategory: (cat: AnyCategory) => void;
  readonly onPickSubtype: (questionId: number) => void;
}

function XingceCategoryList({
  cats,
  resumeQuestionId,
  onStartCategory,
  onPickSubtype,
}: XingceCategoryListProps) {
  // 默认展开规则: 第一卡 open (跟 EssaySpecialty 一致); 若 resume 落在某卡, 优先展开它.
  const continueCatIdx = resumeQuestionId !== null
    ? cats.findIndex((c) =>
        c.subTypes.some((s) => s.questionId === resumeQuestionId),
      )
    : -1;
  const defaultOpenIdx = continueCatIdx >= 0 ? continueCatIdx : 0;

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="xingce-specialty-cat-list"
    >
      {cats.map((cat, idx) => (
        <CategoryCard
          key={cat.id}
          cat={cat}
          mode="xingce"
          continueQuestionId={resumeQuestionId}
          defaultOpen={idx === defaultOpenIdx}
          onStartCategory={onStartCategory}
          onPickSubtype={onPickSubtype}
        />
      ))}
    </div>
  );
}
