/**
 * SIKAO Wave 8 Phase C · Home block 4 — 薄弱模块.
 *
 * 数据源: useWeakModules({limit: 2}) → WeakModuleListResponse (top 1-2 薄弱模块).
 * 显示: subject (言语/数量/...) + score (0-100) + wrong_rate % + suggested_action.
 * "去练习 →" CTA → /xingce/specialty (按 subject 跳对应专项).
 * Empty 态 (modules empty): "暂无薄弱模块, 继续保持!" — 不显 CTA.
 *
 * Dumb by contract: 不 fetch / 不写 store; props 接数据 + onPractice callback.
 * caller 处理路由跳转.
 *
 * Score 解释 (BE WeakModule schema):
 *   score = wrongRate × (1 - completionRate) × subjectWeight × 100
 *   越高表示越急需练 (错率高 + 完成率低).
 */

import type { WeakModule } from '@sikao/domain/dashboard/useHomeData';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

export interface HomeWeakModulesBlockProps {
  /** 薄弱模块列表 (caller 已按 score 降序排好, top 1-2). */
  readonly modules: readonly WeakModule[];
  /** 去练习 callback; caller 跳 /xingce/specialty 或对应 subject 专项. */
  readonly onPractice: (subject: WeakModule['subject']) => void;
}

function scoreLabel(score: number): { text: string; color: string } {
  // 跟 WeakPointsCard 的色档对齐 (bad / warn / muted)
  if (score >= 70) return { text: '急需', color: 'var(--err)' };
  if (score >= 50) return { text: '关注', color: 'var(--warn)' };
  return { text: '可练', color: 'var(--ink-3)' };
}

export function HomeWeakModulesBlock({
  modules,
  onPractice,
}: HomeWeakModulesBlockProps) {
  // Empty 态: 无薄弱信号
  if (modules.length === 0) {
    return (
      <section
        className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card min-h-[150px]"
        data-testid="home-weak-modules-block"
      >
        <header className="flex items-baseline justify-between pb-3 border-b border-line">
          <h4 className="font-serif text-h-card font-medium m-0">薄弱模块</h4>
          <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
            04 / 04
          </span>
        </header>
        <p className="text-sm text-ink-3 leading-relaxed flex-1">
          {DASHBOARD_COPY.weakEmpty}。{DASHBOARD_COPY.weakEmptyHint}。
        </p>
      </section>
    );
  }

  // Happy 态: 至少 1 个薄弱模块 (展示 top 1, 第 2 个用小字 sub strip)
  const top = modules[0];
  const second = modules.length > 1 ? modules[1] : null;
  const wrongPct = Math.round(top.wrongRate * 100);
  const completionPct = Math.round(top.completionRate * 100);
  const label = scoreLabel(top.score);

  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card min-h-[150px]"
      data-testid="home-weak-modules-block"
    >
      <header className="flex items-baseline justify-between pb-3 border-b border-line">
        <h4 className="font-serif text-h-card font-medium m-0">薄弱模块</h4>
        <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          04 / 04
        </span>
      </header>

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="font-serif text-base text-ink m-0 truncate"
            data-testid="home-weak-top-subject"
          >
            {top.subject}
          </p>
          <span
            className="font-mono text-tiny tracking-eyebrow uppercase"
            style={{ color: label.color }}
            data-testid="home-weak-top-label"
          >
            {label.text}
          </span>
        </div>
        <p className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          错率 {wrongPct}% · 完成 {completionPct}% · {top.suggestedAction}
        </p>
        {second != null ? (
          <p
            className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase"
            data-testid="home-weak-second-row"
          >
            次薄弱 · {second.subject} ·{' '}
            {Math.round(second.wrongRate * 100)}% 错率
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onPractice(top.subject)}
        className="self-start rounded-tiny bg-ink text-paper px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity duration-fast"
        data-testid="home-weak-practice"
      >
        去练习 →
      </button>
    </section>
  );
}
