---
type: domain
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# Xingce 行测

## 范畴

行测（行政职业能力测验）客观题答题与评分。

## 覆盖

- 题目展示
- 单选 / 多选 / 判断 / 填空 / 图形推理
- 作答 / 切题 / 答题卡
- 划线 + 笔记 + 收藏
- 提交（per-answer + final）
- 正误判断（绝对客观）
- 解析展示
- 练习结果

## 评分规则

- 单选：正确得分，错误 / 漏选 0 分
- 多选：完全正确得分，少选 / 错选 0 分（brief 待确认是否半分）
- 判断：正确得分
- 填空 / 图形推理：按题型规则

具体规则**必须**落到：

```
packages/answer-engine/src/scoring/xingce.ts
```

不允许散落到页面里。

## 关联

- [[Answer-Session]] / [[Grading]] / [[Question-Bank]] / [[Wrong-Book]]

## 状态

`not_started`
