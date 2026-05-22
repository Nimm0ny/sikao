import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApplyExamTheme } from '@/styles/useThemeStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '@sikao/api-client/request';
import { Button, EmptyState } from '@sikao/ui/ui';
import { AlertCircleIcon, RefreshIcon, ToolAiIcon } from '@sikao/ui/icons';
import { ERROR_COPY, LLM_QA_COPY } from '@/lib/ui-copy';
import { ResultPageSkeleton } from '@/components/result';
import { AskDrawer } from '@/components/ask/AskDrawer';
import {
  buildWrongItems,
  calcDurationSeconds,
  pickTitle,
} from '@/components/result/_resultHelpers';
import type { PracticeSessionResultV2 } from '@sikao/api-client/types/api';

/**
 * ResultMobile — M4 · Result 手机版 (PR9 C3, 2026-05-13).
 *
 * SSOT: docs/design/Mobile and Tablet Pack New.html "M4 · Result"
 * + docs/design/handoff/Mobile and Tablet · Handoff.md §5.2.
 *
 * 复用 Result.tsx 同款 useQuery (queryKey=['practiceResult', sessionId]),
 * react-query cache 自动 dedupe; mobile / desktop 切换不会重复请求.
 *
 * M4 layout 关键 (Handoff §5.2):
 *   1. app-head (返回 + 标题 + 分享)
 *   2. result-hero 大数字居中
 *   3. 3 列 mstat (用时 / 已答 / 新错题)
 *   4. 错题速看 list (前 3 题, "全部 N 题 →" 跳 /wrong-book?paperCode=)
 *   5. "继续下一组" / "再来一次" CTA
 *
 * 跟 desktop ResultBody 区别: desktop 走 ResultTabNav + 4 anchor section
 * (overview / questions / timing / actions) 5+ 屏纵向; mobile 走简版聚焦"得分
 * + 速看错题", 完整解析 / 解析 / 用时分布 / 知识点聚焦 推 desktop / 跳详情.
 * 跟 Handoff §5.1 "list 类跳独立 page" 铁线对齐.
 *
 * Italic 政策: CJK 禁 italic. result-hero__big = serif 大数字 (D2c 例外) 不带
 * italic; result-hero__label / __delta 走 font-serif 默认 不带 italic.
 */

function pluralizeWrong(count: number): string {
  if (count === 0) return '全对!';
  return `${count} 题`;
}

function ResultMobileBody({
  result,
  onBackHome,
  onRetry,
  onViewWrong,
  retryDisabled,
  viewWrongDisabled,
}: {
  readonly result: PracticeSessionResultV2;
  readonly onBackHome: () => void;
  readonly onRetry: () => void;
  readonly onViewWrong: () => void;
  readonly retryDisabled: boolean;
  readonly viewWrongDisabled: boolean;
}) {
  const title = pickTitle(result);
  const totalQuestionCount =
    result.correctCount + result.incorrectCount + result.unansweredCount;

  // 正确率 0-100, 设计稿铁线 round 整数; totalQuestionCount=0 走 fallback 0
  // 避免除零 (虽然实际不会发生 — 一道题没答仍有题数, ?? null branch 在外).
  const accuracyPct = useMemo(() => {
    if (totalQuestionCount === 0) return 0;
    return Math.round((result.correctCount / totalQuestionCount) * 100);
  }, [result.correctCount, totalQuestionCount]);

  const durationSeconds = useMemo(() => {
    if (result.session === undefined) return undefined;
    return calcDurationSeconds(
      result.session.startedAt,
      result.session.completedAt,
    );
  }, [result.session]);

  const durationMin = durationSeconds !== undefined
    ? Math.max(1, Math.round(durationSeconds / 60))
    : null;

  // M4 错题速看: 前 3 题 quick preview; 全部 N 题 →跳错题本 paperCode 过滤.
  const wrongItems = useMemo(() => buildWrongItems(result), [result]);
  const previewWrong = wrongItems.slice(0, 3);

  // PR10 AskDrawer state — 错题速看行右侧 IconBtn 打开.
  const [askQid, setAskQid] = useState<string | null>(null);
  const openAsk = useCallback((qid: string): void => setAskQid(qid), []);
  const closeAsk = useCallback((): void => setAskQid(null), []);

  return (
    <div
      className="m-pbody min-h-full pb-6"
      data-testid="result-mobile-view"
    >
      {/* app-head — 返回 / 标题 / placeholder 占右 */}
      <header className="m-app-head">
        <button
          type="button"
          className="m-app-head__icon-btn"
          aria-label="返回首页"
          onClick={onBackHome}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M15 5l-8 7 8 7" />
          </svg>
        </button>
        <div className="min-w-0 text-center flex-1 px-2">
          <p className="m-app-head__sub m-0 leading-tight">本次练习</p>
          <h1 className="m-app-head__title truncate" title={title}>
            {title}
          </h1>
        </div>
        {/* 占位 32px — 居中对齐左侧返回 (设计稿 M4 头部 3 槽) */}
        <span className="m-app-head__icon-btn" aria-hidden="true" />
      </header>

      {/* hero 大数字 */}
      <section
        className="result-hero"
        data-testid="result-mobile-hero"
        aria-label="本次正确率"
      >
        <div className="result-hero__label">本次正确率</div>
        <div className="result-hero__big">
          {accuracyPct}
          <span className="result-hero__big-unit">%</span>
        </div>
        <div
          className="result-hero__delta"
          style={{ color: 'var(--ink-3)' }}
        >
          得分 {result.score}
        </div>
      </section>

      {/* mstat 三联 — 用时 / 已答 / 新错题 */}
      <section
        className="mstat-row"
        data-testid="result-mobile-mstat"
        aria-label="本次练习统计"
      >
        <div className="mstat">
          <div className="mstat__label">用时</div>
          <div className="mstat__value">
            {durationMin !== null ? durationMin : '—'}
            {durationMin !== null ? (
              <span className="mstat__unit">分</span>
            ) : null}
          </div>
          <div className="mstat__delta mstat__delta--flat">—</div>
        </div>
        <div className="mstat">
          <div className="mstat__label">已答</div>
          <div className="mstat__value">
            {result.correctCount + result.incorrectCount}
            <span className="mstat__unit">题</span>
          </div>
          <div className="mstat__delta mstat__delta--flat">
            共 {totalQuestionCount}
          </div>
        </div>
        <div className="mstat">
          <div className="mstat__label">新错题</div>
          <div
            className="mstat__value"
            style={{
              color:
                result.incorrectCount > 0 ? 'var(--err)' : 'var(--ink-1)',
            }}
          >
            {result.incorrectCount}
            <span className="mstat__unit">题</span>
          </div>
          <div className="mstat__delta mstat__delta--flat">
            {result.incorrectCount > 0 ? '已入册' : '—'}
          </div>
        </div>
      </section>

      {/* 错题速看 — 前 3 + 全部跳 wrong-book */}
      {wrongItems.length > 0 ? (
        <>
          <div className="m-section-head" data-testid="result-mobile-wrong-head">
            <h2>错题速看</h2>
            <button
              type="button"
              className="m-section-head__more bg-transparent border-none cursor-pointer"
              onClick={onViewWrong}
              disabled={viewWrongDisabled}
              data-testid="result-mobile-view-all"
            >
              全部 {pluralizeWrong(wrongItems.length)} →
            </button>
          </div>
          <section
            className="m-card"
            style={{ padding: '6px 14px' }}
            data-testid="result-mobile-wrong-list"
          >
            {previewWrong.map((item) => {
              const qid = String(item.question.questionId);
              return (
                // PR10: row 拆 click 区 + ask 区. 主体 button 跳列表, 右侧 ask
                // IconBtn stopPropagation 打开 AskDrawer (不嵌套 button — 用
                // div+role 包外, IconBtn 单独是 <button>).
                <div
                  key={qid}
                  className="m-list-row flex items-center gap-2"
                  data-testid={`result-mobile-wrong-${item.questionNo}`}
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-none text-left p-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={onViewWrong}
                    disabled={viewWrongDisabled}
                    aria-label={`查看错题 ${item.questionNo}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="m-list-row__title truncate">
                        {item.questionNo} ·{' '}
                        {String(item.question.content.stem)
                          .replace(/<[^>]+>/g, '')
                          .slice(0, 30)}
                      </div>
                      <div className="m-list-row__meta">
                        你选 <b style={{ color: 'var(--err)' }}>
                          {item.userKeys.join('')}
                        </b>{' '}
                        · 正解{' '}
                        <b style={{ color: 'var(--ok)' }}>
                          {item.correctKeys.join('')}
                        </b>
                      </div>
                    </div>
                    <span className="m-list-row__right m-list-row__right--err">
                      ✗
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${LLM_QA_COPY.askButton} · 第 ${item.questionNo} 题`}
                    onClick={() => openAsk(qid)}
                    data-testid={`result-mobile-ask-${item.questionNo}`}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-tiny bg-transparent border border-line text-ink-3 hover:bg-surface-alt hover:text-ink transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <ToolAiIcon size={18} />
                  </button>
                </div>
              );
            })}
          </section>
        </>
      ) : (
        <section
          className="m-card"
          data-testid="result-mobile-no-wrong"
        >
          <p className="text-sm text-ink-3 m-0">
            本次全对 — 完美一次。
          </p>
        </section>
      )}

      {/* CTA — 再来一次 + 看本套错题 (单 row, ink-first 主按钮) */}
      <div className="flex gap-2 mt-auto pt-4">
        <button
          type="button"
          className="m-btn-pill"
          style={{
            flex: 1,
            background: 'var(--ink-1)',
            color: 'var(--paper-1)',
            minHeight: 44,
          }}
          onClick={onRetry}
          disabled={retryDisabled}
          data-testid="result-mobile-retry"
        >
          再来一次
        </button>
        <button
          type="button"
          className="m-btn-pill"
          style={{
            flex: 1,
            background: 'var(--paper-1)',
            color: 'var(--ink-1)',
            border: '1px solid var(--ink-2)',
            minHeight: 44,
          }}
          onClick={onBackHome}
          data-testid="result-mobile-home"
        >
          回首页
        </button>
      </div>
      {askQid !== null ? (
        <AskDrawer open={true} onClose={closeAsk} questionId={askQid} />
      ) : null}
    </div>
  );
}

export function ResultMobile() {
  useApplyExamTheme();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const query = useQuery<PracticeSessionResultV2>({
    queryKey: ['practiceResult', sessionId],
    queryFn: () =>
      api.get<PracticeSessionResultV2>(
        `/practice/sessions/${sessionId ?? ''}/result`,
      ),
    enabled: sessionId !== undefined,
  });

  const onBackHome = useCallback(() => navigate('/'), [navigate]);
  const paperCode = query.data?.session?.paperCode ?? null;
  const onRetry = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/practice/${paperCode}/start`);
  }, [paperCode, navigate]);
  const onViewWrong = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/review?paperCode=${encodeURIComponent(paperCode)}`);
  }, [paperCode, navigate]);

  if (query.isLoading) return <ResultPageSkeleton />;
  if (query.isError || query.data === undefined) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={ERROR_COPY.result.title}
          description={ERROR_COPY.result.description}
          action={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  void query.refetch();
                }}
                data-testid="result-mobile-retry-fetch"
              >
                <RefreshIcon className="w-4 h-4 mr-2" />
                重试
              </Button>
              <Button
                variant="quiet"
                onClick={onBackHome}
                data-testid="result-mobile-error-home"
              >
                返回首页
              </Button>
            </div>
          }
        />
      </div>
    );
  }
  return (
    <ResultMobileBody
      result={query.data}
      onBackHome={onBackHome}
      onRetry={onRetry}
      onViewWrong={onViewWrong}
      retryDisabled={paperCode === null}
      viewWrongDisabled={paperCode === null}
    />
  );
}
