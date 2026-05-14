---
type: product
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# Web Layout

布局规范。详细规则见 new_web `docs/design/style-guide.md`（不复制原型，仅记录规则）。

## 关键约束

- **View 纵向预算 ≤2 屏**（≈2000px on 1080p viewport）
- 长列表（>20 项）走独立 page，不在入口 view 内 grid 铺
- 入口 view 只放 3 类内容：下一步做什么 / 关键 metric / 跳转独立 list 入口
- 答题 toolbar **SVG-only**（禁文字 label / emoji），主 CTA 例外

## 状态

`not_started` — 详细规则待从 new_web style-guide 提炼到本文件。
