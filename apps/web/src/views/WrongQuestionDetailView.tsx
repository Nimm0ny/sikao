/**
 * SIKAO Wave 4 Phase 2D · 错题详情 (DetailA 纵堆 full-screen).
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .det-wrap DetailA.
 *
 * 路由: /wrong-book/:questionId.
 *
 * 主体: 4 段 collapsible (题干 / 选项 / 解析 / 错因分析). 默认全开.
 * 顶部 banner: 已错 N 次 + 标记 chip + "标记已掌握" CTA.
 * 右栏 sticky: 知识点 mini-ring + AI 推荐动作.
 *
 * 数据流: useWrongQuestionItem (cache lookup + fallback list).
 */
import { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  Breadcrumb,
} from '@sikao/ui/ui';
import { AlertCircleIcon } from '@sikao/ui/icons';
import { CommunityNotesSection, NoteCaptureLauncher } from '@/components/notes';
import { WrongDetailSection } from '@/components/wrong-book/WrongDetailSection';
import { useMarkMastered } from '@sikao/api-client/queries/wrongBookQueries';
import { retryWrongQuestion } from '@sikao/api-client/apiQueries';
import { useWrongQuestionItem } from '@sikao/domain/wrong-book/useWrongQuestionItem';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { cn } from '@sikao/shared-utils';
import type { PracticeSessionStartV2 } from '@sikao/api-client/types/api';

function formatLastWrong(isoStr: string): string {
  const d = new Date(isoStr);
  if (!Number.isFinite(d.valueOf())) return '';
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${M}-${D}`;
}

// Wave 6E (2026-05-12): 题干 HTML → plain text 截 100 char 给 NoteCaptureLauncher
// 当 sourceQuote pre-fill. 不走 DOMPurify (那是渲染 sanitize), 这里只剥 tag +
// collapse whitespace, 入 BE sourceQuote 字段是纯文本.
function extractStemPlainText(html: string): string {
  if (html.length === 0) return '';
  const stripped = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length === 0) return '';
  if (stripped.length <= 100) return stripped;
  return `${stripped.slice(0, 100)}…`;
}

export default function WrongQuestionDetailView() {
  const params = useParams<{ questionId: string }>();
  const questionId = parseInt(params.questionId ?? '0', 10);
  const navigate = useNavigate();
  const initSession = usePracticeStore((s) => s.initSession);
  const markMastered = useMarkMastered();

  const retryMutation = useMutation({
    mutationFn: retryWrongQuestion,
    onSuccess: (sessionData: PracticeSessionStartV2) => {
      initSession(sessionData);
      navigate(`/practice/sessions/${sessionData.sessionId}`);
    },
    onError: (err: unknown) => {
      logger.error('wrong-book.retry.failed', { err: String(err) });
      toast.error('无法启动重做', '请稍后重试或检查网络');
    },
  });

  const { item, isLoading, isError } = useWrongQuestionItem(questionId);

  const onMarkMastered = useCallback(() => {
    if (item === undefined) return;
    markMastered.mutate(
      { questionId: item.questionId },
      {
        onSuccess: () => {
          toast.info('已标记为已掌握', '本题从错题本毕业');
          navigate('/wrong-book');
        },
        onError: (err) => {
          logger.error('wrong-book.mark-mastered.failed', { err: String(err) });
          toast.error('标记失败', '请稍后重试');
        },
      },
    );
  }, [item, markMastered, navigate]);

  useEffect(() => {
    if (!Number.isFinite(questionId) || questionId <= 0) {
      navigate('/wrong-book', { replace: true });
    }
  }, [questionId, navigate]);

  if (isLoading) {
    return (
      <div className="px-4 md:px-14 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-7 items-start">
        <div className="space-y-3">
          <Skeleton heightClass="h-10" />
          <Skeleton heightClass="h-32" />
          <Skeleton heightClass="h-48" />
        </div>
        <Skeleton heightClass="h-80" />
      </div>
    );
  }

  if (isError || item === undefined) {
    return (
      <div className="px-4 md:px-14 py-6 md:py-8">
        <EmptyState
          title="未找到这道错题"
          description="可能已被移出错题本, 或链接已过期."
          action={
            <Button variant="primary" onClick={() => navigate('/wrong-book')}>
              返回错题本
            </Button>
          }
        />
      </div>
    );
  }

  const isGraduated = item.masteryLevel === 'mastered';

  return (
    <div
      className="px-4 md:px-14 py-6 md:py-8"
      data-testid="wrong-question-detail-view"
    >
      <Breadcrumb
        items={[
          { label: '错题本', href: '/wrong-book' },
          { label: item.subject ?? '错题' },
          { label: `#${item.questionId}` },
        ]}
      />

      <Card
        padding="md"
        variant="muted"
        className="mt-4 mb-6 grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center"
      >
        <div
          className="w-10 h-10 bg-ink text-white flex items-center justify-center"
          aria-hidden="true"
        >
          <AlertCircleIcon size={24} />
        </div>
        <div>
          <div
            className="font-serif text-sm text-ink leading-relaxed"
            data-testid="wrong-detail-banner-text"
          >
            这道题你已经错了{' '}
            <b className="text-err">{item.wrongCount} 次</b> · 最近一次:{' '}
            <b>{formatLastWrong(item.lastWrongTime)}</b>
          </div>
          <div className="font-mono text-xs text-ink-3 mt-1 tracking-loose">
            连续答对{' '}
            <b className="text-ink font-semibold">
              {item.consecutiveCorrectCount}
            </b>{' '}
            · 标签:{' '}
            <b className="text-ink font-semibold">
              {isGraduated ? '已毕业' : '重做中'}
            </b>
          </div>
        </div>
        {/* Wave 6E (2026-05-12): "添加到笔记本" 跨域 attached note 入口. 错题
            attachedTo.wrongAnswerIds=[questionId], sourceQuote 为题干 plain
            text 截 100 char. */}
        <NoteCaptureLauncher
          target={{
            kind: 'wrong_question',
            refId: item.questionId,
            sourceDomain: 'xingce',
            sourceRef: `错题 #${item.questionId}${item.subject !== null ? ` · ${item.subject}` : ''}`,
          }}
          sourceQuote={extractStemPlainText(item.stem)}
          defaultType="reflect"
          tooltip="添加错因笔记"
          testId="wrong-detail-capture"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={onMarkMastered}
          isLoading={markMastered.isPending}
          data-testid="wrong-detail-mark-mastered"
          disabled={isGraduated}
        >
          {isGraduated ? '已掌握' : '标记已掌握'}
        </Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-7 items-start">
        <div>
          <WrongDetailSection
            num="01 · 原题"
            title={item.subject ?? '错题'}
            testId="wrong-detail-section-stem"
            meta={
              <>
                <span>{item.questionKind}</span>
                {item.paperCode != null ? <span>{item.paperCode}</span> : null}
              </>
            }
          >
            <div
              className="font-serif text-md leading-relaxed text-ink mb-4"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(item.stem),
              }}
            />
            <div className="flex flex-col gap-2">
              {item.options.map((opt) => {
                const isUser = item.userLatestAnswerKeys.includes(opt.key);
                const isCorrect = item.correctAnswerKeys.includes(opt.key);
                return (
                  <div
                    key={opt.key}
                    className={cn(
                      'grid grid-cols-[32px_1fr_auto] gap-3 items-center px-4 py-3 border font-serif text-sm',
                      isCorrect && 'bg-ok-bg border-ok text-ink',
                      isUser &&
                        !isCorrect &&
                        'bg-bad-bg border-err text-ink',
                      !isUser &&
                        !isCorrect &&
                        'bg-surface border-line text-ink-3',
                    )}
                    data-testid={`wrong-detail-option-${opt.key}`}
                  >
                    <span
                      className={cn(
                        'w-6 h-6 border flex items-center justify-center font-mono text-xs',
                        isCorrect && 'bg-ok text-white border-ok',
                        isUser &&
                          !isCorrect &&
                          'bg-err text-white border-err',
                        !isUser && !isCorrect && 'border-line text-ink-3',
                      )}
                    >
                      {opt.key}
                    </span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(opt.text),
                      }}
                    />
                    {isUser ? (
                      <span className="font-mono text-xs uppercase tracking-wider bg-err text-white px-2 py-1 font-semibold">
                        你选
                      </span>
                    ) : null}
                    {isCorrect ? (
                      <span className="font-mono text-xs uppercase tracking-wider bg-ok text-white px-2 py-1 font-semibold">
                        正确
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </WrongDetailSection>

          <WrongDetailSection
            num="02 · 你的答题记录"
            title={`累计错 ${item.wrongCount} 次`}
            testId="wrong-detail-section-record"
            meta={
              <span className="text-err">
                {item.wrongCount} 错 {item.consecutiveCorrectCount} 对
              </span>
            }
          >
            <div className="font-mono text-sm leading-relaxed text-ink-3 tracking-loose">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <span>最近一次错</span>
                <span className="text-ink">
                  {formatLastWrong(item.lastWrongTime)} · 选{' '}
                  <b className="font-serif text-md">
                    {item.userLatestAnswerKeys.join('') || '-'}
                  </b>
                </span>
                <span>累计错次</span>
                <span className="text-ink font-serif text-md font-semibold">
                  {item.wrongCount}
                </span>
                <span>连续答对</span>
                <span className="text-ink font-serif text-md font-semibold">
                  {item.consecutiveCorrectCount} / 3
                </span>
              </div>
            </div>
          </WrongDetailSection>

          <WrongDetailSection
            num="03 · AI 解析"
            title="完整解析"
            testId="wrong-detail-section-explanation"
            meta={item.subtype != null ? <span>{item.subtype}</span> : null}
          >
            {item.explanation !== '' ? (
              <div
                className="font-serif text-md leading-relaxed text-ink"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(item.explanation),
                }}
              />
            ) : (
              <div className="bg-surface-alt border-l-2 border-l-ink px-4 py-3 text-sm text-ink-3">
                这道题的 AI 解析正在生成中, 稍后回来查看.
              </div>
            )}
          </WrongDetailSection>

          <WrongDetailSection
            num="04 · 错因分析"
            title="同类错题"
            testId="wrong-detail-section-similar"
            meta={null}
          >
            <p className="font-serif text-sm text-ink-3 leading-relaxed">
              基于这道题的知识点, 找出你做过的同类错题 — 集中复盘可破"真空白".
            </p>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigate(
                    `/wrong-book?subject=${encodeURIComponent(item.subject ?? '')}${
                      item.subtype != null
                        ? `&subtype=${encodeURIComponent(item.subtype)}`
                        : ''
                    }`,
                  )
                }
              >
                查看同知识点错题 →
              </Button>
            </div>
          </WrongDetailSection>

          {/* Wave 10 Phase C (2026-05-12): 社区笔记 — 题目下方"同学的笔记".
              mock data 阶段, Wave 10 Phase B endpoint ship 后切真 useQuery.
              onViewAll / onCompose 当前 no-op (Phase D 推独立 list view + 写笔记 modal). */}
          <CommunityNotesSection questionId={item.questionId} />

          <div className="flex gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => navigate('/wrong-book')}
              data-testid="wrong-detail-back"
            >
              <span className="font-serif italic mr-1" aria-hidden="true">
                ←
              </span>
              <span>返回列表</span>
            </Button>
            <span className="flex-1" />
            <Button
              variant="primary"
              isLoading={retryMutation.isPending}
              onClick={() => retryMutation.mutate(item.questionId)}
              data-testid="wrong-detail-retry"
            >
              {retryMutation.isPending ? '启动中…' : '立即重做'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/wrong-book/${item.questionId}/redo`)}
              data-testid="wrong-detail-redo-strict"
            >
              空白重答
            </Button>
          </div>
        </div>

        <aside className="sticky top-6 space-y-4">
          <Card padding="md" variant="default">
            <h3 className="font-serif text-md font-semibold m-0 mb-3">
              这个知识点
            </h3>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between border-b border-line py-2">
                <span className="text-ink-3">科目</span>
                <b className="font-serif text-sm text-ink">
                  {item.subject ?? '未分类'}
                </b>
              </div>
              {item.subtype != null ? (
                <div className="flex justify-between border-b border-line py-2">
                  <span className="text-ink-3">题型</span>
                  <b className="font-serif text-sm text-ink">{item.subtype}</b>
                </div>
              ) : null}
              <div className="flex justify-between border-b border-line py-2">
                <span className="text-ink-3">来源</span>
                <b className="font-serif text-sm text-ink">
                  {item.paperCode ?? '专项'}
                </b>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-ink-3">掌握度</span>
                <Badge
                  tone={isGraduated ? 'success' : 'danger'}
                  variant="hairline"
                  dot
                >
                  {isGraduated
                    ? '已掌握'
                    : item.masteryLevel === 'reviewing'
                      ? '复习中'
                      : '未掌握'}
                </Badge>
              </div>
            </div>
          </Card>

          <Card padding="md" variant="ink">
            <h3 className="font-serif text-md font-semibold m-0 mb-3">
              推荐动作 · AI
            </h3>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between py-2 border-b border-white border-opacity-10">
                <span className="opacity-70">同类待清</span>
                <b className="font-serif text-sm">
                  连对 {item.consecutiveCorrectCount}/3
                </b>
              </div>
              <div className="flex justify-between py-2 border-b border-white border-opacity-10">
                <span className="opacity-70">本题严重度</span>
                <b className="font-serif text-sm">
                  {item.wrongCount >= 3
                    ? '高'
                    : item.wrongCount >= 2
                      ? '中'
                      : '低'}
                </b>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/wrong-book/smart-review')}
              className="block w-full text-center bg-white text-ink py-3 mt-4 font-mono text-xs uppercase tracking-wider font-medium hover:bg-paper-3 transition-colors duration-fast"
            >
              险题专项 · 开始 →
            </button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
