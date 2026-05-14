# 07 · 营销首页（落地页）

> 用户原文件：`marketing-redesign.html`。**hero 标语和真题演示部分不动**，其余可重写。
> Slogan 永远是 `让备考从刷题变成思考`。

## 整体节奏
1. **Hero**（不动）— "让备考从刷题变成思考" + 真题演示
2. **诊断** — 现有备考产品的三条问题，配引用块（`.diag-item`）
3. **定位** — 我们 vs 粉笔/华图：表格化（`.pos-cell`）
4. **核心能力** — 三块：AI 思考骨架 / 草稿纸 / 错题闭环（每块一段 + 一张对应 artboard 截图占位）
5. **节奏 / Phase** — 14 周计划 visual（PHASE 01/02/03 卡片）
6. **价格** — Free vs Pro，简洁两列
7. **FAQ + footer**

## 写作语气
- 第一人称复数 "我们"，平稳冷静，不喊口号
- 数字克制：用具体数据时配来源（"基于 5 万份模考记录"）
- 不写"最 / 唯一 / 革命性"
- 中文衬线主标题，sans 副本，mono 数字

## 关键约束
- accent 用量：整页 ≤ 4 处暗朱（hero 一处 / phase 02 一处 / 价格 CTA 一处 / FAQ 高亮一处）
- 所有 artboard 截图位置先放占位 `<div class="placeholder">`，写明"截图于 design/SIKAO Redesign.html · `02 · Dashboard`"
- 滚动到每节时 eyebrow 编号自增（01 → 06）

## 验收
- [ ] hero 文案一字未改
- [ ] 真题演示组件不动（如 HTML 里有，原样移植）
- [ ] 所有占位都标了"来源 artboard 名"，便于后续替换
