# Phase · Marketing（公开层）

> **Status**: DONE — v1 上线就绪（2026-05-21 拍板）
> **IA 位置**：① Marketing Layer（最外层公开页）
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围预览

公开层是未登录用户能访问的所有页面。覆盖：

- Landing（首页营销）
- About / Pricing / Features / FAQ
- 法律页（用户协议 / 隐私政策 / Cookie 声明 / 备案信息）
- 帮助中心（可选，链接到外部文档）
- 公开博客 / 题库示例（可选）

---

## 1. 完成清单（v1 已落地）

| 项 | 状态 | 落地位置 |
|---|---|---|
| Landing 营销页（Hero / Preview / Stats / HowItWorks / Features / Invite / Pricing / FAQ / Footer） | ✅ | `apps/web/src/views/marketing/` (11 组件) |
| 路由守卫：未登录 `/` → Marketing，已登录跳 `/app` | ✅ | `router/index.tsx` RedirectGuard |
| 法律页：隐私政策 `/legal/privacy` | ✅ | `views/marketing/Legal/Privacy.tsx` |
| 法律页：服务条款 `/legal/terms` | ✅ | `views/marketing/Legal/Terms.tsx` |
| 法律页：Cookie 声明 `/legal/cookies` | ✅ | `views/marketing/Legal/Cookies.tsx` |
| Footer 死链消除（隐私政策 / 服务条款 / Cookie 声明 → 真实 Link） | ✅ | `Footer.tsx` |
| RegisterEmail 注册同意文案 → 可点击链接 | ✅ | `RegisterEmail.tsx` |
| ICP 备案占位 "备案中" | ✅ 占位 | `Footer.tsx`（拿到号后 1 行替换） |
| 产品定价模型 | ✅ 隐式落地 | `Pricing.tsx`：月 ¥168 / 季 ¥128 / 年 ¥88 + Beta 首月免费 |
| 落地页文案 / 设计稿 | ✅ | 对齐 element/ui_kits V1 |

---

## 2. P1 Follow-up（不 block 上线）

| # | 项 | 优先级 | 备注 |
|---|---|---|---|
| F1 | ICP 真备案号替换 | P0（备案通过当天） | Footer 1 行改动 |
| F2 | SEO: sitemap.xml / robots.txt / OG meta / JSON-LD | P1 | `index.html` + `public/` 新文件 |
| F3 | Lighthouse LCP ≤ 2.0s 验收 + 性能优化 | P1 | mobile slow-3G 跑一遍 |
| F4 | About / 帮助中心 / 公众号 / 联系方式真链 | P1 | Footer "资源" + "关于" 列 4 个 `href="#"` |
| F5 | 是否拆 `/pricing` `/about` `/faq` 独立路由 | P2 | SEO 关键词覆盖 vs 单页节奏 |
| F6 | 公安备案展示 | P2 | 拿到后加 Footer 底行 |
| F7 | 博客 / 题库示例公开页 | P3 | 运营成本决策 |

---

## 3. 关联 IA 决策

- D-Layer：未登录访问 → 默认进入 Marketing
- 性能：landing 页 LCP ≤ 2.0s（比 Main App 严格）
- SEO：sitemap / robots / OG image / 结构化数据

---

## 4. 已解决的设计问题

| 问题 | 决策 | 日期 |
|---|---|---|
| ICP 备案展示位置 | Footer 版权行右侧，备案号可点击跳工信部查询页 | 2026-05-21 |
| 价格页是否上线 | ✅ 上线（Beta 首月免费 banner + 3 档表） | 2026-05-21 |
| 是否做博客 | 推迟 P3（运营成本高，先做核心产品） | 2026-05-21 |

---

## 5. 关联文档

- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md)
- [../../../04-design/Design-System.md](../../../04-design/Design-System.md)
