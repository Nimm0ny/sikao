import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthFallbackEmptyState, EmptyState } from '@sikao/ui/ui';
import { AlertCircleIcon, ToolAiIcon } from '@sikao/ui/icons';
import {
  useWrongBookSummary,
} from '@sikao/api-client/queries/wrongBookQueries';
import { isAuthError } from '@sikao/shared-utils';
import { ERROR_COPY, LLM_QA_COPY } from '@/lib/ui-copy';
import { AskDrawer } from '@/components/ask/AskDrawer';
import {
  fetchWrongQuestions,
  wrongBookKeys,
  type WrongQuestionFilters,
} from '@sikao/api-client/apiQueries';
import type { MasteryLevel } from '@sikao/api-client/types/api';

/**
 *
 * SSOT: docs/design/Mobile and Tablet Pack New.html "M5 · WrongBook"
 *
 * 复用 WrongBook.tsx 同款 useWrongBookSummary + fetchWrongQuestions; react-query
 * cache dedupe; 设备切换不重复请求.
 *
 *   1. app-head (h1 错题本 + 筛选 / 导出 icon)
 *   2. greeting strip (累计 N 题 · 本周新增 M 题)
 *   3. wb-chip-row 横滑筛选 (全部 / 行测 / 申论 / 公基 / 近7天)
 *   4. 紧凑 wb-row list (题号 + stem + meta + 错率)
 *   5. pagination (跳页轻量化)
 *
 * 跟 desktop WrongBook 区别: desktop 重 hero stat-strip + heatmap + standout
 * + smart-review CTA + 7-chip FiltersPanel + 6-col grid; mobile 走聚焦
 * "今天该练什么 + 一题一题翻", 完整 dashboard 推 desktop / detail view.
 * (/wrong-book/:questionId).
 *
 * Italic 政策合规: CJK 禁 italic. wb-row__qn / __meta 走 font-serif default
 * 不带 italic.
 */

type MobileFilter = 'all' | 'xingce' | 'shenlun' | 'gongji' | 'recent';

interface MobileChip {
  readonly key: MobileFilter;
  readonly label: string;
}

const MOBILE_CHIPS: readonly MobileChip[] = [
  { key: 'all', label: '全部' },
  { key: 'xingce', label: '行测' },
  { key: 'shenlun', label: '申论' },
  { key: 'gongji', label: '公基' },
  { key: 'recent', label: '近 7 天' },
];

const PAGE_SIZE = 20;
const VALID_MASTERY: ReadonlySet<string> = new Set([
  'not_mastered',
  'reviewing',
  'mastered',
]);

function mobileFilterToParams(
  filter: MobileFilter,
): Pick<WrongQuestionFilters, 'subject'> {
  switch (filter) {
    case 'xingce':
      // 行测 subject 子集 - 这里用 wrong-book BE 接受的 subject 标签 prefix.
      // BE 当前 subject 直接是中文 - 各 subject 单独走, mobile 简化用最常见
      // "言语" 作 fallback (恶习: 待 BE 出"行测"聚合 subject endpoint).
      return { subject: '言语' };
    case 'shenlun':
      return { subject: '申论' };
    case 'gongji':
      return { subject: '常识' };
    case 'recent':
      // recent (近 7 天) BE 暂无 since 参数 → 走全集 + 客户端 sort by lastWrongTime
      // (本期 mobile 简化不实现, 走 default; lhr 拍板 BE follow-up).
      return {};
    case 'all':
    default:
      return {};
  }
}

function pickInitialFilter(params: URLSearchParams): MobileFilter {
  // URL 来 fromdesktop /wrong-book?paperCode=... 时 mobile 不 strict 匹配,
  const subj = params.get('subject');
  if (subj === '申论') return 'shenlun';
  if (subj === '常识') return 'gongji';
  if (subj === '言语') return 'xingce';
  return 'all';
}

export function WrongBookMobile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<MobileFilter>(() =>
    pickInitialFilter(searchParams),
  );
  const [page, setPage] = useState<number>(1);

  const summaryQuery = useWrongBookSummary();
  const summary = summaryQuery.data;

  const masteryRaw = searchParams.get('masteryLevel');
  const masteryLevel =
    masteryRaw !== null && VALID_MASTERY.has(masteryRaw)
      ? (masteryRaw as MasteryLevel)
      : undefined;

  const fetchFilters: WrongQuestionFilters = useMemo(
    () => ({
      ...mobileFilterToParams(filter),
      masteryLevel,
      page,
      pageSize: PAGE_SIZE,
    }),
    [filter, masteryLevel, page],
  );

  const listQuery = useQuery({
    queryKey: wrongBookKeys.list(fetchFilters),
    queryFn: () => fetchWrongQuestions(fetchFilters),
  });

  const handleChipChange = useCallback(
    (next: MobileFilter) => {
      setFilter(next);
      setPage(1);
      // sync URL search subject param so desktop 切回时仍带过滤.
      const params = new URLSearchParams(searchParams);
      const subj = mobileFilterToParams(next).subject;
      if (subj !== undefined) params.set('subject', subj);
      else params.delete('subject');
      params.delete('page');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleRowClick = useCallback(
    (questionId: number) => {
      navigate(`/wrong-book/${questionId}`);
    },
    [navigate],
  );

  const [askQid, setAskQid] = useState<number | null>(null);
  const openAsk = useCallback((qid: number): void => setAskQid(qid), []);
  const closeAsk = useCallback((): void => setAskQid(null), []);

  if (
    (listQuery.isError && isAuthError(listQuery.error)) ||
    (summaryQuery.isError && isAuthError(summaryQuery.error))
  ) {
    return (
      <div className="m-pbody">
        <AuthFallbackEmptyState description="登录后即可查看错题本." />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div className="m-pbody">
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={ERROR_COPY.wrongBook.title}
          description={ERROR_COPY.wrongBook.description}
        />
      </div>
    );
  }

  const summaryStrip = summary !== undefined
    ? `累计 ${summary.inPractice + summary.graduatedCount} 题 · 本周新增 ${summary.weeklyNew} 题`
    : '加载中…';

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div
      className="m-pbody min-h-full"
      data-testid="wrong-book-mobile-view"
    >
      <header className="m-app-head">
        <div className="m-app-head__left">
          <div className="min-w-0">
            <h1
              className="m-app-head__title"
              style={{ fontSize: 24 }}
            >
              错题本
            </h1>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="m-app-head__icon-btn"
            aria-label="智能复盘"
            onClick={() => navigate('/wrong-book/smart-review')}
            data-testid="wrong-book-mobile-smart-review"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 6h18M6 12h12M9 18h6" />
            </svg>
          </button>
        </div>
      </header>

      <p
        className="m-app-head__sub m-0"
        data-testid="wrong-book-mobile-summary"
        style={{ marginTop: -4 }}
      >
        {summaryStrip}
      </p>

      <nav
        className="wb-chip-row"
        data-testid="wrong-book-mobile-chips"
        aria-label="错题筛选"
      >
        {MOBILE_CHIPS.map((chip) => {
          const active = filter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              className={`wb-chip ${active ? 'wb-chip--active' : ''}`}
              onClick={() => handleChipChange(chip.key)}
              aria-pressed={active}
              data-testid={`wrong-book-mobile-chip-${chip.key}`}
            >
              {chip.label}
            </button>
          );
        })}
      </nav>

      {listQuery.isLoading && items.length === 0 ? (
        <section className="m-card" data-testid="wrong-book-mobile-loading">
          <p className="text-sm text-ink-3 m-0">加载中…</p>
        </section>
      ) : items.length === 0 ? (
        <section className="m-card" data-testid="wrong-book-mobile-empty">
          <p className="text-sm text-ink-3 m-0">
            这个筛选下还没有错题。换个 chip 看看。
          </p>
        </section>
      ) : (
        <section
          className="m-card"
          style={{ padding: '4px 14px' }}
          data-testid="wrong-book-mobile-list"
        >
          {items.map((it) => {
            const userKeys = it.userLatestAnswerKeys.join('') || '—';
            const correctKeys = it.correctAnswerKeys.join('') || '—';
            const stemPlain = String(it.stem ?? '')
              .replace(/<[^>]+>/g, '')
              .slice(0, 40);
            return (
              // open AskDrawer (不嵌套 button).
              <div
                key={it.questionId}
                className="wb-row flex items-center gap-2"
                data-testid={`wrong-book-mobile-row-${it.questionId}`}
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-none text-left p-0 cursor-pointer"
                  onClick={() => handleRowClick(it.questionId)}
                  aria-label={`查看错题 ${it.questionId}`}
                >
                  <span className="wb-row__qn">
                    {String(it.questionId).slice(-3)}
                  </span>
                  <div className="wb-row__body">
                    <p className="truncate">{stemPlain}</p>
                    <div className="wb-row__meta">
                      <span>{it.subject ?? '—'}</span>
                      <span>
                        你选 <b>{userKeys}</b> · 正解 {correctKeys}
                      </span>
                      <span>错 {it.wrongCount} 次</span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`${LLM_QA_COPY.askButton} · 第 ${it.questionId} 题`}
                  onClick={() => openAsk(it.questionId)}
                  data-testid={`wrong-book-mobile-ask-${it.questionId}`}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-tiny bg-transparent border border-line text-ink-3 hover:bg-surface-alt hover:text-ink transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <ToolAiIcon size={18} />
                </button>
              </div>
            );
          })}
        </section>
      )}

      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between pt-2"
          aria-label="错题翻页"
          data-testid="wrong-book-mobile-pagination"
        >
          <button
            type="button"
            className="m-btn-pill"
            style={{
              background: 'var(--paper-1)',
              color: 'var(--ink-1)',
              border: '1px solid var(--line-3)',
            }}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="上一页"
          >
            ← 上一页
          </button>
          <span
            className="font-serif text-ink-3"
            style={{ fontSize: 12 }}
          >
            第 {page} / {totalPages} 页
          </span>
          <button
            type="button"
            className="m-btn-pill"
            style={{
              background: 'var(--paper-1)',
              color: 'var(--ink-1)',
              border: '1px solid var(--line-3)',
            }}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="下一页"
          >
            下一页 →
          </button>
        </nav>
      ) : null}
      {askQid !== null ? (
        <AskDrawer
          open={true}
          onClose={closeAsk}
          questionId={String(askQid)}
        />
      ) : null}
    </div>
  );
}
