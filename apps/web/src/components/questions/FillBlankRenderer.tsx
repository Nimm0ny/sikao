import { useMemo, useState, type ChangeEvent } from 'react';
import DOMPurify from 'dompurify';
import { FormField } from '@sikao/ui/ui';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

// Phase 6.5 — Fill-in-the-blank / 数字填空 renderer.
//
// fenbi adapter 把 type=5 (填空 / 数字答案, options=0) 映射到
// rendererKey="fill_blank" → 此组件. UI 行为：
//   - 单一文本 input, 用户输入答案文本
//   - 提交时 onAnswerChange([userInputText])
//   - 跟单选 / 多选不同: answer_keys 是文本 (e.g. "100"), 不是 option key
//
// 判分由后端 normalize_answer_keys (trim + upper + sort) 后字符串相等.
// 数字 / 字母 / 简单表达式都 OK; 复杂场景 (容差 / 多正确答案 / 单位归一)
// 留 v0.3+ ticket.

interface Props {
  readonly question: QuestionDetailV2;
  readonly selectedAnswer: readonly string[];
  readonly onAnswerChange: (val: string[]) => void;
}

const FillBlankRenderer: React.FC<Props> = ({ question, selectedAnswer, onAnswerChange }) => {
  const sanitizedStem = useMemo(
    () => ({ __html: DOMPurify.sanitize(question.content.stem || '') }),
    [question.content.stem],
  );
  // Local input state synced from store. Use store value as source of truth
  // when navigating between questions; user typing updates local + debounced
  // upstream (debounce already wired in QuestionDispatcher 300ms).
  //
  // 用 React 19 推荐的 "adjusting state on a prop change" 模式：跟踪 prev
  // prop, 在 render 期间 setState (而不是 useEffect, 后者触发 lint
  // react-hooks/set-state-in-effect). 切题时 selectedAnswer 变化 → 立即同步
  // 本地 input.
  const initial = selectedAnswer[0] ?? '';
  const [prevInitial, setPrevInitial] = useState(initial);
  const [text, setText] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setText(initial);
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setText(value);
    // 空字符串视作未答（onAnswerChange([]) 让 store 把它从 answers 里移除）.
    onAnswerChange(value.trim() === '' ? [] : [value]);
  };

  return (
    <div className="mb-8" data-testid="fill-blank-renderer">
      <div
        className="text-lg font-medium text-ink leading-relaxed mb-2"
        dangerouslySetInnerHTML={sanitizedStem}
      />
      <div className="text-xs text-ink-3 mb-4" data-testid="fill-blank-hint">
        填空题 · 输入答案后提交
      </div>
      <FormField
        label="答案"
        type="text"
        value={text}
        onChange={handleChange}
        placeholder="在此输入答案"
        rootClassName="max-w-md"
        data-testid="fill-blank-input"
        autoComplete="off"
      />
    </div>
  );
};

export default FillBlankRenderer;
