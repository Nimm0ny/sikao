// Essay exam v2 — domain types (mock-friendly, will mirror backend Paper schema later).
//
// R2.4 (2026-05-13): 把 sikaoTypes 的 ESSAY_CLIP_MIME / EssayClipDragPayload 等
// re-export 出来，让 `from '@sikao/domain/shenlun/types'` 一站式拿全。

export type QuestionKind = '概括' | '对策' | '分析' | '应用文' | '作文';

import type {
  Citation,
  ScratchClip,
  ScratchNote,
} from '@sikao/domain/shenlun/sikaoTypes';

export type {
  Citation,
  ScratchClip,
  ScratchNote,
  EssayClipDragPayload,
} from '@sikao/domain/shenlun/sikaoTypes';
export { ESSAY_CLIP_MIME } from '@sikao/domain/shenlun/sikaoTypes';

export interface Question {
  no: string;
  kind: QuestionKind;
  title: string;
  body: string;
  minWords?: number;
  maxWords?: number;
  durationSec: number;
  requirements: string[];
  refMaterials: string[];
  // 后端 questions.id (numeric). 整卷交卷时 EssayClient.submit 用它作 grade
  // POST 的 questionId. mock paper 用占位 (1001+ 区间) 避免和真实 id 撞.
  backendId: number;
  // 后端 essayMetadata.fullScore. 整卷成绩单按 fullScore 加权 (review P0 #8):
  // Σ(score_i / 100 * fullScore_i) / Σ(fullScore_i) * 100. 缺失时计算返 null.
  fullScore?: number;
}

export interface Material {
  id: string;
  title: string;
  subtitle: string;
  body: string;
}

export interface Paper {
  id: string;
  code: string;
  name: string;
  questions: Question[];
  materials: Material[];
}

export interface Highlight {
  start: number;
  end: number;
  _justAdded?: number;
}

// 'submitting' (PR3) — 用户点交卷后, EssayClient.submit Promise.allSettled 在
// 跑. tick 已天然在 phase != running 时停倒计时 (useExamSession.ts), 不需改.
// togglePause / 快捷键 ⌘Space / ESC 在 'submitting' / 'submitted' 必须 no-op.
export type Phase = 'prestart' | 'running' | 'paused' | 'submitting' | 'submitted';

export type LeftMode = 'collapsed' | 'normal' | 'wide';

export interface AnswerSession {
  paperId: string;
  startedAt: number;
  phase: Phase;
  currentQ: number;
  textsByQ: string[];
  elapsedByQ: number[];
  highlights: Record<string, Highlight[]>;
  scratch: string;
  scratchClips?: ScratchClip[];
  scratchNotes?: ScratchNote[];
  citationsByQ?: Citation[][];
  savedAt: number;
}

export interface SubmitResult {
  // 长度 = paper.questions.length, 跟题号对齐 (review P0 #9 修订).
  //   - fulfilled 题: 对应位置存 record.id (number)
  //   - rejected 题 / 空答案题 / 未提交: 对应位置 null
  // 用于 navigate /essay/exam/results?ids=<csv>, csv 序列化时 null → 空段
  // (e.g. "1,2,,4,5" 表示第 3 题缺 record). results view 解析时 split(',')
  // 拿空字符串再 trim → 空, 视为 null. 这样 PositionLabel "第 N 题" 永远
  // 跟 paper.questions 顺序一致, 不因空答案紧凑漂移题号.
  //
  // 全 null (全 reject + 空答案) 不返 — EssayClient.submit 直接 throw.
  recordIds: ReadonlyArray<number | null>;
}
