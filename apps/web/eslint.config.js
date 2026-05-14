import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// PR4 — Frontend Style Guide v1 (2026-05-12):
//   eslint-plugin-jsx-a11y 注册为 plugin, 显式开 master prompt 指定的 6 条
//   a11y rule. **不**走 jsx-a11y/recommended preset, 避免引入 master 未授权
//   的额外约束 (anchor-is-valid / interactive-supports-focus / click-events-
//   have-key-events / no-redundant-roles 等), PR5 视收口情况再增量启用.
//
// PR5b (2026-05-13, lhr 授权): 52 warn 全部修完, 4 个 warn rule 转 error,
//   完成 a11y baseline 收口. 仍走 6 条精确白名单, 不切 recommended preset.
//
// 关键 rule:
//   - control-has-associated-label: <button>/<input> 必须有 accessible name
//   - no-static-element-interactions: <div onClick>...</div> 报错, 改用 <button>
//   - no-noninteractive-element-interactions: <ul onClick> 报错
//   - alt-text: <img> 必须有 alt
//   - aria-props: 防 aria-bogus-prop typo
//   - aria-role: 防 role="foo-bar" 非法值
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // PR5b (2026-05-13): 6 rule 全 error. 业务代码 90% case 已修真 a11y bug
      //   (<li onClick> -> <button>, <article onClick> -> 加 role/tabIndex/keyDown,
      //   resizer 加 role=separator, 等); 剩 ~30% 是 plugin 不识别的合法 W3C pattern
      //   误报 (cross-node <label htmlFor>, nested <label> wraps <span>+input,
      //   draggable phrase 内嵌 reader, drag-only enhancement 等), 行级 escape
      //   + 注释说清楚 plugin 限制和 fallback path.
      'jsx-a11y/control-has-associated-label': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
    },
  },
])
