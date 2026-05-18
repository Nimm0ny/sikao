import { type ReactNode, useEffect, useRef, useState } from 'react';

// Marketing V1 Preview — 4 题型 tab (言语 / 数量 / 判推 / 资料) + 解析打字机.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-preview.
//
// 切换 tab → 当前 pane 的解析答案逐字打出 (plain text, 22ms/char),
// 打完 swap 到 JSX 带 <mark> 高亮版， 然后底部 meta 行 fade in (320ms).

type PaneKey = 'yan' | 'shu' | 'pan' | 'zi';

interface Option {
  letter: 'A' | 'B' | 'C' | 'D';
  text: string;
  correct?: boolean;
}

interface Pane {
  key: PaneKey;
  tabLabel: string;
  urlText: string;
  questionMeta: string;
  stem: string;
  options: Option[];
  userMsg: ReactNode;
  answerPlain: string;
  answerRich: ReactNode;
  metaText: string;
}

const PANES: Pane[] = [
  {
    key: 'yan',
    tabLabel: '言语理解',
    urlText: '言语理解 · 真题示例',
    questionMeta: '言语理解 · 选词填空',
    stem: '在改革推进过程中，要 ___，逐步深入，不能急于求成。',
    options: [
      { letter: 'A', text: '一蹴而就' },
      { letter: 'B', text: '按部就班' },
      { letter: 'C', text: '循序渐进', correct: true },
      { letter: 'D', text: '因循守旧' },
    ],
    userMsg: 'B「按部就班」和 C「循序渐进」都有「按步骤」的意思，差别在哪？为什么答案是 C 不是 B?',
    answerPlain:
      '关键差别在「主动性」。「循序渐进」强调有计划地向前推进，带有积极动作；「按部就班」偏中性甚至略带消极，指按既定步骤、不变通。原文在讲「改革推进」的主动性，所以 C 更贴合。',
    answerRich: (
      <>
        关键差别在「主动性」。「<mark className="bg-warn-bg rounded px-1">循序渐进</mark>」强调有计划地向前推进，带有积极动作；「按部就班」偏中性甚至略带消极，指按既定步骤、不变通。原文在讲「改革推进」的主动性，所以 C 更贴合。
      </>
    ),
    metaText: '「近义成语辨析」高频考点，近 5 年出现 11 次。',
  },
  {
    key: 'shu',
    tabLabel: '数量关系',
    urlText: '数量关系 · 真题示例',
    questionMeta: '数量关系 · 工程问题',
    stem: '甲队单独修需 12 天，乙队单独修需 18 天。两队合作 4 天后，甲队撤走，乙队继续修完剩余部分。乙队还需修多少天？',
    options: [
      { letter: 'A', text: '6 天' },
      { letter: 'B', text: '7 天' },
      { letter: 'C', text: '8 天', correct: true },
      { letter: 'D', text: '8.5 天' },
    ],
    userMsg: '我列方程算出 8 天，选了 C。但 D 也是 8 多一点，担心算错。是不是有什么细节漏掉了？',
    answerPlain:
      '合作 4 天的工作量 = 4 × (1/12 + 1/18) = 5/9。剩余 4/9 由乙队独力完成，需 4/9 ÷ 1/18 = 8 天。你算对了 —— 选 C。',
    answerRich: (
      <>
        合作 4 天的工作量 = 4 × (1/12 + 1/18) = <mark className="bg-warn-bg rounded px-1">5/9</mark>。剩余 4/9 由乙队独力完成，需 4/9 ÷ 1/18 = <mark className="bg-warn-bg rounded px-1">8 天</mark>。你算对了 —— 选 C。
      </>
    ),
    metaText: '「分数工程题」5 年内出现 14 次。D 是常见陷阱：没把合作工作量化简到位，得出 7.x 或 8.5。',
  },
  {
    key: 'pan',
    tabLabel: '判断推理',
    urlText: '判断推理 · 真题示例',
    questionMeta: '判断推理 · 直言命题',
    stem: '已知：所有会计都精通税法。小李精通税法。小张是会计。下列哪项必然为真？',
    options: [
      { letter: 'A', text: '小李是会计' },
      { letter: 'B', text: '小张精通税法', correct: true },
      { letter: 'C', text: '小李精通税法且是会计' },
      { letter: 'D', text: '小张精通税法但不是会计' },
    ],
    userMsg: '我选了 A，觉得「精通税法」可以反推「是会计」。但答案是 B，为什么 A 错？',
    answerPlain:
      '关键是「充分条件 vs 必要条件」。「所有会计 → 精通税法」是单向的，反向不必然成立。\n· 小李精通税法 → 不能反推他是会计(他可能是律师)\n· 小张是会计 → 必然精通税法，所以 B 对',
    answerRich: (
      <>
        关键是「<mark className="bg-warn-bg rounded px-1">充分条件 vs 必要条件</mark>」。「所有会计 → 精通税法」是单向的，反向不必然成立。
        <br />· 小李精通税法 → 不能反推他是会计(他可能是律师)
        <br />· 小张是会计 → 必然精通税法，<mark className="bg-warn-bg rounded px-1">所以 B 对</mark>
      </>
    ),
    metaText: '「直言命题反向推理」是判断推理高频陷阱。',
  },
  {
    key: 'zi',
    tabLabel: '资料分析',
    urlText: '资料分析 · 真题示例',
    questionMeta: '资料分析 · 基期值还原',
    stem: '材料：2024 年某省 GDP 为 8.4 万亿元，同比增长 5.6%。问 2023 年该省 GDP 约为多少？',
    options: [
      { letter: 'A', text: '7.85 万亿' },
      { letter: 'B', text: '7.93 万亿' },
      { letter: 'C', text: '7.95 万亿', correct: true },
      { letter: 'D', text: '8.05 万亿' },
    ],
    userMsg: '我用 8.4 × (1 - 5.6%) ≈ 7.93，选了 B。但答案是 C 7.95，差在哪？',
    answerPlain:
      '公式错了。正确是 基期值 = 现期值 ÷ (1 + 增长率) = 8.4 ÷ 1.056 ≈ 7.95。\n增长率不能简单减回去 —— B 就是这种「减法陷阱」算出的。',
    answerRich: (
      <>
        公式错了。正确是 <mark className="bg-warn-bg rounded px-1">基期值 = 现期值 ÷ (1 + 增长率)</mark> = 8.4 ÷ 1.056 ≈ <mark className="bg-warn-bg rounded px-1">7.95</mark>。
        <br />增长率不能简单减回去 —— B 就是这种「减法陷阱」算出的。
      </>
    ),
    metaText: '「基期值还原」是资料分析中频率最高的题型，占比 28%。',
  },
];

const TYPING_SPEED_MS = 22;
const TYPING_INITIAL_DELAY_MS = 240;
const META_REVEAL_DELAY_MS = 80;

export function MarketingPreview() {
  const [activeKey, setActiveKey] = useState<PaneKey>('yan');
  const [typedChars, setTypedChars] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'complete'>('typing');
  const [metaRevealed, setMetaRevealed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const active = PANES.find((p) => p.key === activeKey)!;

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const plain = active.answerPlain;
    let cancelled = false;
    let i = 0;

    const start = (): void => {
      if (cancelled) return;
      setTypedChars(0);
      setPhase('typing');
      setMetaRevealed(false);

      const tick = (): void => {
        if (cancelled) return;
        if (i >= plain.length) {
          setPhase('complete');
          timerRef.current = window.setTimeout(() => {
            if (!cancelled) setMetaRevealed(true);
          }, META_REVEAL_DELAY_MS);
          return;
        }
        i = Math.min(i + 1, plain.length);
        setTypedChars(i);
        timerRef.current = window.setTimeout(tick, TYPING_SPEED_MS);
      };
      timerRef.current = window.setTimeout(tick, TYPING_INITIAL_DELAY_MS);
    };

    // 推到 next tick, 避免 react-hooks/set-state-in-effect (synchronous setState in effect body)
    const startId = window.setTimeout(start, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startId);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active.answerPlain]);

  return (
    <div
      id="preview-section"
      className="max-w-[1440px] mx-auto px-8 mt-16"
    >
      <style>{`
        @keyframes pvCursorBlink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes pvFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .pv-cursor { display: inline-block; color: var(--accent-1); margin-left: 2px; animation: pvCursorBlink 700ms steps(1) infinite; }
        .pv-pane-active { animation: pvFadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1) both; }
      `}</style>

      <div className="bg-surface-alt border border-line rounded-card-lg overflow-hidden shadow-[0_50px_120px_-30px_rgb(15_23_42/.35),0_8px_24px_-8px_rgb(15_23_42/.12)]">
        {/* mac OS traffic light tabbar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-line">
          <span className="w-3 h-3 rounded-pill" style={{ background: '#ff5f57' }} />
          <span className="w-3 h-3 rounded-pill" style={{ background: '#ffbd2e' }} />
          <span className="w-3 h-3 rounded-pill" style={{ background: '#28c840' }} />
          <span className="flex-1 text-center text-xs text-ink-3 font-mono">
            sikao.ai / 练习 / {active.urlText}
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-4 pt-3 bg-surface border-b border-line overflow-x-auto" role="tablist">
          {PANES.map((pane) => {
            const on = pane.key === activeKey;
            return (
              <button
                key={pane.key}
                role="tab"
                id={`pv-tab-${pane.key}`}
                aria-selected={on}
                aria-controls={`pv-panel-${pane.key}`}
                tabIndex={on ? 0 : -1}
                data-testid={`marketing-preview-tab-${pane.key}`}
                onClick={() => setActiveKey(pane.key)}
                className={[
                  'px-4 py-3 text-sm font-semibold whitespace-nowrap',
                  '-mb-px border-b-2 transition-colors duration-fast ease-motion',
                  on ? 'text-accent border-accent' : 'text-ink-3 border-transparent hover:text-accent',
                ].join(' ')}
              >
                {pane.tabLabel}
              </button>
            );
          })}
        </div>

        {/* Active pane */}
        <div
          className="pv-pane-active"
          key={active.key}
          role="tabpanel"
          id={`pv-panel-${active.key}`}
          aria-labelledby={`pv-tab-${active.key}`}
        >
          {/* Question card */}
          <div className="px-8 py-6 border-b border-line bg-surface">
            <div className="text-xs text-ink-3 mb-3">{active.questionMeta}</div>
            <div className="text-md text-ink leading-relaxed mb-4">{active.stem}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {active.options.map((opt) => {
                const correctClass = opt.correct
                  ? 'border-ok-bg bg-ok-bg text-ok font-semibold'
                  : 'border-line bg-surface text-ink-3';
                const letterClass = opt.correct
                  ? 'bg-ok text-white'
                  : 'bg-surface-alt text-ink-3';
                return (
                  <span
                    key={opt.letter}
                    className={`inline-flex items-center gap-3 px-3 py-2 border rounded-tiny text-sm ${correctClass}`}
                  >
                    <b
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-tiny font-mono text-xs font-semibold flex-shrink-0 ${letterClass}`}
                    >
                      {opt.letter}
                    </b>
                    {opt.text}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Body: user + answer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-7 bg-surface-alt">
            {/* User msg */}
            <div className="bg-paper-2 border border-paper-3 rounded-card p-5 text-md leading-relaxed">
              <div className="flex items-center gap-3 mb-4 text-md font-bold text-ink-1">
                <span className="w-2 h-2 rounded-pill bg-ink-3 flex-shrink-0" />
                你
              </div>
              {active.userMsg}
            </div>

            {/* Answer msg with typing animation */}
            <div className="bg-surface border border-line rounded-card p-5 text-md leading-relaxed">
              <div className="flex items-center gap-3 mb-4 text-md font-bold text-accent">
                <span className="w-2 h-2 rounded-pill bg-accent flex-shrink-0" />
                思考解析
              </div>
              <div>
                {phase === 'typing' ? (
                  <>
                    {active.answerPlain.slice(0, typedChars)}
                    <span className="pv-cursor">▍</span>
                  </>
                ) : (
                  active.answerRich
                )}
              </div>
              <span
                className="block mt-3 pt-3 text-sm text-ink-3 border-t border-dashed border-line transition-opacity duration-slow ease-motion"
                style={{ opacity: metaRevealed ? 1 : 0 }}
              >
                <span className="text-accent">→ </span>
                {active.metaText}
              </span>
            </div>
          </div>

          {/* Foot disclaimer */}
          <div className="px-8 py-3 text-center text-xs text-ink-4 border-t border-dashed border-line bg-surface-alt">
            仅供产品演示 · 真题答疑界面以实际产品为准
          </div>
        </div>
      </div>
    </div>
  );
}
