// EssayGrid — 3 档 responsive layout (Wave 9 Phase 2a, 2026-05-12):
//   - desktop ≥1024: 双栏 1.1fr / 1fr (材料 + ScratchPad 左 + 编辑器 右)
//   - tablet 769-1023: 紧凑双栏 280px / 1fr
//   - mobile ≤768: 沉浸单栏, mobileMode 切换 material / editor 全屏态
//
// CSS rule 落在 sikao-essay.css `.essay-grid` + media queries; 本组件只透传
// data-mobile-mode 给 css 选择器消费.

import './sikao-essay.css';
import type { ReactNode } from 'react';

export interface EssayGridProps {
  readonly source: ReactNode;
  readonly editor: ReactNode;
  /** Wave 9 Phase 2a: mobile (≤768) 单栏切换. tablet+ 双栏总同时显, 此 prop no-op. */
  readonly mobileMode?: 'editor' | 'material';
}

export function EssayGrid({ source, editor, mobileMode = 'editor' }: EssayGridProps) {
  return (
    <div className="essay-grid" data-testid="essay-grid" data-mobile-mode={mobileMode}>
      <div className="essay-source-col">{source}</div>
      <div className="essay-editor-col min-h-0 min-w-0 flex flex-col">
        {editor}
      </div>
    </div>
  );
}
