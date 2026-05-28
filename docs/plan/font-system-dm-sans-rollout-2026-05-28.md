---
type: plan
status: active
owner: lhr
last-reviewed: 2026-05-28
---

> **2026-05-28 closeout note**: this plan remains `active` only because
> Step 3 page/component adoption is still pending. Step 1 system-layer
> closeout is tracked in `docs/reviews/font-system-dm-sans-evidence.md`.

# Font System · DM Sans Rollout

## Summary

- 目标：把 v2.1 原型字体风格升级为 V5 正式标准
- 拉丁主字体：`DM Sans`
- 次级拉丁 fallback：`Inter`
- mono：`JetBrains Mono`
- CJK：继续系统 fallback，不自托管中文字体
- 运行时禁止外链字体；所有字体通过 design-system 自托管

## Decisions

- 修改 `REQ-5.5 / R1-Q3`：从“纯系统字体栈”升级为“自托管 `DM Sans + Inter + JetBrains Mono` + 系统 CJK fallback”
- `packages/design-system/src/tokens.css` 新增：
  - `@font-face`
  - `--font-family-ui`
  - `--font-family-ui-secondary`
  - `--font-family-mono`
- `apps/web/src/index.css` 的 `body` 只消费 `--font-family-ui`
- 所有 `kbd` / mono surface 统一消费 `--font-family-mono`
- `apps/**/src/**` 不允许直写 `font-family`
- 本地与构建产物都不得再引用 `fonts.googleapis.com` / `fonts.gstatic.com`

## Rollout

1. 系统层
   - 规范、设计系统、字体资产、token、gate、active authority 同步
2. Home
   - 完整收口 Home 的 typography：topbar、metric、calendar 三视图、rail、下栏四组件
3. 后续页面
   - Practice / Review / Note / Me / Profile / QuestionHub 按开发/收尾节奏吸收新 token

## Acceptance

- `typecheck + lint + test` 全绿
- 字体资产路径稳定，build 可打包
- 源码与构建产物都无 Google Fonts 外链
- Home `1440 / 1920`、`today / week / month` 三视图截图通过对照
- active authority 不再把系统栈、5-tab、`/q/:id` 写成当前真相
