// EssayPaperDetail — Slice 2d /essay/papers/:paperCode 卷详情.
//
// 拉 GET /api/v2/papers/:code/questions, 过滤 rendererKey='essay', 列每题
// 卡片预览 (题号 / 满分 / 字数限制 / stem 截断). 申论卷正常 5 题, 不分页.
//
// 入口: 顶部"进入考场" CTA 走 V2 整卷考场 (/essay/exam/:paperCode). 单题
// 练习 v1 已下线 — 题列表只展示, 不再带"答这题" CTA.

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircleIcon, FileTextIcon, RefreshIcon } from '@sikao/ui/icons';
import {
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@sikao/ui/ui';
import { api } from '@sikao/api-client/request';
import { ERROR_COPY } from '@/lib/ui-copy';

// 局部 type — 跟 backend PaperQuestionItemV2 (extends QuestionDetailV2) 子集
// 对齐. 只声明本 view 用到的字段 (frontend/CLAUDE.md §3.4 不一次性全量).
//
// SSOT: 走 content.essayMetadata (跟 EssayRenderer 同 path) — backend 已把
// type_payload 白名单字段抽到 content.essayMetadata, 序列化路径单一. 不读
// typePayload 防 SSOT 漂移 (review P2-1).
interface PaperQuestionListItem {
  readonly id: number;
  readonly position: number;
  readonly stemText: string;
  readonly rendererKey: string;
  readonly content?: {
    readonly essayMetadata?: {
      readonly fullScore?: number;
      readonly wordLimitMax?: number;
    };
  };
}

const STEM_PREVIEW_LEN = 80;

function previewStem(html: string): string {
  // 简单 strip tag — DOMPurify 不引 (本卡只列表预览, 不渲染富文本).
  const text = html.replace(/<[^>]*>/g, '').trim();
  if (text.length <= STEM_PREVIEW_LEN) return text;
  return `${text.slice(0, STEM_PREVIEW_LEN)}…`;
}

export default function EssayPaperDetail() {
  const { paperCode } = useParams<{ paperCode: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery<readonly PaperQuestionListItem[]>({
    queryKey: ['essay-paper-questions', paperCode],
    queryFn: () => api.get<readonly PaperQuestionListItem[]>(`/papers/${paperCode}/questions`),
    enabled: Boolean(paperCode),
  });

  const essayQuestions = (data ?? []).filter((q) => q.rendererKey === 'essay');

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <Breadcrumb
        items={[
          { label: '申论真题', href: '/essay/papers' },
          { label: paperCode ?? '' },
        ]}
      />

      <PageHeader
        eyebrow={paperCode}
        title="选一题开始作答"
        subtitle="每题独立提交, 评分通常 1-3 秒返回. 历史记录在「我的申论」."
      >
        <div className="mt-4 p-3 bg-surface-alt border border-line rounded-card-lg flex items-center gap-3">
          <FileTextIcon className="w-4 h-4 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink">整卷模考 · 申论 v2 ink-first 考场</div>
            <div className="text-xs text-ink-3 leading-relaxed">
              5 题独立倒计时 · 三栏工作台 · 田字格作答 · 划线 / 搜索 / 草稿。
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => paperCode && navigate(`/essay/exam/${paperCode}`)}
            disabled={!paperCode}
            data-testid="essay-paper-detail-exam-entry"
          >
            进入考场
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3" data-testid="essay-paper-detail-skeleton">
          <Skeleton heightClass="h-32" />
          <Skeleton heightClass="h-32" />
          <Skeleton heightClass="h-32" />
        </div>
      ) : isError ? (
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={ERROR_COPY.paperLoad.title}
          description={ERROR_COPY.paperLoad.description}
          action={
            <Button variant="secondary" onClick={() => { void refetch(); }} data-testid="essay-paper-detail-retry">
              <RefreshIcon className="w-4 h-4 mr-2" />
              重试
            </Button>
          }
        />
      ) : essayQuestions.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="w-8 h-8" />}
          title={ERROR_COPY.paperNotFound.title}
          description="本卷里没有申论题."
          action={
            <Button variant="quiet" onClick={() => navigate('/essay/papers')}>
              返回申论真题
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3" data-testid="essay-paper-detail-questions">
          {essayQuestions.map((q) => (
            <li key={q.id}>
              <Card padding="md" data-testid={`essay-paper-detail-question-${q.id}`}>
                <div className="flex-1 min-w-0">
                  <span className="text-tiny font-mono tracking-loose text-ink-3">
                    第 {q.position} 题
                    {q.content?.essayMetadata?.fullScore !== undefined ? (
                      <span className="ml-3">满分 {q.content.essayMetadata.fullScore}</span>
                    ) : null}
                    {q.content?.essayMetadata?.wordLimitMax !== undefined ? (
                      <span className="ml-3">≤ {q.content.essayMetadata.wordLimitMax} 字</span>
                    ) : null}
                  </span>
                  <p className="mt-2 text-md text-ink leading-relaxed">{previewStem(q.stemText)}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
