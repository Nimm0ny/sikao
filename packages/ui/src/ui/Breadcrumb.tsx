import type { HTMLAttributes, ReactNode } from 'react';
import { Fragment } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.2 primitive — editorial breadcrumb with serif italic slash.
// 参考 element/preview/tabs-nav.html 的 `.crumbs` 组。
//
// 使用：
//   <Breadcrumb items={[
//     { label: '题库', href: '/app' },
//     { label: '国考 · 行测', href: '/app/papers?year=2024' },
//     { label: '第 12 题 · 法律' },       // 末项不带 href = 当前项
//   ]} />
//
// Dumb：不做路由。caller 传 href 就渲染 <a>（caller 可以包装成 react-router 的
// <Link> 外层替换 renderLink）。默认用原生 <a>，href="#"/ 空则渲染 span。

export interface BreadcrumbItem {
  readonly label: ReactNode;
  readonly href?: string;
}

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  readonly items: readonly BreadcrumbItem[];
  /** 自定义渲染链接（如 react-router <Link>）。默认 <a>。 */
  readonly renderLink?: (item: BreadcrumbItem & { href: string }, children: ReactNode) => ReactNode;
  readonly ariaLabel?: string;
}

export function Breadcrumb({
  items,
  renderLink,
  ariaLabel = '面包屑',
  className,
  ...rest
}: BreadcrumbProps) {
  if (items.length === 0) return null;
  const lastIdx = items.length - 1;
  return (
    <nav
      aria-label={ariaLabel}
      className={cn('flex items-baseline gap-3 text-sm text-ink-3', className)}
      {...rest}
    >
      {items.map((item, idx) => {
        const isCurrent = idx === lastIdx;
        const content = item.href != null && !isCurrent ? (
          renderLink != null ? (
            renderLink({ ...item, href: item.href }, item.label)
          ) : (
            <a
              href={item.href}
              className="text-ink-3 no-underline hover:text-ink transition-colors duration-fast"
            >
              {item.label}
            </a>
          )
        ) : (
          <span
            className={cn(isCurrent ? 'text-ink font-medium' : 'text-ink-3')}
            aria-current={isCurrent ? 'page' : undefined}
          >
            {item.label}
          </span>
        );
        return (
          <Fragment key={idx}>
            {content}
            {!isCurrent ? (
              <span
                aria-hidden="true"
                className="font-serif italic text-line-3 text-base leading-none"
              >
                /
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
