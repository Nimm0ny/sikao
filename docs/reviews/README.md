---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-25
---

# Reviews 落档目录

> H5 + H11 强制：所有独立 subagent review 报告必须落档到本目录，命名 `<sik>-<wave>.md`。
> commit message 单写 "review pass" 不算审查通过。

## 模板

每份 review 报告 6 段：

1. **Scope** — 检查范围（哪些文件 / 哪一波 PR / 对应 contract）
2. **Findings** — 发现项（每条编号 / 严重度 high·mid·low / 证据行号 / 类别）
3. **Visual Contract Cross-Check**（视觉 phase 必填）— 逐行对比 contract §2.6 Acceptance Hooks
4. **Suggested Actions** — 每条发现的建议处理（修 / 偏离登记 / 接受 / 拒绝）
5. **Risk Level** — 整体风险评估
6. **Decision** — review pass / review fail (不允许"待定")

## 命名规则

- `sik-90-w1.md` — SIK-90 wave 1 review
- `sik-fu-a-w1.md` — follow-up issue SIK-FU-A wave 1 review
- `sik-31-master-diff.md` — master diff review（>400 行触发）

## 与 Multica 的关系

Evidence Block 中 `Subagent review` 字段必须填本目录下的相对路径，例如：

```
Subagent review: docs/reviews/sik-fu-a-w1.md (review pass, 0 high findings)
```

无报告 / 报告路径不存在 / 报告 high findings 未处理 → issue 不得标 done。
