import { cn } from '@sikao/shared-utils';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { ScratchIcon } from '@sikao/ui/icons';

// SIKAO Phase 3 (2026-05-09) → Wave 9 Phase 2a (2026-05-12): Mobile (<768)
// scratch Floating Action Button. tablet (md+) 起 scratch col 已 inline 显示,
// FAB 仅 mobile (md:hidden). 防双 affordance.
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md + docs/design/mobile-style-guide.md §1.3.
//
// 显示条件 (caller 控制 visible prop): 答题数 >= 5. FAB 使用 IconBtn +
// Tooltip, 外观通过 className 覆盖为 56px capsule.
//
// Dumb by contract: visible / count / onClick 由 caller. 不读 store.

export interface FbScratchFabProps {
  readonly visible: boolean;
  readonly clipCount: number;
  readonly onClick: () => void;
}

export function FbScratchFab({ visible, clipCount, onClick }: FbScratchFabProps) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-20 right-4 z-30 md:hidden">
      <Tooltip label="打开便签" side="left">
        <IconBtn
          size="md"
          onClick={onClick}
          aria-label={clipCount > 0 ? `打开便签 (已有 ${clipCount} 条)` : '打开便签'}
          className={cn(
            'relative w-14 h-14 rounded-pill shadow-pop border-transparent',
            'bg-ink text-white hover:bg-ink-3 hover:text-white',
            'transition-transform duration-fast ease-motion',
            'hover:scale-105 active:scale-95',
          )}
          data-testid="fb-scratch-fab"
        >
          <ScratchIcon size={22} />
          {clipCount > 0 ? (
            <span
              className={
                'absolute top-1 right-1 inline-flex items-center justify-center min-w-5 h-5 px-2 rounded-pill bg-accent text-white text-tiny font-mono tabular-nums'
              }
              aria-hidden="true"
            >
              {clipCount}
            </span>
          ) : null}
        </IconBtn>
      </Tooltip>
    </div>
  );
}
