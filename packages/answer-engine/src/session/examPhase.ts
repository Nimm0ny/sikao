// 答题会话状态机 — 纯逻辑
//
// R2.2（2026-05-13）：从 packages/domain/src/shenlun/types.ts 与 useExamSession.ts
// 抽离（ADR-0002）。本文件不依赖 React / zustand，只描述：
//   - 状态枚举
//   - 允许的状态迁移路径
//   - 守卫函数（can*）
//
// 当前实现是申论 5 状态（实际跑的版本）。brief §9.4 推荐的 7 状态机
// （created / in_progress / paused / submitted / reviewing / expired / cancelled）
// 是更完整的目标，等下一轮统一行测 + 申论时收敛（ADR-0005，待写）。

/**
 * 申论考场 5 状态：
 *   prestart   —— 等待用户点"开始"
 *   running    —— 正在答题，计时进行
 *   paused     —— 用户暂停，计时停顿
 *   submitting —— 用户点交卷，EssayClient.submit 进行中
 *   submitted  —— 提交完成，UI 进入只读复盘
 *
 * tick 已天然在 phase != running 时停倒计时（useExamSession），不需改
 * togglePause / 快捷键 ←→Space / ESC 在 'submitting' / 'submitted' 必须 no-op。
 */
export type ShenlunPhase = 'prestart' | 'running' | 'paused' | 'submitting' | 'submitted';

/** 允许的状态迁移表（source → set of allowed targets） */
const SHENLUN_TRANSITIONS: Readonly<Record<ShenlunPhase, ReadonlyArray<ShenlunPhase>>> = {
  prestart: ['running'],
  running: ['paused', 'submitting'],
  paused: ['running', 'submitting'],
  submitting: ['submitted', 'running'], // submitting → running 用于错误恢复
  submitted: [], // terminal
};

export function canTransition(from: ShenlunPhase, to: ShenlunPhase): boolean {
  return SHENLUN_TRANSITIONS[from].includes(to);
}

/**
 * 校验状态迁移；不允许时抛错（fail-fast）。
 * 调用方应当在 dispatch action 前用 can* helpers 检查，不要依赖本函数兜底。
 */
export function assertTransition(from: ShenlunPhase, to: ShenlunPhase): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid shenlun phase transition: ${from} → ${to}`);
  }
}

/** 是否能开始答题（仅 prestart） */
export function canStart(phase: ShenlunPhase): boolean {
  return phase === 'prestart';
}

/** 是否能暂停（仅 running） */
export function canPause(phase: ShenlunPhase): boolean {
  return phase === 'running';
}

/** 是否能恢复（仅 paused） */
export function canResume(phase: ShenlunPhase): boolean {
  return phase === 'paused';
}

/** 是否能切换暂停（running ↔ paused） */
export function canTogglePause(phase: ShenlunPhase): boolean {
  return phase === 'running' || phase === 'paused';
}

/** 是否能交卷（running 或 paused，不能在 prestart 之前交） */
export function canSubmit(phase: ShenlunPhase): boolean {
  return phase === 'running' || phase === 'paused';
}

/** 终态 —— UI 转只读 / 计时停止 / 快捷键全 no-op */
export function isTerminal(phase: ShenlunPhase): boolean {
  return phase === 'submitted';
}

/** 计时器是否应跑（仅 running） */
export function isTicking(phase: ShenlunPhase): boolean {
  return phase === 'running';
}

/** 快捷键是否应响应（submitting / submitted 全 no-op） */
export function acceptsShortcut(phase: ShenlunPhase): boolean {
  return phase !== 'submitting' && phase !== 'submitted';
}
