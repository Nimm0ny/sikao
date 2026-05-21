// Phase 5.6a · Marketing barrel。默认导出整页，section 组件私有（调用方不直接用）。
export { default as Marketing } from './Marketing';

// 法律页 (2026-05-21 PR-M1): 同属 Marketing layer 的公开页，复用 Nav + Footer chrome。
export { Privacy, Terms, Cookies } from './Legal';
