import { useMemo, type ReactElement } from 'react';
import { Chip } from '@sikao/ui/ui/Chip';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';
import ShenlunMaterialReader from './ShenlunMaterialReader';
import type { ShenlunMaterial } from './mockSession';

//
// + docs/design/Mobile and Tablet Pack New.html line 2243-2270.
//
//   - 顶部 chip nav 行: 题号 chip 横排 (Chip primitive · rounded-pill)
//   - 底部材料阅读区: ShenlunMaterialReader (serif 14 / 1.85, 滚动)
//
//   - 退出行 (TD1 在 TopBar 已持; TD1b 由 portrait shell 自己持)
//   - 段 chips (给定材料 · 5 段) — 切材料的导航, 跟题号 chip 概念上重叠, 现在
//     用题号 chip 同时驱动 material 切换 (1 题 ↔ 1 材料 mock 简化). 真实场景
//     题号和材料是多对多, P5 BE 提供完整 question→material 映射时再分两层.
//   - 引用计数 footer — 跟划线 / scratch 强相关, P3 引入 Editor 时一起做.
//
// 设计决策:
//   - 不复用 components/essay/sikao/MaterialPanel: 那是高耦合 store +
//     ShenlunMaterialReader.tsx 顶部 comment.
//   - 用 Chip primitive 做题号 nav: Chip 已是 design system pill button 标准件,
//     selected 态自动反白 (规范 §5 .chip-btn.is-on), 不需要自绘. 横排可滚动
//     防 4 题以上时 chip 溢出 (overflow-x-auto + scroll-smooth).
//   - 宽度走 inline style `width: 340` — spec §2.4 写死 340, 没有 token, 也
//     不值得新增 `w-aside-material` 单点 token (lint:hardcode allow container
//     width 任意 px).

export interface MaterialPaneProps {
  readonly materials: ReadonlyArray<ShenlunMaterial>;
  readonly activeId: string;
  readonly onActiveChange: (id: string) => void;
  readonly className?: string;
  /**
   * TD2 (portrait) 走全宽材料条: 不固定 340px, 不画右侧 border (竖屏材料条
   * 是整行 strip, 右边没东西可分隔). 默认 false = TD1 横屏 340 固定列.
   */
  readonly fullWidth?: boolean;
}

export default function MaterialPane({
  materials,
  activeId,
  onActiveChange,
  className,
  fullWidth = false,
}: MaterialPaneProps): ReactElement {
  // Fail-fast: activeId 必须在 materials 内, 否则下方 active 渲染会拿到
  // undefined 触发隐式空白页 (违反 CLAUDE.md §4 fail-fast). 这里 throw 让
  // caller 立刻看到 mock / BE payload 不一致.
  const activeMaterial = useMemo(() => {
    const found = materials.find((m) => m.id === activeId);
    if (!found) {
      throw new Error(
        `MaterialPane: activeId="${activeId}" not in materials [${materials
          .map((m) => m.id)
          .join(', ')}]`,
      );
    }
    return found;
  }, [materials, activeId]);

  return (
    <aside
      data-testid="shenlun-material-pane"
      className={cn(
        'flex flex-col min-h-0 bg-paper-2',
        fullWidth ? 'w-full' : 'border-r border-line-1',
        className,
      )}
      style={fullWidth ? undefined : { width: 340 }} /* hardcode-allow: spec TD1 §2.4 左栏宽度 340px 写死 */
    >
      <nav
        aria-label={ESSAY_SIKAO_COPY.materialPaneNavAriaLabel}
        className="flex items-center gap-2 px-4 py-3 border-b border-line-1 bg-paper-1 overflow-x-auto"
        data-testid="shenlun-material-pane-nav"
      >
        {materials.map((m) => {
          const selected = m.id === activeId;
          return (
            <Chip
              key={m.id}
              size="sm"
              selected={selected}
              onClick={() => onActiveChange(m.id)}
              data-testid={`shenlun-material-chip-${m.id}`}
              data-active={selected || undefined}
            >
              {m.title}
            </Chip>
          );
        })}
      </nav>
      <ShenlunMaterialReader material={activeMaterial} className="flex-1" />
    </aside>
  );
}
