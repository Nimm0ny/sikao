//
// Why: TopBar + MaterialPane render end-to-end against this stub so the
// layout can be validated visually + by Chrome MCP audit before the
// /essay/sessions/{id}/draft endpoint lands. Shape is intentionally kept
//
// Replacement contract (P5): BE returns the same Material / Question shape
// (or a superset) via /api/v2/essay/sessions/{id}; the FE adapter maps
// backend payload to these types. Mock IDs are stable so vitest snapshots
// remain valid during the swap.

export interface ShenlunMaterial {
  readonly id: string;
  readonly title: string;
  readonly content: string;
}

export interface ShenlunQuestion {
  readonly id: string;
  readonly label: string; // "题目一" / "题目二" / ...
  readonly maxWordCount: number;
  readonly currentWordCount: number;
  readonly done: boolean;
}

export interface ShenlunMockSession {
  readonly examLabel: string;
  readonly materials: ReadonlyArray<ShenlunMaterial>;
  readonly questions: ReadonlyArray<ShenlunQuestion>;
}

// TD1 设计稿对齐 (Mobile and Tablet Pack New.html line 2257-2261 + 2229-2240).
export const MOCK_SHENLUN_SESSION: ShenlunMockSession = {
  examLabel: '2024 国考 · 模拟一',
  materials: [
    {
      id: 'm1',
      title: '材料一 · 政策背景',
      content:
        '近年来，国家在基层治理领域陆续推出多项改革举措，强调依法依规、过程透明、群众参与。\n\n各地结合自身情况，形成了若干典型做法。本节摘录其中具有代表性的政策文件片段，供参考。',
    },
    {
      id: 'm2',
      title: '材料二 · 基层访谈',
      content:
        '记者：在您看来，基层治理当前最大的瓶颈是什么？\n\n李书记：说到底是"程序"和"效率"的张力。我们镇上去年办低保，按规走完所有程序要 47 天⋯⋯',
    },
    {
      id: 'm3',
      title: '材料三 · 专家观点',
      content:
        '某高校公共管理学院教授指出，程序正义保障了公民的基本权利，是现代法治社会的基石；但在实践中常常与实体正义产生张力。',
    },
    {
      id: 'm4',
      title: '材料四 · 案例 A 县',
      content:
        'A 县在推行政务服务标准化的过程中，将办事流程压缩 40%，但同时保留了关键节点的群众参与机制，做到了"程序不漏项、效率有提升"。',
    },
    {
      id: 'm5',
      title: '材料五 · 国际比较',
      content:
        '部分发达国家在基层治理上采用"清单管理 + 听证程序"的组合，既明确权力边界，又保证利益相关方的发言机会。',
    },
  ],
  questions: [
    { id: 'q1', label: '题目一', maxWordCount: 300, currentWordCount: 300, done: true },
    { id: 'q2', label: '题目二', maxWordCount: 400, currentWordCount: 400, done: true },
    { id: 'q3', label: '题目三', maxWordCount: 500, currentWordCount: 427, done: false },
    { id: 'q4', label: '题目四', maxWordCount: 1500, currentWordCount: 0, done: false },
  ],
};
