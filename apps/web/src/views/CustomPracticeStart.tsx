import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, EmptyState, FormField, MetaPair, Skeleton } from '@sikao/ui/ui';
import {
  customPracticeKeys,
  fetchCustomPracticeFacets,
  startCustomPractice,
} from '@sikao/api-client/apiQueries';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { CUSTOM_PRACTICE_COPY } from '@/lib/ui-copy';
import type {
  CustomPracticeFacetsResponseV2,
  CustomPracticeSecondSubtypeFacetV2,
  CustomPracticeStartPayload,
  CustomPracticeSubtypeFacetV2,
  CustomPracticeTopTypeFacetV2,
} from '@sikao/api-client/types/api';

const DEFAULT_QUESTION_COUNT = 10;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 50;
// prototype 02). 选 'custom' 时显示数字 input.
const QUESTION_COUNT_PRESETS = [10, 20, 40] as const;
type QuestionCountPreset = typeof QUESTION_COUNT_PRESETS[number] | 'custom';

type YearPreset = 'all' | 'recent3';

function recentYears(years: readonly number[]): number[] {
  return years.slice(0, 3);
}

function isValidQuestionCount(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_QUESTION_COUNT && value <= MAX_QUESTION_COUNT;
}

function toPayload(args: {
  readonly topType: CustomPracticeTopTypeFacetV2;
  readonly subtype: CustomPracticeSubtypeFacetV2 | null;
  readonly secondSubtype: CustomPracticeSecondSubtypeFacetV2 | null;
  readonly yearPreset: YearPreset;
  readonly questionCount: number;
}): CustomPracticeStartPayload {
  const sourceYears = args.secondSubtype?.years ?? args.subtype?.years ?? args.topType.years;
  const years = args.yearPreset === 'recent3' ? recentYears(sourceYears) : undefined;
  return {
    topType: args.topType.name,
    ...(args.subtype !== null ? { subtype: args.subtype.name } : {}),
    ...(args.secondSubtype !== null ? { secondSubtype: args.secondSubtype.name } : {}),
    ...(years !== undefined ? { years } : {}),
    questionCount: args.questionCount,
  };
}

export default function CustomPracticeStart() {
  const navigate = useNavigate();
  const initSession = usePracticeStore(state => state.initSession);
  const [selectedTopType, setSelectedTopType] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [selectedSecondSubtype, setSelectedSecondSubtype] = useState<string | null>(null);
  const [yearPreset, setYearPreset] = useState<YearPreset>('all');
  const [questionCountPreset, setQuestionCountPresetState] = useState<QuestionCountPreset>(DEFAULT_QUESTION_COUNT);
  const [customQuestionCount, setCustomQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const questionCount = questionCountPreset === 'custom' ? customQuestionCount : questionCountPreset;
  // review-fix #3: 切到 custom 时 clamp customQuestionCount 回合法范围 —
  // 否则 (chip 选 10 → 切 custom 输 60 → 切回 chip → 切回 custom) 用户会
  // 看到残留越界值 + 开始按钮神秘禁用. clamp 到合法范围或 reset DEFAULT.
  const setQuestionCountPreset = useCallback((preset: QuestionCountPreset) => {
    setQuestionCountPresetState(preset);
    if (preset === 'custom' && !isValidQuestionCount(customQuestionCount)) {
      setCustomQuestionCount(DEFAULT_QUESTION_COUNT);
    }
  }, [customQuestionCount]);
  const [isStarting, setIsStarting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: customPracticeKeys.facets(),
    queryFn: fetchCustomPracticeFacets,
  });

  const topType = useMemo(
    () => data?.topTypes.find(item => item.name === selectedTopType) ?? data?.topTypes[0],
    [data, selectedTopType],
  );
  const subtype = useMemo(
    () => topType?.subtypes.find(item => item.name === selectedSubtype) ?? null,
    [topType, selectedSubtype],
  );
  const secondSubtype = useMemo(
    () => subtype?.secondSubtypes.find(item => item.name === selectedSecondSubtype) ?? null,
    [selectedSecondSubtype, subtype],
  );
  const questionCountError = isValidQuestionCount(questionCount)
    ? null
    : `${MIN_QUESTION_COUNT} 到 ${MAX_QUESTION_COUNT} 题`;

  const handleSelectTopType = useCallback((name: string) => {
    setSelectedTopType(name);
    setSelectedSubtype(null);
    setSelectedSecondSubtype(null);
  }, []);

  const handleSelectSubtype = useCallback((name: string | null) => {
    setSelectedSubtype(name);
    setSelectedSecondSubtype(null);
  }, []);

  // 不跨大类 (top_type 永远保留, plan §D2). 一次只放宽一档, 用户每次必须
  // 显式点 CTA — 不悄悄连续放宽 (D2 "不悄悄替用户决定").
  // Invariant (handleSelectSubtype 维护): selectedSecondSubtype !== null
  // 蕴含 selectedSubtype !== null. 所以下方第二分支不再 reset secondSubtype.
  const handleRelax = useCallback(() => {
    if (selectedSecondSubtype !== null) {
      setSelectedSecondSubtype(null);
      return;
    }
    if (selectedSubtype !== null) {
      setSelectedSubtype(null);
      return;
    }
    if (yearPreset !== 'all') {
      setYearPreset('all');
    }
  }, [selectedSecondSubtype, selectedSubtype, yearPreset]);

  const handleStart = useCallback(async () => {
    if (topType === undefined) return;
    if (!isValidQuestionCount(questionCount)) {
      throw new Error(`Invalid custom practice question count: ${questionCount}`);
    }
    setIsStarting(true);
    try {
      const payload = toPayload({ topType, subtype, secondSubtype, yearPreset, questionCount });
      const sessionData = await startCustomPractice(payload);
      initSession(sessionData);
      navigate(`/practice/sessions/${sessionData.sessionId}`);
    } catch (err) {
      logger.error('practice.custom.start.failed', { err: String(err) });
      toast.error(CUSTOM_PRACTICE_COPY.startFailedTitle, CUSTOM_PRACTICE_COPY.startFailedDesc);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, [initSession, navigate, questionCount, secondSubtype, subtype, topType, yearPreset]);

  if (isLoading) return <CustomPracticeSkeleton />;
  if (isError) return <CustomPracticeError onRetry={() => { void refetch(); }} />;
  if (data === undefined || data.topTypes.length === 0) return <CustomPracticeEmpty />;

  const resolvedTopType = topType ?? data.topTypes[0];
  const canRelax = selectedSecondSubtype !== null || selectedSubtype !== null || yearPreset !== 'all';

  return (
    <CustomPracticeReady
      data={data}
      topType={resolvedTopType}
      subtype={subtype}
      secondSubtype={secondSubtype}
      yearPreset={yearPreset}
      questionCount={questionCount}
      questionCountPreset={questionCountPreset}
      customQuestionCount={customQuestionCount}
      questionCountError={questionCountError}
      isStarting={isStarting}
      canRelax={canRelax}
      onSelectTopType={handleSelectTopType}
      onSelectSubtype={handleSelectSubtype}
      onSelectSecondSubtype={setSelectedSecondSubtype}
      onSelectYearPreset={setYearPreset}
      onSelectQuestionCountPreset={setQuestionCountPreset}
      onCustomQuestionCountChange={setCustomQuestionCount}
      onRelax={handleRelax}
      onStart={handleStart}
    />
  );
}

function PageFrame({ children }: { readonly children: React.ReactNode }) {
  return <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>;
}

function CustomPracticeSkeleton() {
  return (
    <PageFrame>
      <Skeleton widthClass="w-40" heightClass="h-8" />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <Skeleton widthClass="w-full" heightClass="h-96" />
        <Skeleton widthClass="w-full" heightClass="h-96" />
      </div>
    </PageFrame>
  );
}

function CustomPracticeError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <PageFrame>
      <EmptyState
        tone="error"
        icon={<AlertCircle className="w-8 h-8" aria-hidden="true" />}
        title={CUSTOM_PRACTICE_COPY.facetsFailedTitle}
        description={`${CUSTOM_PRACTICE_COPY.facetsFailedDesc1}；${CUSTOM_PRACTICE_COPY.facetsFailedDesc2}。`}
        action={
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            重试
          </Button>
        }
      />
    </PageFrame>
  );
}

function CustomPracticeEmpty() {
  return (
    <PageFrame>
      <EmptyState
        title={CUSTOM_PRACTICE_COPY.emptyTitle}
        description={`${CUSTOM_PRACTICE_COPY.emptyDesc}。`}
      />
    </PageFrame>
  );
}

interface ReadyProps {
  readonly data: CustomPracticeFacetsResponseV2;
  readonly topType: CustomPracticeTopTypeFacetV2;
  readonly subtype: CustomPracticeSubtypeFacetV2 | null;
  readonly secondSubtype: CustomPracticeSecondSubtypeFacetV2 | null;
  readonly yearPreset: YearPreset;
  readonly questionCount: number;
  readonly questionCountPreset: QuestionCountPreset;
  readonly customQuestionCount: number;
  readonly questionCountError: string | null;
  readonly isStarting: boolean;
  readonly canRelax: boolean;
  readonly onSelectTopType: (name: string) => void;
  readonly onSelectSubtype: (name: string | null) => void;
  readonly onSelectSecondSubtype: (name: string | null) => void;
  readonly onSelectYearPreset: (preset: YearPreset) => void;
  readonly onSelectQuestionCountPreset: (preset: QuestionCountPreset) => void;
  readonly onCustomQuestionCountChange: (value: number) => void;
  readonly onRelax: () => void;
  readonly onStart: () => void;
}

function CustomPracticeReady(props: ReadyProps) {
  return (
    <PageFrame>
      <Header totalQuestions={props.data.totalQuestions} />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <Card padding="lg" className="min-h-[520px]" data-testid="custom-practice-panel">
          <SelectionPanel {...props} />
        </Card>
        <StartPanel {...props} />
      </div>
    </PageFrame>
  );
}

function Header({ totalQuestions }: { readonly totalQuestions: number }) {
  return (
    <header>
      <div className="inline-flex items-center gap-2 text-tiny font-semibold text-ink-1 bg-paper-2 border border-paper-3 px-2 py-1 rounded-pill">
        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-pill bg-ink-1" />
        行测 · 分类训练
      </div>
      <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-ink">
        专项练习
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">
        从真实题库标签选择大类、小类、年份和题量，创建一组只练当前目标的答题会话。
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <MetaPair label="可练题">{totalQuestions}</MetaPair>
        <MetaPair label="模式">专项</MetaPair>
      </div>
    </header>
  );
}

function SelectionPanel({
  data,
  topType,
  subtype,
  secondSubtype,
  onSelectTopType,
  onSelectSubtype,
  onSelectSecondSubtype,
}: ReadyProps) {
  return (
    <div className="space-y-8">
      <SelectorSection title="大类" description="按行测题型主分类选择训练范围。">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.topTypes.map(item => (
            <ChoiceButton
              key={item.name}
              label={item.name}
              count={item.questionCount}
              active={item.name === topType.name}
              onClick={() => onSelectTopType(item.name)}
            />
          ))}
        </div>
      </SelectorSection>

      {topType.subtypes.length > 0 ? (
        <SelectorSection title="小类" description="不选小类时，默认覆盖该大类下全部题。">
          <div className="flex flex-wrap gap-2">
            <ChipButton active={subtype === null} onClick={() => onSelectSubtype(null)}>
              全部
            </ChipButton>
            {topType.subtypes.map(item => (
              <ChipButton
                key={item.name}
                active={subtype?.name === item.name}
                onClick={() => onSelectSubtype(item.name)}
              >
                {item.name}
              </ChipButton>
            ))}
          </div>
        </SelectorSection>
      ) : null}

      {subtype !== null && subtype.secondSubtypes.length > 0 ? (
        <SelectorSection title="细分" description="不选细分时，默认覆盖该小类下全部题。">
          <div className="flex flex-wrap gap-2">
            <ChipButton active={secondSubtype === null} onClick={() => onSelectSecondSubtype(null)}>
              全部
            </ChipButton>
            {subtype.secondSubtypes.map(item => (
              <ChipButton
                key={item.name}
                active={secondSubtype?.name === item.name}
                onClick={() => onSelectSecondSubtype(item.name)}
              >
                {item.name}
              </ChipButton>
            ))}
          </div>
        </SelectorSection>
      ) : null}
    </div>
  );
}

function SelectorSection({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${title}-title`}>
      <div className="mb-4">
        <h2 id={`${title}-title`} className="text-lg font-bold text-ink">
          {title}
        </h2>
        <p className="mt-1 text-xs text-ink-3">{description}</p>
      </div>
      {children}
    </section>
  );
}

interface ChoiceButtonProps {
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly onClick: () => void;
}

function ChoiceButton({ label, count, active, onClick }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={[
        'flex items-center justify-between gap-4 rounded-card border px-4 py-4 text-left transition-colors',
        active
          ? 'border-ink bg-paper-2 text-ink'
          : 'border-line bg-surface text-ink hover:border-line-3 hover:bg-surface-alt',
      ].join(' ')}
    >
      <span>
        <span className="block text-base font-bold">{label}</span>
        <span className="mt-1 block text-xs text-ink-3">{count} 题可练</span>
      </span>
      <ChevronRight className="w-4 h-4 text-ink-4" aria-hidden="true" />
    </button>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'h-9 rounded-tiny border px-3 text-sm font-medium transition-colors duration-fast',
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-surface text-ink-3 hover:border-line-3',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function StartPanel({
  topType,
  subtype,
  secondSubtype,
  yearPreset,
  questionCount,
  questionCountPreset,
  customQuestionCount,
  questionCountError,
  isStarting,
  canRelax,
  onSelectYearPreset,
  onSelectQuestionCountPreset,
  onCustomQuestionCountChange,
  onRelax,
  onStart,
}: ReadyProps) {
  const summaryName = secondSubtype?.name ?? subtype?.name ?? '该大类全部小类';
  const summaryCount = secondSubtype?.questionCount ?? subtype?.questionCount ?? topType.questionCount;
  // disable 开始 (后端会 422 反正). 候选题足够但 < 50 阈值 → soft 提示 +
  // 放宽 CTA (D2 决策: 阈值 50, 不悄悄放宽).
  const insufficient = summaryCount < questionCount;
  const lowSample = !insufficient && summaryCount < 50;

  return (
    <aside className="lg:sticky lg:top-8 self-start">
      <Card padding="lg" className="border-ink">
        <p className="text-tiny font-semibold text-ink-3">当前选择</p>
        <h2 className="mt-2 text-h-card font-bold text-ink">{topType.name}</h2>
        <p className="mt-2 text-sm text-ink-3">
          {summaryName} · {summaryCount} 题
        </p>

        {insufficient || lowSample ? (
          <SufficiencyBanner
            variant={insufficient ? 'insufficient' : 'low-sample'}
            summaryCount={summaryCount}
            requested={questionCount}
            canRelax={canRelax}
            onRelax={onRelax}
          />
        ) : null}

        <div className="mt-6 space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">年份</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ChipButton active={yearPreset === 'all'} onClick={() => onSelectYearPreset('all')}>
                全部年份
              </ChipButton>
              <ChipButton
                active={yearPreset === 'recent3'}
                onClick={() => onSelectYearPreset('recent3')}
              >
                近三年
              </ChipButton>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">题量</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="question-count-chips">
              {QUESTION_COUNT_PRESETS.map((n) => (
                <ChipButton
                  key={n}
                  active={questionCountPreset === n}
                  onClick={() => onSelectQuestionCountPreset(n)}
                >
                  {n}
                </ChipButton>
              ))}
              <ChipButton
                active={questionCountPreset === 'custom'}
                onClick={() => onSelectQuestionCountPreset('custom')}
              >
                自定义
              </ChipButton>
            </div>
            {questionCountPreset === 'custom' ? (
              <div className="mt-3" data-testid="question-count-custom">
                <FormField
                  label="自定义题量"
                  type="number"
                  min={MIN_QUESTION_COUNT}
                  max={MAX_QUESTION_COUNT}
                  value={customQuestionCount}
                  onChange={(event) => onCustomQuestionCountChange(Number(event.currentTarget.value))}
                  hint="1 到 50 题；材料组按组原子加入。"
                  error={questionCountError}
                />
              </div>
            ) : null}
          </fieldset>
        </div>

        <Button
          className="mt-8"
          variant="primary"
          fullWidth
          isLoading={isStarting}
          disabled={questionCountError !== null || insufficient}
          onClick={onStart}
          data-testid="custom-practice-start"
        >
          开始专项练习
        </Button>
      </Card>
    </aside>
  );
}

interface SufficiencyBannerProps {
  // review-fix #5: 显式 variant 替代 (insufficient: boolean) 隐式拼接,
  // 让 mount 条件 + 渲染分支单一来源, 防 prop / 父级 if 不同步.
  readonly variant: 'insufficient' | 'low-sample';
  readonly summaryCount: number;
  readonly requested: number;
  readonly canRelax: boolean;
  readonly onRelax: () => void;
}

function SufficiencyBanner({
  variant,
  summaryCount,
  requested,
  canRelax,
  onRelax,
}: SufficiencyBannerProps) {
  const tone: 'warn' | 'neutral' = variant === 'insufficient' ? 'warn' : 'neutral';
  const headline = variant === 'insufficient'
    ? `仅 ${summaryCount} 题，少于请求的 ${requested} 题`
    : `仅 ${summaryCount} 题（少于建议样本 50）`;
  return (
    <div
      className="mt-4 flex items-start gap-3 p-3 border border-line rounded-card bg-surface-alt"
      data-testid="custom-practice-sufficiency-banner"
    >
      <AlertTriangle className="w-4 h-4 mt-1 text-warn flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-ink">{headline}</span>
          <Badge tone={tone} variant="hairline">
            {variant === 'insufficient' ? '题量不足' : '数据积累中'}
          </Badge>
        </div>
        {canRelax ? (
          <Button
            className="mt-2"
            variant="ghost"
            size="sm"
            onClick={onRelax}
            data-testid="custom-practice-relax"
          >
            放宽筛选
          </Button>
        ) : (
          // review-fix #2: "已是最大范围" 误导 (实际只是 "本大类全选, 顶级
          // top_type 还有别的"). 改诚实文案.
          <p className="mt-1 text-xs text-ink-3">
            本大类已全选；切换大类或等待题库扩充。
          </p>
        )}
      </div>
    </div>
  );
}
