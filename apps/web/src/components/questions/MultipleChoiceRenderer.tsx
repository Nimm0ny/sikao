import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { OptionRow } from '@sikao/ui/ui';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// v0.2 Phase 6.3b — Multiple-choice / 不定项 renderer.
//
// fenbi adapter 把 type=2（多选）+ type=3（不定项）都映射到
// rendererKey="multiple_choice" → 此组件. UI 行为：
//   - 点击 option → toggle 添加 / 移除该 key
//   - selectedAnswer 是排序后的 array（保证调用方 stable comparison）
//   - 题干 DOMPurify sanitize (HTML 富文本); option.text 是纯文本不需要
//   - (P1-1: 历史 OptionOutV2.rich_text 字段从未被 import 实际填充, 已删契约)
//
// 跟 SingleChoiceRenderer 的差别只在 onClick 行为 — 复用同一个 OptionRow
// primitive 保持视觉一致.

interface Props {
  readonly question: QuestionDetailV2;
  readonly selectedAnswer: readonly string[];
  readonly onAnswerChange: (val: string[]) => void;
}

const MultipleChoiceRenderer: React.FC<Props> = ({
  question,
  selectedAnswer,
  onAnswerChange,
}) => {
  const sanitizedStem = useMemo(
    () => ({ __html: DOMPurify.sanitize(question.content.stem || '') }),
    [question.content.stem],
  );
  const options = question.content.options ?? [];
  const selectedSet = useMemo(() => new Set(selectedAnswer), [selectedAnswer]);

  const handleToggle = (key: string): void => {
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Sort by option display order (the option list itself is canonically
    // ordered by display_order from backend) so callbacks see stable arrays.
    const orderedKeys = options.map((o) => o.key).filter((k) => next.has(k));
    onAnswerChange(orderedKeys);
  };

  return (
    <div className="mb-6" data-testid="multiple-choice-renderer">
      <div
        className="text-md font-medium text-ink leading-relaxed mb-2"
        dangerouslySetInnerHTML={sanitizedStem}
      />
      {/* hint 跟 design ResultC「不定项·多选」调性 — 提示用户可多选, 提交才结束.
          只显示, 不影响 logic; 单元测试不依赖. */}
      <div className="text-xs text-ink-3 mb-4" data-testid="multiple-choice-hint">
        多选题 · {PRACTICE_COPY.multipleChoiceHint}
      </div>
      <div>
        {options.map((opt, idx) => {
          const isSelected = selectedSet.has(opt.key);
          const last = idx === options.length - 1;
          return (
            <OptionRow
              key={opt.key}
              optionKey={opt.key}
              text={<span>{opt.text}</span>}
              selected={isSelected}
              last={last}
              onClick={() => handleToggle(opt.key)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default MultipleChoiceRenderer;
