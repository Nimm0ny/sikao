---
type: product
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# User Flows

## 行测主链路

```
[Dashboard "继续上次" 入口]
  ↓
[/practice/center/xingce/papers] 选套卷
  ↓
[/practice/:paperCode/start] 答题准备页（看说明、设置答题模式）
  ↓ POST /api/v2/practice/start
[/practice/sessions/:sessionId] 答题考场
  ↓ PATCH save-answer（per question, debounce）
  ↓ POST submit（完成一题或主动提交）
  ↓ POST complete（最终提交）
[/practice/result/:sessionId] 成绩单
  ↓ 错题自动入库（[[Wrong-Book]]）
  ↓ 解析查看
```

## 申论主链路

```
[Dashboard / EssaySpecialty / EssayPaperDetail]
  ↓
[/essay/exam/:paperCode] 整卷模考 EssayShellSikao（双栏 + 田字格 + MmStrip）
  ↓ 草稿 autosave（debounce 2s）→ PATCH /draft
  ↓ 提交 → POST /submit
[/essay/grades/:recordId] 单题批改结果
  ↓ N 题聚合
[/essay/exam/results] 整卷成绩单（fullScore 加权）
```

## 错题本主链路

```
[Wrong Book 主页 /wrong-book]
  ↓ 看 5 stat + Heatmap + 毕业生
[/wrong-book/:questionId] 详情纵堆
  ↓ 选择重做
[/wrong-book/:questionId/redo] 分栏挑战 + 计时器 + 蒙对检测
  ↓ Mastery 4 字段更新
[/wrong-book/smart-review] 智能复盘 5 mode + Flashcard + 日历
```
