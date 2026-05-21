# Phase · Marketing（公开层）

> **Status**: TBD（占位）
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

## 1. 启动前置

- ⏳ 产品定价模型决策（免费 / 订阅 / 一次性买断）
- ⏳ 法律文本（用户协议 / 隐私政策的中文合规版本）
- ⏳ 内容运营（落地页文案 / 设计稿）

---

## 2. 关联 IA 决策

- D-Layer：未登录访问 → 默认进入 Marketing
- 性能：landing 页 LCP ≤ 2.0s（比 Main App 严格）
- SEO：sitemap / robots / OG image / 结构化数据

---

## 3. 预期文档结构

```
Phase/Marketing/
├── README.md
├── 00-Decisions.md          页面清单 / SEO 策略 / 法律文本决策
├── 01-Frontend-WU.md        landing / about / pricing / faq / legal
├── 02-Content-Pipeline.md   文案与图片来源 / 多版本 A/B
├── 03-SEO.md                sitemap / OG / 结构化数据 / 性能优化
└── 04-Testing.md            Lighthouse / SEO 验证
```

---

## 4. 待解的设计问题

- 中国大陆 ICP 备案 / 公安备案的展示位置
- 价格页是否上线（与产品定价决策同步）
- 是否做博客（运营成本）

---

## 5. 关联文档

- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md)
- [../../../04-design/Design-System.md](../../../04-design/Design-System.md)
