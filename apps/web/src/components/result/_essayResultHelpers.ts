// SIKAO Wave 2 Phase 3 — 申论结果 view 共享 helpers (Fixer D).
//
// 来源 hifi 05b: design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 2984-3189. 5 维度评分行的 ok / err / weak 颜色判定 + mark 高亮 split
// 都收口此文件, view 只调 helper, 不直接判 magic number.

import type { ReactNode } from 'react';

// R2.1 (2026-05-13): rubric tone + weak threshold 算法已抽到
// @sikao/answer-engine/scoring/shenlun (ADR-0002). 本文件 re-export 保持 backward
// compat. 新代码请直接从 @sikao/answer-engine/scoring/shenlun 引入.
export {
  ESSAY_WEAK_THRESHOLD,
  classifyRubricTone,
  isWeakQuestion,
  type RubricTone,
} from '@sikao/answer-engine/scoring/shenlun';

// 进度 bar 填充宽度 (0-100 %).
export function computeBarWidth(score: number, max: number): number {
  if (max <= 0) return 0;
  const pct = (score / max) * 100;
  return Math.max(0, Math.min(100, pct));
}

// ---------- mark 高亮 split helper ----------
// hifi 中 .qcom mark / .think p mark 高亮关键词 (背景 var(--accent-50) +
// 下划线 var(--accent-1)). 数据流: backend feedback 返 plain text;
// 前端没有 markdown 标记体系 (X 不 dangerouslySetInnerHTML 防 XSS).
//
// 简单约定: caller 传 plain text + 可选 highlights array (子串列表).
// helper 用首次匹配 split, 命中片段包 <mark>; 未命中则原样输出. 不重叠
// 不正则 — caller 自己保证 highlights 干净, 防 ReDoS.
//
// 用例: <p>{renderMarkHighlights('xxx M3 数据', ['M3 数据'])}</p>
//   → ['xxx ', <mark>M3 数据</mark>]

export interface RenderMarkOptions {
  readonly text: string;
  readonly highlights?: readonly string[];
  readonly markClassName?: string;
  readonly markStyle?: React.CSSProperties;
}

export function splitTextWithHighlights(
  text: string,
  highlights: readonly string[],
): readonly { readonly chunk: string; readonly isMark: boolean }[] {
  if (highlights.length === 0 || text === '') {
    return [{ chunk: text, isMark: false }];
  }
  // 简单 segmentation: 找出所有 highlight 的起止区间, 按 start asc 排序,
  // 不重叠 (后面的 hit 起点 < 前面 hit 结束 → 跳过), 拼接 plain / mark 段.
  const hits: { start: number; end: number }[] = [];
  for (const h of highlights) {
    if (h === '') continue;
    let from = 0;
    let idx = text.indexOf(h, from);
    while (idx !== -1) {
      hits.push({ start: idx, end: idx + h.length });
      from = idx + h.length;
      idx = text.indexOf(h, from);
    }
  }
  if (hits.length === 0) return [{ chunk: text, isMark: false }];
  // sort + dedupe overlap (keep first by start)
  hits.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last !== undefined && h.start < last.end) continue;
    merged.push(h);
  }
  const out: { chunk: string; isMark: boolean }[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (cursor < m.start) {
      out.push({ chunk: text.slice(cursor, m.start), isMark: false });
    }
    out.push({ chunk: text.slice(m.start, m.end), isMark: true });
    cursor = m.end;
  }
  if (cursor < text.length) {
    out.push({ chunk: text.slice(cursor), isMark: false });
  }
  return out;
}

// 5 维度 → rubric 单条 viewmodel.
// caller 把 EssayDimensionV2 (name / weight / score / comment) 喂给我们.
export interface RubricItem {
  readonly label: string;
  readonly score: number;
  readonly max: number;
  // 可选: weight 显示 (e.g. "权重 30%"); essay-result 模式下不显示
  readonly weightLabel?: string;
}

export interface QuestionBreakdownItem {
  // 题号 (Q1 / Q2 / Q3 / Q4 …)
  readonly qnumLabel: string;
  // 题种 (中文, e.g. "归纳概括" / "提出对策" / "综合分析" / "大作文 · 议论")
  // hifi italic 在 spec 是 italic, 但 CJK 禁 italic (CLAUDE.md §4) — 实施
  // 时改 normal (font-serif 不带 italic).
  readonly qkindLabel: string;
  // 题目标题 (qttl)
  readonly qttl: string;
  // 5 维度 → 5 条 rubric
  readonly rubrics: readonly RubricItem[];
  // 综合评论 (qcom). plain text, mark 高亮通过 highlights 数组指定.
  readonly comment: string;
  // mark 高亮关键词 (可选)
  readonly commentHighlights?: readonly string[];
  // 总分 + 满分 (右列大字 32px serif)
  readonly score: number;
  readonly maxScore: number;
  // delta vs 上次 (e.g. +2 / -1 / 0). null 不渲染.
  readonly deltaLabel?: string;
  // delta 颜色 (up=green / down=red / neutral=ink-3)
  readonly deltaTone?: 'up' | 'down' | 'neutral';
  // testid 后缀 (e.g. record id)
  readonly testIdSuffix: string;
  // 行尾 ReactNode slot (e.g. "重新提交" 按钮 — failed retry). 可选.
  readonly tailSlot?: ReactNode;
}
