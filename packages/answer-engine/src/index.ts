// @sikao/answer-engine — 答题核心引擎 barrel
//
// 子模块：
//   session/         会话状态机（created / in_progress / paused / submitted / reviewing / expired / cancelled）
//   scoring/         行测评分、申论加权评分
//   timing/          计时器
//   highlight/       划线/书签范围合并
//   word-limit/      申论字数 + 字符计算（bodyChars / wordLimits）
//   grid-layout/     田字格布局算法
//   graphic-detect/  图形推理识别
//
// 不依赖 React，纯逻辑。被 `@sikao/domain` 与服务端复用。
//
// 注意: gridLayout.ts 与 timing.ts 中都有 `formatTime`-类工具，故顶层
// barrel 不做 `export *`；使用者按子路径显式 import：
//   from '@sikao/answer-engine/word-limit/bodyChars'
//   from '@sikao/answer-engine/word-limit/wordLimits'
//   from '@sikao/answer-engine/grid-layout/gridLayout'
//   from '@sikao/answer-engine/highlight/highlightRanges'
//   from '@sikao/answer-engine/graphic-detect/isGraphicReasoning'

export {};
