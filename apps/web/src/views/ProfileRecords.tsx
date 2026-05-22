import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Button, Card, EmptyState, Skeleton } from '@sikao/ui/ui';
import { useProfileRecords } from '@sikao/api-client/profileQueries';
import type { LearningRecordListResponseV2 } from '@sikao/api-client/types/home';

import { MvpPage } from '@/components/mvp';

type LearningRecordItem = LearningRecordListResponseV2['items'][number];

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const KIND_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'xingce_practice', label: '行测练习' },
  { value: 'essay_submission', label: '申论作答' },
] as const;

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '进行中 / 待完成' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
] as const;

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalPositiveInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function formatChinaDay(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatChinaTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function labelForKind(kind: string): string {
  return KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

function labelForStatus(status: string): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function statusTone(status: string): string {
  if (status === 'completed') return 'text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0]';
  if (status === 'failed') return 'text-[#B91C1C] bg-[#FEF2F2] border-[#FECACA]';
  return 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]';
}

function groupRecords(items: readonly LearningRecordItem[]): ReadonlyArray<{
  readonly day: string;
  readonly entries: readonly LearningRecordItem[];
}> {
  const groups = new Map<string, LearningRecordItem[]>();
  items.forEach((item) => {
    const day = formatChinaDay(item.occurredAt);
    const current = groups.get(day);
    if (current) {
      current.push(item);
      return;
    }
    groups.set(day, [item]);
  });
  return Array.from(groups.entries()).map(([day, entries]) => ({ day, entries }));
}

function RecordsSkeleton() {
  return (
    <div className="space-y-4" data-testid="profile-records-loading">
      <Card padding="md" className="border-line bg-surface">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} heightClass="h-12" />
          ))}
        </div>
      </Card>
      <Card padding="md" className="border-line bg-surface">
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} heightClass="h-20" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function ProfileRecords() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePositiveInt(searchParams.get('page'), DEFAULT_PAGE);
  const size = parsePositiveInt(searchParams.get('size'), DEFAULT_PAGE_SIZE);
  const kind = searchParams.get('kind') ?? '';
  const status = searchParams.get('status') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const sessionId = searchParams.get('session_id');
  const sessionIdFilter = parseOptionalPositiveInt(sessionId);

  const query = useProfileRecords({
    page,
    size,
    kind: kind || undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
    sessionId: sessionIdFilter,
  });

  const groups = useMemo(
    () => groupRecords(query.data?.items ?? []),
    [query.data?.items],
  );
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));

  function patchParams(
    patch: Record<string, string | null>,
    options: { readonly resetPage?: boolean } = {},
  ): void {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === '') {
        next.delete(key);
        return;
      }
      next.set(key, value);
    });
    if (options.resetPage === true) {
      next.delete('page');
    }
    setSearchParams(next);
  }

  return (
    <MvpPage
      eyebrow="Home Phase M11"
      title="学习记录"
      subtitle="按日期回看练习与申论作答记录；筛选条件直接写进 URL，便于复用 deep-link。"
      testId="profile-records-view"
    >
      {query.isLoading ? (
        <RecordsSkeleton />
      ) : query.isError ? (
        <EmptyState
          tone="error"
          title="学习记录加载失败"
          description="当前 records 数据不可用，请重试。"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void query.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <Card padding="md" className="border-line bg-surface" data-testid="profile-records-filters">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="flex flex-col gap-1 text-sm text-[#4B5563]">
                <span>类型</span>
                <select
                  aria-label="records kind"
                  className="min-h-10 rounded-lg border border-[#D7DFEC] bg-white px-3"
                  value={kind}
                  onChange={(event) => patchParams({ kind: event.target.value }, { resetPage: true })}
                >
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-[#4B5563]">
                <span>状态</span>
                <select
                  aria-label="records status"
                  className="min-h-10 rounded-lg border border-[#D7DFEC] bg-white px-3"
                  value={status}
                  onChange={(event) => patchParams({ status: event.target.value }, { resetPage: true })}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-[#4B5563]">
                <span>开始日期</span>
                <input
                  aria-label="records from"
                  type="date"
                  className="min-h-10 rounded-lg border border-[#D7DFEC] bg-white px-3"
                  value={from}
                  onChange={(event) => patchParams({ from: event.target.value }, { resetPage: true })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-[#4B5563]">
                <span>结束日期</span>
                <input
                  aria-label="records to"
                  type="date"
                  className="min-h-10 rounded-lg border border-[#D7DFEC] bg-white px-3"
                  value={to}
                  onChange={(event) => patchParams({ to: event.target.value }, { resetPage: true })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-[#4B5563]">
                <span>每页数量</span>
                <select
                  aria-label="records page size"
                  className="min-h-10 rounded-lg border border-[#D7DFEC] bg-white px-3"
                  value={String(size)}
                  onChange={(event) => patchParams({ size: event.target.value }, { resetPage: true })}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} / 页
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSearchParams(sessionId ? new URLSearchParams({ session_id: sessionId }) : new URLSearchParams())}
                >
                  清空筛选
                </Button>
              </div>
            </div>
            {sessionIdFilter != null ? (
              <div className="mt-3 text-sm text-[#4B5563]" data-testid="profile-records-session-hint">
                当前聚焦 session #{sessionIdFilter}
              </div>
            ) : null}
          </Card>

          {total === 0 ? (
            <EmptyState
              title="暂无学习记录"
              description="当前筛选条件下还没有可展示的记录。"
            />
          ) : (
            <>
              <Card padding="md" className="border-line bg-surface" data-testid="profile-records-ready">
                <div className="flex items-center justify-between gap-3 text-sm text-[#4B5563]">
                  <span>
                    共 {total} 条记录，第 {page} / {totalPages} 页
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={page <= 1}
                      onClick={() => patchParams({ page: String(page - 1) })}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={page >= totalPages}
                      onClick={() => patchParams({ page: String(page + 1) })}
                    >
                      下一页
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-6">
                  {groups.map((group) => (
                    <section key={group.day} data-testid={`profile-records-group-${group.day}`}>
                      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#2563EB]">
                        {group.day}
                      </div>
                      <div className="space-y-3">
                        {group.entries.map((item) => (
                          <Link
                            key={item.id}
                            to={item.href}
                            className="block rounded-lg border border-[#E1E6F0] bg-white p-4 transition-colors hover:bg-[#F7F8FB]"
                            data-testid={`profile-record-link-${item.id}`}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]">
                                    {labelForKind(item.kind)}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(item.status)}`}
                                  >
                                    {labelForStatus(item.status)}
                                  </span>
                                </div>
                                <div className="mt-3 text-base font-semibold text-[#111827]">
                                  {item.title}
                                </div>
                                <div className="mt-1 text-sm text-[#4B5563]">
                                  {formatChinaTime(item.occurredAt)}
                                  {item.score != null ? ` · 分数 ${item.score}` : ''}
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-[#2563EB]">
                                查看详情
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </MvpPage>
  );
}
