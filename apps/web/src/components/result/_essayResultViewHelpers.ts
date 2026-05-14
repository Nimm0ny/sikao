// SIKAO Wave 4 — view-level helpers for EssayExamResults + EssayGradingResult
//
// 抽出原因 (§3.5 单文件 ≤500 行):
//   - EssayExamResults.tsx 751 行 → 必须拆
//   - EssayGradingResult.tsx 552 行 → 必须拆
//
// 跟 _essayResultHelpers.ts 区分:
//   - _essayResultHelpers.ts  → 跨多个 view 复用的 design-system primitive
//                               (RubricTone classification / mark split /
//                               QuestionBreakdownItem 类型)
//   - _essayResultViewHelpers.ts (本文件) → 两 view 私有 helpers (headline
//                                          / subtitle / aside card builder /
//                                          time formatter / record item builder).
//                                          不跨子域复用.

import type { EssayFeedbackV2, EssayGradingV2 } from '@sikao/api-client/types/api';
import type { WeightedTotal } from '@sikao/answer-engine/scoring/shenlun';
import type { QuestionBreakdownItem } from '@/components/result';
import { ESSAY_GRADING_COPY } from '@/lib/ui-copy';

// ---------- 共享 headline (跟分数段绑定, 两 view 都用) ----------
// Exam view + Grading view 历史上两份不同 copy ("维度" vs "题"). 合并为
// 共享版本走 Exam 措辞 ("题"), Grading 单 record 用同 copy 不冲突.
export function pickResultHeadline(score: number): string {
  if (score >= 90) return '高分段, 把节奏稳住就好.';
  if (score >= 80) return '稳定段中游, 找一个掉链子的题补上去.';
  if (score >= 70) return '已过及格线, 距高分还差一两道题.';
  if (score >= 60) return '基础在, 优先复盘弱项题.';
  return '先稳住基础题节奏, 别陷在难题里.';
}

// ---------- Exam view (整卷模考) ----------

export function buildExamSubtitle(
  weighted: WeightedTotal,
  submittedCount: number,
  total: number,
): string {
  const parts: string[] = [];
  parts.push(`本卷 ${total} 题, ${submittedCount} 题进入批改, ${weighted.scored} 题已评`);
  if (weighted.value !== null) {
    parts.push(`整卷加权 ${weighted.value.toFixed(1)} / 100`);
  }
  return parts.join('. ') + '. 下一步看右栏建议.';
}

export function buildExamItem(
  id: number | null,
  idx: number,
  record: EssayGradingV2 | undefined,
  fullScoreByQuestionId: ReadonlyMap<number, number>,
): QuestionBreakdownItem | null {
  if (id === null) return null;
  if (record === undefined) {
    // pending / loading — 渲染 placeholder qrow (5 维度全 0, 不染 weak 色).
    return {
      qnumLabel: `Q${idx + 1}`,
      qkindLabel: '批改中',
      qttl: '正在批改, 数据待返回...',
      rubrics: [],
      comment: '',
      score: 0,
      maxScore: 100,
      testIdSuffix: `slot-${idx}`,
    };
  }
  if (record.status !== 'completed' || record.feedback === null) {
    return {
      qnumLabel: `Q${idx + 1}`,
      qkindLabel:
        record.status === 'failed' ? '批改失败' : '批改中',
      qttl: record.status === 'failed' ? '请在下方卡片重新提交' : '正在批改...',
      rubrics: [],
      comment: '',
      score: 0,
      maxScore: 100,
      testIdSuffix: String(record.id),
    };
  }
  const feedback = record.feedback;
  const fullScore = fullScoreByQuestionId.get(record.questionId) ?? 100;
  // record.score 是 0-100 百分制, qrow 想显示按 fullScore 折算的分数.
  const earned = Math.round((record.score ?? 0) / 100 * fullScore * 10) / 10;
  return {
    qnumLabel: `Q${idx + 1}`,
    qkindLabel: '申论批改',
    qttl: feedback.weaknesses[0] ?? feedback.suggestions[0] ?? '5 维度评分明细',
    rubrics: feedback.dimensions.map((d) => ({
      label: d.name,
      score: d.score,
      max: d.weight * 10,
    })),
    comment: feedback.weaknesses[0] ?? feedback.suggestions[0] ?? '',
    score: earned,
    maxScore: fullScore,
    testIdSuffix: String(record.id),
  };
}

export function formatRecordSummary(
  id: number | null,
  record: EssayGradingV2 | undefined,
  fullScore: number | undefined,
): string {
  if (id === null) return '未提交';
  if (record === undefined) return '加载中';
  if (record.status === 'pending') return '批改中';
  if (record.status === 'failed') return '失败';
  if (record.feedback === null) return '数据缺';
  const fs = fullScore ?? 100;
  const earned = Math.round((record.score ?? 0) / 100 * fs * 10) / 10;
  return `${earned} / ${fs}`;
}

// ---------- Grading view (单 record) ----------

export function buildGradingLbl(record: EssayGradingV2): string {
  const parts: string[] = ['SCORE · 申论'];
  if (record.gradedAt !== null) {
    const t = Date.parse(record.gradedAt);
    if (Number.isFinite(t)) {
      const d = new Date(t);
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      parts.push(`${mo}-${day} ${h}:${mi}`);
    }
  }
  return parts.join(' · ');
}

export function buildGradingSubtitle(feedback: EssayFeedbackV2): string {
  const dims = feedback.dimensions;
  if (dims.length === 0) return '继续练.';
  // 找最弱 / 最强维度 (按 score / weight*10 ratio).
  const ranked = [...dims]
    .map((d) => ({
      d,
      ratio: d.weight > 0 ? d.score / (d.weight * 10) : 0,
    }))
    .sort((a, b) => a.ratio - b.ratio);
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];
  if (weakest === undefined || strongest === undefined) return '继续练.';
  if (weakest.d.name === strongest.d.name) {
    return `${weakest.d.name} ${(weakest.d.score).toFixed(1)} / 10. 继续练.`;
  }
  return `${strongest.d.name}维度站住了, 弱项在 ${weakest.d.name} (${weakest.d.score.toFixed(1)} / 10). 下一步看右栏建议.`;
}

export function buildSingleRecordItem(
  record: EssayGradingV2,
  feedback: EssayFeedbackV2,
): QuestionBreakdownItem {
  // 5 维度作为 rubric. 维度 score 0-10, max=weight*10 (跟 EssayGradingCard 一致).
  const rubrics = feedback.dimensions.map((d) => ({
    label: d.name,
    score: d.score,
    max: d.weight * 10,
  }));
  // qcom: 用第一条 weakness (没就 first suggestion / first strength).
  const comment =
    feedback.weaknesses[0] ??
    feedback.suggestions[0] ??
    feedback.strengths[0] ??
    '';
  return {
    qnumLabel: 'A',
    qkindLabel: '综合评分',
    qttl: '5 维度评分明细',
    rubrics,
    comment,
    score: feedback.overallScore,
    maxScore: 100,
    testIdSuffix: String(record.id),
  };
}

export function pickThinkTitle(feedback: EssayFeedbackV2): string {
  if (feedback.suggestions.length > 0) {
    return feedback.suggestions[0];
  }
  if (feedback.strengths.length > 0) {
    return feedback.strengths[0];
  }
  return '继续练.';
}

export function buildThinkParagraphs(feedback: EssayFeedbackV2): readonly string[] {
  const paragraphs: string[] = [];
  if (feedback.strengths.length > 0) {
    paragraphs.push(`优点: ${feedback.strengths.join(' · ')}`);
  }
  if (feedback.weaknesses.length > 0) {
    paragraphs.push(`问题: ${feedback.weaknesses.join(' · ')}`);
  }
  if (feedback.suggestions.length > 1) {
    paragraphs.push(`建议: ${feedback.suggestions.slice(1).join(' · ')}`);
  }
  if (paragraphs.length === 0) {
    paragraphs.push('继续练.');
  }
  return paragraphs;
}

export function formatGradingDelay(createdAt: string, gradedAt: string): string {
  const start = Date.parse(createdAt);
  const end = Date.parse(gradedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return '—';
  }
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} m ${s} s`;
}

// ---------- Aside cards builders ----------
// 返回 ReactNode body 走子组件渲染. 这里只接受 props 配置, JSX 子节点
// (StatRow) 由 view 自己组装传入. 避免 helper 文件引入 JSX 让 .ts 退化 .tsx.

export interface ExamAsideRowConfig {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'default' | 'warn';
  readonly last?: boolean;
  readonly testId: string;
}

export interface ExamAsideStatusRow {
  readonly label: string;
  readonly value: string;
  readonly tone: 'default' | 'warn';
  readonly testId: string;
  readonly last: boolean;
}

export function buildExamOverviewRows(
  weighted: WeightedTotal,
  submittedCount: number,
  total: number,
): readonly ExamAsideRowConfig[] {
  return [
    {
      label: '加权得分',
      value:
        weighted.value !== null
          ? `${weighted.value.toFixed(1)} / 100`
          : '—',
      tone: weighted.value === null ? 'warn' : 'default',
      testId: 'essay-exam-aside-weighted',
    },
    {
      label: '已评 / 已交',
      value: `${weighted.scored} / ${submittedCount}`,
      testId: 'essay-exam-aside-progress',
    },
    {
      label: '本卷题数',
      value: `${total}`,
      testId: 'essay-exam-aside-total',
    },
    {
      label: '未提交',
      value: `${total - submittedCount}`,
      tone: total > submittedCount ? 'warn' : 'default',
      last: true,
      testId: 'essay-exam-aside-missing',
    },
  ];
}

export function buildExamStatusRows(
  recordIds: ReadonlyArray<number | null>,
  queries: readonly { readonly data: EssayGradingV2 | undefined }[],
  fullScoreByQuestionId: ReadonlyMap<number, number>,
): readonly ExamAsideStatusRow[] {
  return recordIds.map((id, idx) => {
    const record = id !== null ? queries[idx]?.data : undefined;
    const fullScore =
      record !== undefined ? fullScoreByQuestionId.get(record.questionId) : undefined;
    return {
      label: `Q${idx + 1}`,
      value: formatRecordSummary(id, record, fullScore),
      tone:
        id === null || (record !== undefined && record.status === 'failed')
          ? 'warn'
          : 'default',
      last: idx === recordIds.length - 1,
      testId: `essay-exam-aside-row-${idx}`,
    };
  });
}

export interface GradingOverviewRow {
  readonly kind: 'overall' | 'chars' | 'delay' | 'status';
  readonly label: string;
  readonly value: string;
  readonly testId: string;
  readonly last: boolean;
}

export function buildGradingOverviewRows(
  record: EssayGradingV2,
  feedback: EssayFeedbackV2,
  charCount: number,
): readonly GradingOverviewRow[] {
  const rows: GradingOverviewRow[] = [
    {
      kind: 'overall',
      label: '总分',
      value: `${feedback.overallScore.toFixed(1)} / 100`,
      testId: 'essay-aside-overall',
      last: false,
    },
    {
      kind: 'chars',
      label: '字数',
      value: `${charCount} 字`,
      testId: 'essay-aside-chars',
      last: false,
    },
  ];
  if (record.gradedAt !== null && record.createdAt !== '') {
    rows.push({
      kind: 'delay',
      label: '批改时延',
      value: formatGradingDelay(record.createdAt, record.gradedAt),
      testId: 'essay-aside-delay',
      last: true,
    });
  } else {
    rows.push({
      kind: 'status',
      label: '状态',
      value: '已完成',
      testId: 'essay-aside-status',
      last: true,
    });
  }
  return rows;
}

export interface GradingDimensionRow {
  readonly label: string;
  readonly value: string;
  readonly tone: 'default' | 'warn';
  readonly last: boolean;
  readonly testId: string;
}

export function buildGradingDimensionRows(
  feedback: EssayFeedbackV2,
): readonly GradingDimensionRow[] {
  return feedback.dimensions.map((d, i) => {
    const isLast = i === feedback.dimensions.length - 1;
    const max = d.weight * 10;
    const isWarn = max > 0 && d.score / max < 0.6;
    return {
      label: d.name,
      value: `${d.score.toFixed(1)} / ${max.toFixed(0)}`,
      tone: isWarn ? 'warn' : 'default',
      last: isLast,
      testId: `essay-aside-dim-${i}`,
    };
  });
}

// ---------- ExamHeroBlock pending eyebrow / lbl builder ----------
// pending 占位也走相同 builder, 避免在 view 内 inline 拼字符串.
export function buildExamEyebrow(paperCode: string | undefined): string {
  return paperCode !== undefined ? `Report · 申论 · ${paperCode}` : 'Report · 申论';
}

export function buildExamLbl(scored: number, submittedCount: number): string {
  return `SCORE · 申论 · ${ESSAY_GRADING_COPY.examResultsProgressFmt(scored, submittedCount)}`;
}
