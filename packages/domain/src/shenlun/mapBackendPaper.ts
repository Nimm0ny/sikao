import { logger } from '@sikao/shared-utils';
import type { Paper, Question, QuestionKind, Material } from '@sikao/domain/shenlun/types';

export interface BackendEssayQuestion {
  readonly id: number;
  readonly position: number;
  readonly rendererKey: string;
  readonly canonicalSubtype?: string | null;
  readonly stemText: string;
  readonly explanationText: string;
  readonly content?: {
    readonly stem?: string;
    readonly essayMetadata?: {
      readonly materialTexts?: readonly string[];
      readonly wordLimitMin?: number;
      readonly wordLimitMax?: number;
      readonly suggestedMinutes?: number;
      readonly fullScore?: number;
    };
  };
}

// fenbi_shenlun_to_standard.classify_question (apps/exam-api/.../fenbi_shenlun_to_standard.py:576)
// 产出 6 个值: 归纳概括 / 综合分析 / 提出对策 / 公文/应用文 / 大作文 / 其他.
// 老 importer (xingce / 历史数据) 写老命名 公文题 / 贯彻执行 / 文章写作, 兼容保留.
// 注: '其他' 是 backend 兜底 (待人工分类), 不进映射表 — 走 stem 嗅探 fallback +
// logger.warn 暴露给 ops, 防静默错分类 (subagent review P0).
const KIND_BY_CANONICAL_SUBTYPE: Readonly<Record<string, QuestionKind>> = {
  归纳概括: '概括',
  提出对策: '对策',
  综合分析: '分析',
  '公文/应用文': '应用文',
  公文题: '应用文',
  贯彻执行: '应用文',
  大作文: '作文',
  文章写作: '作文',
};

export function mapBackendEssayPaper(
  paperCode: string,
  questions: readonly BackendEssayQuestion[],
): Paper {
  const essayQuestions = questions
    .filter((question) => question.rendererKey === 'essay')
    .sort((a, b) => a.position - b.position);
  if (essayQuestions.length === 0) {
    throw new Error(`essay exam requires at least one essay question: ${paperCode}`);
  }
  const materials = buildMaterials(paperCode, essayQuestions);
  const materialIds = materials.map((material) => material.id);
  return {
    id: `paper-${paperCode}`,
    code: paperCode,
    name: essayQuestions[0]?.content?.stem ? `${paperCode} · 申论整卷` : paperCode,
    questions: essayQuestions.map((question, index) =>
      mapQuestion(question, index, materialIds),
    ),
    materials,
  };
}

function buildMaterials(
  paperCode: string,
  questions: readonly BackendEssayQuestion[],
): Material[] {
  const materialTexts = questions[0]?.content?.essayMetadata?.materialTexts;
  if (!Array.isArray(materialTexts) || materialTexts.length === 0) {
    throw new Error(`essay exam materialTexts missing: ${paperCode}`);
  }
  return materialTexts.map((body, index) => ({
    id: `m${index + 1}`,
    title: `资料${toChineseNumber(index + 1)}`,
    subtitle: firstLine(body),
    body,
  }));
}

function mapQuestion(
  question: BackendEssayQuestion,
  index: number,
  materialIds: readonly string[],
): Question {
  const metadata = question.content?.essayMetadata;
  const minWords = metadata?.wordLimitMin;
  const maxWords = metadata?.wordLimitMax;
  const suggestedMinutes = metadata?.suggestedMinutes;
  if (minWords === undefined && maxWords === undefined) {
    throw new Error(`essay question word limit missing: ${question.id}`);
  }
  // Per CLAUDE.md §4 fail-fast: 时长是逐题业务值, 不是 runtime knob — 后端
  // 缺字段必须报错, 不能静默 fallback 到 hardcode 表 (会让"位置漂移"或"题型
  // 改版"这种数据 bug 静默渲染错时长).
  if (suggestedMinutes === undefined) {
    throw new Error(`essay question suggestedMinutes missing: ${question.id}`);
  }
  return {
    no: `第${toChineseNumber(index + 1)}题`,
    kind: mapQuestionKind(question),
    title: plainText(question.content?.stem ?? question.stemText),
    body: plainText(question.content?.stem ?? question.stemText),
    minWords,
    maxWords,
    durationSec: suggestedMinutes * 60,
    requirements: buildRequirements(question.explanationText, metadata?.wordLimitMax),
    refMaterials: [...materialIds],
    backendId: question.id,
    fullScore: metadata?.fullScore,
  };
}

function buildRequirements(
  explanationText: string,
  wordLimitMax: number | undefined,
): string[] {
  const requirements = plainText(explanationText)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (wordLimitMax !== undefined) {
    return [...requirements, `不超过 ${wordLimitMax} 字`];
  }
  return requirements;
}

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function firstLine(text: string): string {
  return text.split(/\n+/)[0]?.trim() ?? '';
}

function toChineseNumber(value: number): string {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`unsupported essay index: ${value}`);
  }
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (value < 10) return digits[value];
  if (value === 10) return '十';
  if (value < 20) return `十${digits[value - 10]}`;
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${digits[tens]}十${ones === 0 ? '' : digits[ones]}`;
  }
  throw new Error(`unsupported essay index: ${value}`);
}

function mapQuestionKind(question: BackendEssayQuestion): QuestionKind {
  const canonicalSubtype = question.canonicalSubtype?.trim();
  if (canonicalSubtype && canonicalSubtype in KIND_BY_CANONICAL_SUBTYPE) {
    return KIND_BY_CANONICAL_SUBTYPE[canonicalSubtype];
  }
  // backend mark "其他" 表示分类失败 (待人工分类), 不静默映射成"概括".
  // 走 stem 嗅探兜底 + log warn 让 ops 在 manifest 看到此 paper 占比.
  if (canonicalSubtype === '其他') {
    logger.warn('essay.canonical_subtype.unclassified', {
      questionId: question.id,
      stemPreview: plainText(question.stemText).slice(0, 60),
    });
  }
  const stem = plainText(question.content?.stem ?? question.stemText);
  if (stem.includes('文章') || stem.includes('议论文') || stem.includes('自拟题目')) {
    return '作文';
  }
  if (
    stem.includes('简报') ||
    stem.includes('发言稿') ||
    stem.includes('倡议书') ||
    stem.includes('公开信') ||
    stem.includes('提纲')
  ) {
    return '应用文';
  }
  if (stem.includes('建议') || stem.includes('对策') || stem.includes('措施')) {
    return '对策';
  }
  if (stem.includes('分析') || stem.includes('理解') || stem.includes('看法')) {
    return '分析';
  }
  return '概括';
}
