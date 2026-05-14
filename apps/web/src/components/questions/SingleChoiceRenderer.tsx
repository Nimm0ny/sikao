import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { OptionRow } from '@sikao/ui/ui';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

// Phase 5.3c rewrite — 从 indigo 紫色老风格迁到 element editorial 风，
// 复用 Phase 5.2 的 OptionRow primitive（serif italic key + hairline 分隔）。
//
// DOMPurify sanitize 用于 stem (HTML 富文本); option.text 是纯文本不需要.
// (P1-1: 历史 OptionOutV2.rich_text 字段从未被 import 实际填充, 已删契约.)
// Dumb by contract: 不读 store，通过 onAnswerChange 抛给上游。

interface Props {
  readonly question: QuestionDetailV2;
  readonly selectedAnswer: readonly string[];
  readonly onAnswerChange: (val: string[]) => void;
}

const SingleChoiceRenderer: React.FC<Props> = ({
  question,
  selectedAnswer,
  onAnswerChange,
}) => {
  const sanitizedStem = useMemo(
    () => ({ __html: DOMPurify.sanitize(question.content.stem || '') }),
    [question.content.stem],
  );

  const options = question.content.options ?? [];

  return (
    <div className="mb-6">
      {/* element/ui_kits/mobile/index.html §149 —— 题干 16-17px sans medium /
          leading relaxed，不过粗。题号 meta 由 QuestionDispatcher 上游提供。 */}
      <div
        className="text-md font-medium text-ink leading-relaxed mb-5"
        dangerouslySetInnerHTML={sanitizedStem}
      />
      <div>
        {options.map((opt, idx) => {
          const isSelected = selectedAnswer.includes(opt.key);
          const last = idx === options.length - 1;
          return (
            <OptionRow
              key={opt.key}
              optionKey={opt.key}
              text={<span>{opt.text}</span>}
              selected={isSelected}
              last={last}
              onClick={() => onAnswerChange([opt.key])}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SingleChoiceRenderer;
