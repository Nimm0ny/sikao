import type { ReactNode } from 'react';

// SIKAO Wave 2 Phase 3 — hifi 05b 申论结果 right aside (Fixer D).
//
// 视觉 spec (design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 3026-3038, 3149-3184):
//   aside .card (background var(--paper-2) + border 1px var(--line-2) +
//                padding 16px 18px + margin-bottom 14px) — 多张堆叠
//   aside .card .h (flex justify-between align baseline + margin-bottom 12px)
//     h4 (serif 15px weight 500)
//     small (mono 10px var(--ink-3) tracking-widest)
//   aside .stat-row (flex justify-between, padding 7px 0,
//                    border-bottom 1px var(--line-2), mono 12px var(--ink-2))
//   aside .stat-row .v (var(--ink-1))
//   aside .stat-row .v.warn (var(--accent-1))
//   aside .ref-list (flex column gap 8px)
//     .r grid 36px/1fr/auto (.k var(--accent-1) border var(--accent-1) padding 1px 6px)
//
// 底部按钮 slot (e.g. "进入引用专项 5 题" / "看老师批注" / "导出 PDF")
// 由 caller 拼装 ReactNode 喂进来 (跟数据/路由解耦, 不在 primitive 内置 CTA).

export interface AsideCardSection {
  /** card 标题 (h4 serif 15px). */
  readonly title: string;
  /** card 头部右侧小字 (mono 10px tracking-widest). 可选 */
  readonly subtitle?: string;
  /** card body — 自由 ReactNode (caller 决定 stat-row / ref-list / 自定义) */
  readonly body: ReactNode;
  /** test id 后缀 */
  readonly testIdSuffix: string;
}

export interface EssayResultAsideProps {
  /** 多张卡片堆叠 */
  readonly cards: readonly AsideCardSection[];
  /** 底部 CTA 按钮区 (可选). caller 负责 Button primitive. */
  readonly footer?: ReactNode;
  readonly className?: string;
  /** data-testid 前缀, 默认 'essay-result-aside' */
  readonly testIdPrefix?: string;
}

interface AsideCardProps {
  readonly section: AsideCardSection;
  readonly testIdPrefix: string;
}

function AsideCard({ section, testIdPrefix }: AsideCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--paper-2)',
        border: '1px solid var(--line-2)',
        padding: '16px 18px',
        marginBottom: '14px',
      }}
      data-testid={`${testIdPrefix}-card-${section.testIdSuffix}`}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: '12px' }}
      >
        <h4
          className="font-serif"
          style={{
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--ink-1)',
            margin: 0,
          }}
        >
          {section.title}
        </h4>
        {section.subtitle !== undefined ? (
          <small
            className="font-mono uppercase"
            style={{
              fontSize: '10px',
              color: 'var(--ink-3)',
              letterSpacing: 'var(--tracking-widest)',
            }}
          >
            {section.subtitle}
          </small>
        ) : null}
      </div>
      <div>{section.body}</div>
    </div>
  );
}

// helper 子组件 — caller 在 body 中 import 用. 三种常用 row 类型抽出.

export interface StatRowProps {
  readonly label: string;
  readonly value: string;
  /** 'warn' = var(--accent-1) 染色 */
  readonly tone?: 'default' | 'warn';
  /** 是否最后一行 (无 border-bottom) */
  readonly last?: boolean;
  readonly testId?: string;
}

export function StatRow({ label, value, tone = 'default', last = false, testId }: StatRowProps) {
  // jsdom 对 shorthand `borderBottom: 'none'` 反序列化为 'medium' (default-style),
  // 影响 dom snapshot 断言可读性. 用 longhand width/style 两段写法, 浏览器
  // 视觉一致, jsdom 序列化也明确.
  const borderBottomStyle = last
    ? { borderBottomWidth: 0, borderBottomStyle: 'none' as const }
    : {
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid' as const,
        borderBottomColor: 'var(--line-2)',
      };
  return (
    <div
      className="flex justify-between font-mono"
      style={{
        padding: '7px 0',
        ...borderBottomStyle,
        fontSize: '12px',
        color: 'var(--ink-2)',
        letterSpacing: 'var(--tracking-loose)',
      }}
      data-testid={testId}
    >
      <span>{label}</span>
      <span
        className="tabular-nums"
        style={{
          color: tone === 'warn' ? 'var(--accent-1)' : 'var(--ink-1)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export interface RefListItemProps {
  /** 短 key (e.g. M1 / M2 / 论点). 显示在左侧 .k chip */
  readonly k: string;
  /** 描述 (中间 1fr 列) */
  readonly label: string;
  /** 数值 (右列, e.g. "2 / 3") */
  readonly value: string;
  /** 'warn' = .n 染 var(--accent-1) */
  readonly tone?: 'default' | 'warn';
  readonly testId?: string;
}

export function RefListItem({
  k,
  label,
  value,
  tone = 'default',
  testId,
}: RefListItemProps) {
  return (
    <div
      className="grid items-center font-mono"
      style={{
        gridTemplateColumns: '36px 1fr auto',
        gap: '8px',
        fontSize: '11px',
        color: 'var(--ink-2)',
        letterSpacing: 'var(--tracking-loose)',
      }}
      data-testid={testId}
    >
      <span
        className="font-mono uppercase"
        style={{
          color: 'var(--accent-1)',
          border: '1px solid var(--accent-1)',
          padding: '1px 6px',
          textAlign: 'center',
          letterSpacing: 'var(--tracking-loose)',
        }}
      >
        {k}
      </span>
      <span>{label}</span>
      <span
        className="font-serif tabular-nums"
        style={{
          fontSize: '13px',
          color: tone === 'warn' ? 'var(--accent-1)' : 'var(--ink-1)',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export interface RefListProps {
  readonly children: ReactNode;
  readonly testId?: string;
}

export function RefList({ children, testId }: RefListProps) {
  return (
    <div
      className="flex flex-col"
      style={{ gap: '8px' }}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function EssayResultAside({
  cards,
  footer,
  className,
  testIdPrefix = 'essay-result-aside',
}: EssayResultAsideProps) {
  return (
    <aside
      className={className}
      data-testid={testIdPrefix}
      style={{ width: '100%' }}
    >
      {cards.map((section) => (
        <AsideCard
          key={section.testIdSuffix}
          section={section}
          testIdPrefix={testIdPrefix}
        />
      ))}
      {footer !== undefined ? (
        <div
          className="flex flex-col"
          style={{ gap: '8px' }}
          data-testid={`${testIdPrefix}-footer`}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
