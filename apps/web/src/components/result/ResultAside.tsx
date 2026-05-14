import { Button } from '@sikao/ui/ui';
import type { PracticeSubjectSummaryV2, QuestionDetailV2 } from '@sikao/api-client/types/api';
import { formatElapsed, type QuestionTiming } from '@sikao/shared-utils';

// SIKAO Wave 2 Phase 2 — hifi 05 报告页右侧 320 col aside.
// 来源: design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 2948-2979 + tokens line 698-701, 1030-1036.
//
// 三块:
//   1. 答题卡缩略 (grid 5col, ok 绿/no 红, 点击展开 panel)
//   2. 用时分布 (per-subject 横向 list, 弱项标 accent 色)
//   3. CTA (看错题 primary + 导出 PDF secondary)
//
// 注意: 不重写 AnswerCardPanel (那个是详细 SidePanel 视图);
// 这里 aside 是缩略 grid (前 25 题 preview), 点击 "查看完整答题卡" 才打开
// AnswerCardPanel SidePanel.

const PREVIEW_CELL_LIMIT = 25;

export interface ResultAsideProps {
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly unansweredCount: number;
  readonly questionCount: number;
  readonly subjects: readonly PracticeSubjectSummaryV2[];
  readonly questions: readonly QuestionDetailV2[];
  readonly timings: readonly QuestionTiming[];
  readonly answerStateById: ReadonlyMap<string, 'correct' | 'wrong' | 'empty'>;
  readonly onOpenAnswerCard: () => void;
  readonly onViewWrong: () => void;
  readonly onExportPdf?: () => void;
  readonly exportPdfDisabledHint?: string;
  readonly viewWrongDisabled?: boolean;
}

interface SubjectTiming {
  readonly subject: string;
  readonly totalSec: number;
  readonly weak: boolean;
}

function buildSubjectTimings(
  questions: readonly QuestionDetailV2[],
  timings: readonly QuestionTiming[],
  subjects: readonly PracticeSubjectSummaryV2[],
): readonly SubjectTiming[] {
  if (subjects.length === 0) return [];
  // sectionId/subject 映射 — questions 携带 sectionId, subject 在
  // PracticeSubjectSummaryV2 上, 没有直接 join key. backend 当前不传
  // question.subject (canonicalSubject 在 BE 里但不暴露在 QuestionDetailV2).
  // 退而求其次: 用 sectionId 累计后再按 subject name 匹配 (大多行测真题
  // section 数 = subject 数 = 5, 名字一致).
  const subjectByQid = new Map<string, string>();
  for (const q of questions) {
    // QuestionDetailV2 当前不带 subject 字段, 只能按 sectionId 当作 subject
    // proxy. 行测真题 1 section ≈ 1 subject, 名字匹配靠 subject summary
    // title key.
    subjectByQid.set(String(q.questionId), q.sectionId);
  }
  // 把 sectionId 累计到 subject — 用 sectionTitle 跟 subject.subject 匹配.
  // 当前最简实现: 直接把 sectionId 当 subject key, 显示走 subject.subject.
  // 这是 BE 契约缺口, 在 mapper 内处理不改 BE.
  const secsBySid = new Map<string, number>();
  for (const t of timings) {
    if (t.paused) continue;
    const sid = subjectByQid.get(t.questionId);
    if (sid === undefined) continue;
    secsBySid.set(sid, (secsBySid.get(sid) ?? 0) + t.elapsedSec);
  }
  // 弱项: 准确率 < 60%
  const weakBySubject = new Set(
    subjects.filter((s) => s.accuracyRate < 60).map((s) => s.subject),
  );
  // 把 secsBySid 平摊到 subjects (按 subject 顺序, 有几个 subject 就取几个).
  // sectionId 顺序跟 subject 顺序在行测真题一致; 不一致时 fallback 到 0.
  const sectionIdsInOrder = Array.from(secsBySid.keys());
  return subjects.map((s, i) => {
    const sid = sectionIdsInOrder[i];
    const totalSec = sid !== undefined ? (secsBySid.get(sid) ?? 0) : 0;
    return {
      subject: s.subject,
      totalSec,
      weak: weakBySubject.has(s.subject),
    };
  });
}

interface AsideCardProps {
  readonly title: string;
  readonly headRight?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly testId: string;
}

function AsideCard({ title, headRight, children, testId }: AsideCardProps) {
  return (
    <div
      className="bg-paper border border-line"
      data-testid={testId}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h4
          className="font-serif"
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--ink-1)',
            margin: 0,
          }}
        >
          {title}
        </h4>
        {headRight}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

interface PreviewCellProps {
  readonly questionNo: number;
  readonly state: 'correct' | 'wrong' | 'empty';
}

function PreviewCell({ questionNo, state }: PreviewCellProps) {
  if (state === 'correct') {
    return (
      <div
        className="rounded-1 flex items-center justify-center font-mono tabular-nums"
        style={{
          backgroundColor: 'var(--ok-bg)',
          color: 'var(--ok)',
          fontSize: '12px',
          aspectRatio: '1',
        }}
        aria-label={`第 ${questionNo} 题 正确`}
      >
        {questionNo}
      </div>
    );
  }
  if (state === 'wrong') {
    return (
      <div
        className="rounded-1 flex items-center justify-center font-mono tabular-nums"
        style={{
          backgroundColor: 'var(--bad-bg)',
          color: 'var(--err)',
          fontSize: '12px',
          aspectRatio: '1',
        }}
        aria-label={`第 ${questionNo} 题 错误`}
      >
        {questionNo}
      </div>
    );
  }
  return (
    <div
      className="rounded-1 flex items-center justify-center font-mono tabular-nums"
      style={{
        backgroundColor: 'var(--paper-3)',
        color: 'var(--ink-3)',
        fontSize: '12px',
        aspectRatio: '1',
      }}
      aria-label={`第 ${questionNo} 题 未答`}
    >
      {questionNo}
    </div>
  );
}

interface AnswerPreviewProps {
  readonly questions: readonly QuestionDetailV2[];
  readonly answerStateById: ReadonlyMap<string, 'correct' | 'wrong' | 'empty'>;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly unansweredCount: number;
  readonly questionCount: number;
  readonly onOpenAnswerCard: () => void;
}

function AnswerPreview({
  questions,
  answerStateById,
  correctCount,
  incorrectCount,
  unansweredCount,
  questionCount,
  onOpenAnswerCard,
}: AnswerPreviewProps) {
  const preview = questions.slice(0, PREVIEW_CELL_LIMIT);
  const moreCount = questions.length - preview.length;
  return (
    <AsideCard
      title="答题卡"
      testId="result-aside-answer-card"
      headRight={
        <span
          className="font-mono"
          style={{
            fontSize: '11px',
            color: 'var(--ink-3)',
            letterSpacing: 'var(--tracking-loose)',
          }}
        >
          {questionCount} 题
        </span>
      }
    >
      <div className="grid grid-cols-5 gap-1">
        {preview.map((q) => (
          <PreviewCell
            key={String(q.questionId)}
            questionNo={q.questionNo}
            state={answerStateById.get(String(q.questionId)) ?? 'empty'}
          />
        ))}
      </div>
      {moreCount > 0 ? (
        <button
          type="button"
          onClick={onOpenAnswerCard}
          className="mt-3 w-full font-mono text-left transition-colors hover:opacity-70"
          style={{
            fontSize: '11px',
            color: 'var(--ink-3)',
            letterSpacing: 'var(--tracking-loose)',
          }}
          data-testid="result-aside-answer-card-more"
        >
          查看完整 {questions.length} 题 →
        </button>
      ) : null}
      <div
        className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono"
        style={{
          fontSize: '11px',
          color: 'var(--ink-3)',
        }}
      >
        <LegendItem
          color="var(--ok-bg)"
          label="对"
          value={correctCount}
        />
        <LegendItem
          color="var(--bad-bg)"
          label="错"
          value={incorrectCount}
        />
        {unansweredCount > 0 ? (
          <LegendItem
            color="var(--paper-3)"
            label="未答"
            value={unansweredCount}
          />
        ) : null}
      </div>
    </AsideCard>
  );
}

interface LegendItemProps {
  readonly color: string;
  readonly label: string;
  readonly value: number;
}

function LegendItem({ color, label, value }: LegendItemProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-block"
        style={{
          width: '10px',
          height: '10px',
          backgroundColor: color,
        }}
      />
      <span>{label} {value}</span>
    </span>
  );
}

interface TimingPanelProps {
  readonly subjectTimings: readonly SubjectTiming[];
}

function TimingPanel({ subjectTimings }: TimingPanelProps) {
  if (subjectTimings.length === 0) return null;
  return (
    <AsideCard title="用时分布" testId="result-aside-timing">
      <div
        className="font-mono"
        style={{
          fontSize: '13px',
          color: 'var(--ink-2)',
        }}
      >
        {subjectTimings.map((t, i) => (
          <div
            key={t.subject}
            className="flex justify-between py-2"
            style={{
              borderBottom:
                i < subjectTimings.length - 1 ? '1px solid var(--line-2)' : 'none',
              color: t.weak ? 'var(--accent-1)' : undefined,
            }}
            data-testid={`timing-row-${t.subject}`}
          >
            <span>{t.subject}</span>
            <span className="tabular-nums">
              {t.totalSec > 0 ? formatElapsed(t.totalSec) : '—'}
            </span>
          </div>
        ))}
      </div>
    </AsideCard>
  );
}

export function ResultAside(props: ResultAsideProps) {
  const subjectTimings = buildSubjectTimings(
    props.questions,
    props.timings,
    props.subjects,
  );
  return (
    <aside
      className="flex flex-col gap-5"
      data-testid="result-aside"
      style={{ width: '100%', maxWidth: '320px' }}
    >
      <AnswerPreview
        questions={props.questions}
        answerStateById={props.answerStateById}
        correctCount={props.correctCount}
        incorrectCount={props.incorrectCount}
        unansweredCount={props.unansweredCount}
        questionCount={props.questionCount}
        onOpenAnswerCard={props.onOpenAnswerCard}
      />
      <TimingPanel subjectTimings={subjectTimings} />
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          className="w-full justify-center"
          onClick={props.onViewWrong}
          disabled={props.viewWrongDisabled === true}
          data-testid="result-aside-view-wrong"
        >
          看 {props.incorrectCount} 道错题
        </Button>
        {props.onExportPdf !== undefined ? (
          // svg-only-allow: secondary text button disabled hint, Tooltip primitive 替换推后
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={props.onExportPdf}
            disabled={props.exportPdfDisabledHint !== undefined}
            data-testid="result-aside-export-pdf"
            title={props.exportPdfDisabledHint}
          >
            导出 PDF 报告
          </Button>
        ) : props.exportPdfDisabledHint !== undefined ? (
          // svg-only-allow: secondary text button disabled hint, Tooltip primitive 替换推后
          <Button
            variant="secondary"
            className="w-full justify-center"
            disabled
            data-testid="result-aside-export-pdf"
            title={props.exportPdfDisabledHint}
          >
            导出 PDF 报告
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
