// R2.4 (2026-05-13): renderWithProviders 已搬到 @sikao/test-utils (tests/fixtures).
// 这里 re-export 保持 apps/web 测试 backward-compat. 新代码请直接从
// @sikao/test-utils 引入.
export { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
