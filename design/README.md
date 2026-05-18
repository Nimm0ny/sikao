# sikao/design — 设计原型参考

> **来源**：完整复制自 `D:/py_pj/new_web/design/`（2026-05-13）。
>
> **用途**：仅作设计参考。**不**是 sikao 运行时代码、**不**是 SSOT。

## 内容

| 子目录 | 内容 | 大小 |
|---|---|---|
| `_archive/` | 历史归档（旧迭代的设计稿） | 12 MB |
| `auth/` | 登录页 4 套设计原型（v1-minimal / v2-friendly / v3-serif / v4-mobile） | 80 KB |
| `redesign-v2/` | 主线重设计 v2（free-workbench / radar-data / rhythm-timeline） | 136 KB |
| `redesign-v2.zip` | redesign-v2 打包 | 28 KB |
| `SIKAO/` | SIKAO 主线设计（drawer-options / extracted / handoff / icon-spec / mobile / xingce-redesign） | 1.4 MB |
| `sikao-zip-extracted/` | SIKAO 解压版（scenes 等） | 312 KB |
| `tokens.css` | 设计稿原型用的 token CSS（**不**是运行时 SSOT） | 16 KB |

## 运行时 SSOT（与本目录无关）

- 前端运行 token：`packages/design-system/src/tokens.css`（R2 单源，目前 stub）
- 当前实际运行 token：`apps/web/src/styles/tokens.css`（backward-compat）
- 设计规范文档：`docs/vault/04-design/`（含 `Frontend Style Guide.html`、`Design-System.md`、`Web-Layout.md`、`Mobile-Layout.md`、`Tablet-Layout.md`）

## 工作流

1. 改 token / 颜色 / 字号 / 圆角 时，**先**改 `packages/design-system/src/tokens.css`
2. 然后视情况同步本目录的 `tokens.css`（如果原型还在用）
3. 设计稿原型迭代时，新原型放对应子目录（如 `SIKAO/handoff-2026-05-XX-feature-name/`）
4. 归档：超过 30 天且不再被引用的原型 → `_archive/`

## 注意

按 `docs/vault/05-migration/Migration-Plan.md` 的历史迁移原则，设计原型不应该迁入 sikao；但 2026-05-13 用户拍板需要把这部分作为本地参考保留，覆盖该迁移约束。后续不需要时整目录可删，不影响代码运行。
