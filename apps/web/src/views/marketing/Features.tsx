import type { ReactNode } from 'react';
import {
  ChatIcon,
  FileTextIcon,
  SubjectEssayIcon,
  SubjectWrongbookIcon,
} from '@sikao/ui/icons';

// Marketing V1 核心能力 4 卡 + hover lift + token-strict.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-feat-grid.

interface FeatureItem {
  readonly icon: ReactNode;
  readonly title: string;
  readonly desc: string;
}

const FEATURES: readonly FeatureItem[] = [
  {
    icon: <ChatIcon className="w-5 h-5" />,
    title: '解析问答',
    desc: '遇到不懂的题直接追问，解析会从考点、思路、易错点三个层面讲清楚。不止告诉你答案是什么，更告诉你为什么。',
  },
  {
    icon: <FileTextIcon className="w-5 h-5" />,
    title: '真题刷题与模考',
    desc: '2013 年至今全量国考真题 + 186 套省考真题。支持单题、模块、整套三种模式，断点续答。',
  },
  {
    icon: <SubjectEssayIcon className="w-5 h-5" />,
    title: '申论评分',
    desc: '输入作文，30 秒内拿到按评分标准给的分数、要点反馈与改进建议。对齐国考真实阅卷维度。',
  },
  {
    icon: <SubjectWrongbookIcon className="w-5 h-5" />,
    title: '错题本与薄弱分析',
    desc: '自动归类错题到考点图谱。你弱在资料分析还是判断推理，一目了然，配套专项训练。',
  },
];

export function MarketingFeatures() {
  return (
    <section id="features-section" className="py-24 border-t border-line">
      <span className="text-base font-semibold text-ink-1">核心能力</span>
      <h2
        className="text-3xl md:text-5xl font-semibold tracking-tighter leading-tight mt-3 mb-4 max-w-[720px]"
        style={{ textWrap: 'balance' }}
      >
        备考需要的，都在一个地方
      </h2>
      <p className="text-lg text-ink-3 leading-snug max-w-[56ch]">
        解析问答不是替你做题，是帮你搞清楚每一题背后的考点与思路。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
        {FEATURES.map((f) => (
          <article
            key={f.title}
            className="bg-surface border border-line rounded-card-lg p-8 shadow-card transition-[box-shadow,border-color] duration-fast ease-motion hover:shadow-pop hover:border-line-3"
          >
            <div className="w-11 h-11 rounded-card bg-paper-2 text-ink-1 flex items-center justify-center mb-5">
              {f.icon}
            </div>
            <h3 className="text-lg font-semibold mb-3">{f.title}</h3>
            <p className="text-md text-ink-3 leading-relaxed">{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
