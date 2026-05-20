// ConversationsHistory — Slice 1b 解析问答会话记录 view.
//
// /conversations 路由. 列我的最近 20 个解析问答会话, 点击展开 detail (含
// messages 全文), 支持删除. 个人中心加 entry 跳本 view.
//
// 没接 streaming 续话 — 续话走 ChatPanel 直接打开 (从某个 detail 点 "继续
// 提问" 路径留 Slice 1b-2 加, 那时也加 mobile UX). 现在会话记录 view 是
// 只读历史 + 删除. 三态走 QueryBoundary (T-C3 收敛).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  Modal,
  Skeleton,
} from '@sikao/ui/ui';
import { QueryBoundary } from '@/components/data';
import { NavBackIcon, TrashIcon } from '@sikao/ui/icons';
import {
  deleteConversation,
  fetchConversationDetail,
  fetchMyConversations,
  llmConversationsKeys,
} from '@sikao/api-client/apiQueries';
import { ERROR_COPY, LLM_QA_COPY } from '@/lib/ui-copy';
import { toast } from '@sikao/shared-utils';
import { logger } from '@sikao/shared-utils';
import { MessageBubble } from '@/components/llm/MessageBubble';

export default function ConversationsHistory() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: llmConversationsKeys.list(),
    queryFn: fetchMyConversations,
  });

  const detailQuery = useQuery({
    queryKey:
      selectedId !== null ? llmConversationsKeys.detail(selectedId) : ['llm-conversations', 'detail-noop'],
    queryFn: () => {
      if (selectedId === null) throw new Error('no selectedId');
      return fetchConversationDetail(selectedId);
    },
    enabled: selectedId !== null,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteConversation(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: llmConversationsKeys.list() });
      if (selectedId === id) setSelectedId(null);
      setPendingDelete(null);
      toast.info('已删除', LLM_QA_COPY.deleteRemovedDesc);
    },
    onError: (err) => {
      logger.error('llm.conversation.delete_failed', { err: String(err) });
      setPendingDelete(null);
      toast.error('删除失败', '稍后重试');
    },
  });

  return (
    <div
      className="p-4 md:p-8 max-w-4xl mx-auto space-y-5"
      data-testid="conversations-history"
    >
      <BackButton onBack={() => navigate('/profile')} />
      <header>
        <h1 className="text-h-card font-bold text-ink mb-1">{LLM_QA_COPY.historyTitle}</h1>
        <p className="text-meta text-ink-3">{LLM_QA_COPY.historySubtitle}</p>
      </header>

      <QueryBoundary
        query={listQuery}
        testId="conversations"
        skeleton={
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        }
        errorTitle={ERROR_COPY.llmQaListLoad.title}
        errorDescription={ERROR_COPY.llmQaListLoad.description}
        emptyWhen={(data) => data.items.length === 0}
        emptyState={
          <EmptyState
            title={LLM_QA_COPY.historyTitle}
            description={LLM_QA_COPY.historyEmpty}
          />
        }
      >
        {(data) => (
          <ul className="space-y-3" role="list">
            {data.items.map((c) => (
              <li key={c.id}>
                <Card
                  padding="md"
                  className="cursor-pointer hover:border-ink-3 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="w-full text-left"
                    aria-expanded={selectedId === c.id}
                    data-testid={`conversation-item-${c.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-bold text-ink truncate">{c.title}</p>
                        {c.lastPreview !== null ? (
                          <p className="text-meta text-ink-3 mt-1 line-clamp-2">
                            {c.lastPreview}
                          </p>
                        ) : null}
                        <p className="text-tiny font-mono text-ink-4 mt-2">
                          {c.messageCount} {LLM_QA_COPY.historyMessageCount} ·{' '}
                          {formatRelTime(c.updatedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(c.id);
                        }}
                        className="text-ink-3 hover:text-err transition-colors"
                        aria-label={`删除会话: ${c.title}`}
                        data-testid={`conversation-delete-${c.id}`}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </button>
                </Card>

                {selectedId === c.id && detailQuery.data !== undefined ? (
                  <div
                    className="mt-3 ml-3 border-l-2 border-line pl-4 space-y-3"
                    data-testid={`conversation-detail-${c.id}`}
                  >
                    {detailQuery.data.messages.map((m) =>
                      m.role === 'system' ? null : (
                        <MessageBubble key={m.id} role={m.role}>
                          {m.content}
                        </MessageBubble>
                      ),
                    )}
                  </div>
                ) : null}
                {selectedId === c.id && detailQuery.isLoading ? (
                  <div className="mt-3 ml-3 space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="删除会话"
      >
        <p className="text-body text-ink mb-5">{LLM_QA_COPY.deleteConfirm}</p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setPendingDelete(null)}
            data-testid="conversations-delete-cancel"
          >
            {LLM_QA_COPY.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (pendingDelete !== null) deleteMutation.mutate(pendingDelete);
            }}
            isLoading={deleteMutation.isPending}
            data-testid="conversations-delete-confirm"
          >
            {LLM_QA_COPY.delete}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function BackButton({ onBack }: { readonly onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center text-meta text-ink-3 hover:text-ink transition-colors"
      data-testid="conversations-back"
    >
      <NavBackIcon size={16} className="mr-1" />
      返回个人中心
    </button>
  );
}

// 极简相对时间, 不引外部库 (项目无 dayjs/date-fns dep, 自己 format).
function formatRelTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.valueOf())) return '';
  const diffMs = Date.now() - d.valueOf();
  const minute = 60_000;
  const hour = 3600_000;
  const day = 86_400_000;
  if (diffMs < minute) return '刚刚';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} 分钟前`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)} 天前`;
  // 落到日期
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`;
}
