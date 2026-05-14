import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * RedirectPreserveQuery — PR16 (2026-05-13) 练习中心整合 redirect helper.
 *
 * React Router 默认 `<Navigate to="/x" />` 丢 `location.search`. 用 hook 取当前
 * search 拼到 to 上, 让 `?region= / ?year= / ?paperType= / ?page=` 等 query 透传.
 *
 * 用于:
 *   /papers       → /practice/center/xingce/papers (Papers.tsx 消费 query)
 *   /essay/papers → /practice/center/essay/papers  (EssayPapers.tsx 消费 query)
 *
 * 拆独立文件: router/index.tsx 主要导出 `router` 常量, ESLint `react-refresh/
 * only-export-components` 不允许在常量导出旁同时 export React 组件 / 内联 React
 * 组件 (Fast Refresh boundary). 单独 module 干净.
 */
export function RedirectPreserveQuery({ to }: { readonly to: string }): ReactElement {
  const location = useLocation();
  const target = location.search.length > 0 ? `${to}${location.search}` : to;
  return <Navigate to={target} replace />;
}
