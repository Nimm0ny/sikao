# 04 · 申论答题页

> HTML 锚点：`04 · 申论答题`（单题 + 草稿纸）· `04b · 多材料多题目`
> 路由：`/essay/:setId/:qId`（单题）· `/essay/:setId`（多题）

## 共同布局（双栏 1.1fr / 1fr）
```
┌─────────────────────────┬─────────────────────────┐
│ 左：MaterialPanel        │ 右：EditorPanel          │
│  - 题面 / Material 标题  │  - QUESTION + 字数计数   │
│  - 正文（衬线 17/1.78）   │  - 引用条 (cite-bar)     │
│  - 划线短语 (.hl) 带 ⋮⋮  │  - 编辑器 textarea       │
│    grip · draggable      │  - 工具栏（保存 / 提交） │
│ ─────────────────────── │  - AI 思考骨架 (PRO)     │
│ 草稿纸 (ScratchPad)      │                          │
│  - 横线纸面板             │                          │
│  - 已贴 clip × 3          │                          │
│  - 自由便签 × N           │                          │
│  - dropZone "拖入此处"   │                          │
└─────────────────────────┴─────────────────────────┘
```

## 草稿纸（核心机制）
- 视觉：纸黄底 (`--paper-2`) + repeating-linear-gradient 横线（28px 一道，`--rule` 1px）
- `ScratchClip`：从材料拖出的短语，外观像便利贴 / 透明胶带（左上有 `📎` 占位 → 用线性 svg pin 图标），底部一行小 mono 显示来源 `M2 · 段三`
- `ScratchNote`：用户自己输入的便签，paper-3 底，可编辑
- 排列：竖向自上而下，顺序是放置顺序，drag 后端记录 `position: number`
- 进入 dropping 状态时整个 ScratchPad 描边 1px dashed `--accent`

## 拖拽规则
- 左栏 `.hl` `draggable=true`，dragstart 写入 `text/plain` + `application/x-essay-clip` JSON: `{ matId, lineIdx, text, sourceLabel }`
- ScratchPad 接受 drop → push to `scratchClips`
- 编辑器 textarea 接受 drop → 在光标位置插入"《引文》[M2·段三]" 并把 cite 加进 `citations`
- 编辑器内出现 drop-marker（虚线插入条）

## 04b · 多材料多题目
**唯一差异**（用户原话）：复用 04 同款 1.1fr/1fr 布局，**仅在 Material 和 Question 顶部各加一条均匀按钮条**。
```
左栏顶部 (.essay-mm-strip .l)：
  M1 [2 处] ●  | M2 已读 | M3 已读 | M4 1 处 ● | M5 已读 | M6 未读 | M7 未读
右栏顶部 (.essay-mm-strip .r)：
  Q1 198/200 ✓ | Q2 312/300 ✓ | Q3 142/500 (active) | Q4 0/1000 (locked)
```
- 按钮均匀一行（`grid-template-columns: repeat(7, 1fr)` 与 `repeat(4, 1fr)`），不允许换行
- 每个 tab：第一行 `M1` 标题，第二行小 mono 副标"2 处 / 已读 / 未读"，第三列已划重点 `.dot` 暗朱小圆点
- Q tab 的 `done` 态有 ✓ 字符；`active` 态 letter 与下划线变暗朱
- 切 M tab 即换左栏正文；切 Q tab 即换右栏题面 + 编辑器

## AI 思考骨架（PRO）
- 5 步：① 读题 ② 浏览材料 ③ 抓关键词 ④ 拟提纲 ⑤ 引用规划
- 每步有 ✓ done / ○ pending / ◉ doing
- 出现位置：右栏底部抽屉，默认折叠，hover "AI" 字符展开

## 数据
```ts
type EssayVM = {
  set: { id: string; title: string };
  materials: Material[];
  questions: EssayQuestion[];
  activeMatId: string;
  activeQid: string;
  draft: { qid: string; body: string; citations: Citation[]; wordCount: number };
  scratchClips: ScratchClip[]; // 全 set 共用同一张草稿纸
  scratchNotes: ScratchNote[];
};
```

## 验收
- [ ] 04 单题 / 04b 多题 共用同一组 React 组件，只是 04b 多渲染 `<MmStrip>`
- [ ] M / Q 标签条 grid 等宽，永远不换行（`min-width: 0; overflow:hidden text-ellipsis`）
- [ ] 草稿纸的横线是 CSS gradient 不是图片
- [ ] 拖拽过程中只有目标可视提示，不能让整页抖动
- [ ] Q4 大作文模式可隐藏左栏 ScratchPad（"专注大作文"按钮）
