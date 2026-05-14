import { useCallback, useId, type ReactElement } from 'react';
import { Button } from '@sikao/ui/ui/Button';
import { Tooltip } from '@sikao/ui/ui/Tooltip';
import { NavSubmitIcon } from '@sikao/ui/icons/NavSubmitIcon';
import { PenIcon } from '@sikao/ui/icons/PenIcon';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';

// ShenlunSession/OcrPanel (PR13 P4, 2026-05-13) — Pencil 模式专属 240w 右栏 OCR
// 识别 + 双轨提交.
//
// Spec SSOT: docs/design/handoff/Shenlun & Tablet Refinements · Handoff.md §2.6
//            (TD1b · Pencil 模式差异) + §7 (风险与回滚 — "OCR 端上模型未就位 →
//            OcrPanel 显示 '识别服务暂未启用', 不禁用手写本身").
//            + plan docs/plan/sikao-shenlun-dual-mode-pr13.md §7 (P4 recon
//            "stub per lhr decision #1 — fake recognition data").
//
// 设计决策 (master 拍板 2026-05-13):
//   - **stub 状态** (端上 OCR 模型未就位): 上半身显示 ocrPanelDisabled 兜底
//     文案; 下半身**双 IconBtn 仍渲染**, 但 OCR 按钮 disabled (没识别文本可提交),
//     手写原稿按钮**保持启用** (handoff §7 mitigation 铁线 "不禁用手写本身").
//   - **一屏 ≤1 主 CTA** (CLAUDE.md §4): 提交 OCR (variant=primary) + 提交手写
//     原稿 (variant=secondary). 双 button 都是 [SVG + 文字] 双形态 — 主 CTA
//     例外允许. 实际 stub 状态下 OCR disabled, 唯一活跃 CTA 是手写原稿.
//   - **callback hook 留位**: onSubmitOcr / onSubmitHandwritten 由 caller (shell)
//     提供. P4 stub 阶段 shell 还没 wire 真实 BE 调用, 这里只把事件传上去.
//     P5 BE 接入后 shell 接 useSubmitEssay mutation.
//   - **Tooltip primitive 包**: 两个 button 都加 Tooltip (CLAUDE.md §4 SVG-only
//     铁律对图标按钮要求, 主 CTA 文字 + svg 双形态时 Tooltip 仍是良好实践).
//
// 不实现 (后续 slice):
//   - 真实 OCR 端上模型 inference (lhr decision #1: 独立 slice).
//   - 一句一对照 highlight (text segment ↔ canvas region 联动) — 等 OCR 落地.
//   - 编辑识别错字 (textarea 修正) — 等 OCR 落地.

export interface OcrPanelProps {
  /** 宽度 px, handoff §2.6 spec 240. */
  readonly width?: number;
  /**
   * 提交 OCR 文本 callback. P4 stub 阶段实际 disabled, 留位给 P5+ 真实 OCR
   * 落地后调用. caller 传 undefined → button 走 stub 默认 disabled.
   */
  readonly onSubmitOcr?: (recognizedText: string) => void;
  /**
   * 提交手写原稿 callback (上传 canvas snapshot 当作 image asset). P4 stub 阶段
   * 保持启用 (handoff §7 mitigation "不禁用手写本身"). caller 传 undefined →
   * fail-fast (caller 错误集成).
   */
  readonly onSubmitHandwritten?: () => void;
  readonly className?: string;
}

const PANEL_WIDTH = 240;

export default function OcrPanel({
  width = PANEL_WIDTH,
  onSubmitOcr,
  onSubmitHandwritten,
  className,
}: OcrPanelProps): ReactElement {
  const reactId = useId();
  const headerDomId = `shenlun-ocr-header-${reactId}`;

  // stub 状态固定: 没有真实 OCR 文本可提交, OCR 按钮 disabled. 等 P5+ 端上模型
  // 落地后, 这里换成 `recognizedText.trim() !== ''` 派生.
  const ocrEnabled = false;

  const handleSubmitOcr = useCallback((): void => {
    // stub 阶段不应触发 (disabled 拦截), 兜底 fail-fast 防止 caller 误传错误
    // disabled 状态绕过.
    if (!onSubmitOcr) return;
    onSubmitOcr('');
  }, [onSubmitOcr]);

  const handleSubmitHandwritten = useCallback((): void => {
    onSubmitHandwritten?.();
  }, [onSubmitHandwritten]);

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 bg-paper-1 border-l border-line-2',
        className,
      )}
      style={{ width }}
      aria-labelledby={headerDomId}
      data-testid="shenlun-ocr-panel"
    >
      <header className="shrink-0 px-4 py-3 border-b border-line-1">
        <h2
          id={headerDomId}
          className="font-serif text-ink"
          style={{ fontSize: 14 }} /* hardcode-allow: --t-body 14 panel header, 跟 OutlineAside / MaterialPane caption 同档 */
        >
          {ESSAY_SIKAO_COPY.ocrPanelTitle}
        </h2>
      </header>
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
        data-testid="shenlun-ocr-panel-body"
      >
        <p
          className="font-serif text-ink-3"
          style={{ fontSize: 12, lineHeight: 1.6 }} /* hardcode-allow: --t-meta 12 兜底说明文案 */
          data-testid="shenlun-ocr-panel-disabled-hint"
        >
          {ESSAY_SIKAO_COPY.ocrPanelDisabled}
        </p>
      </div>
      <footer
        className="shrink-0 flex flex-col gap-2 px-3 py-3 border-t border-line-1 bg-paper-2"
        data-testid="shenlun-ocr-panel-footer"
      >
        <Tooltip label={ESSAY_SIKAO_COPY.ocrPanelSubmitOcrLabel}>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            leftIcon={<NavSubmitIcon size={14} />}
            onClick={handleSubmitOcr}
            disabled={!ocrEnabled}
            aria-label={ESSAY_SIKAO_COPY.ocrPanelSubmitOcrLabel}
            data-testid="shenlun-ocr-submit-ocr"
          >
            {ESSAY_SIKAO_COPY.ocrPanelSubmitOcrLabel}
          </Button>
        </Tooltip>
        <Tooltip label={ESSAY_SIKAO_COPY.ocrPanelSubmitHandwrittenLabel}>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            leftIcon={<PenIcon size={14} />}
            onClick={handleSubmitHandwritten}
            aria-label={ESSAY_SIKAO_COPY.ocrPanelSubmitHandwrittenLabel}
            data-testid="shenlun-ocr-submit-handwritten"
          >
            {ESSAY_SIKAO_COPY.ocrPanelSubmitHandwrittenLabel}
          </Button>
        </Tooltip>
      </footer>
    </aside>
  );
}
