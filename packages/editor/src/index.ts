// @sikao/editor — 申论编辑器与富文本能力 barrel
//
// 子模块：
//   grid-paper/      田字格输入面板
//   highlight-rail/  材料划线轨道
//   scratch-panel/   草稿纸
//   answer-area/     答题区（typed / handwritten 双模）
//   citation/        引用追踪
//
// 这里只放编辑器组件本身（含必要的可访问性与交互），算法（字数 / 网格布局 / 划线合并）走 `@sikao/answer-engine`。

export { ExamShell } from './ExamShell';
export { TopBar } from './TopBar';
