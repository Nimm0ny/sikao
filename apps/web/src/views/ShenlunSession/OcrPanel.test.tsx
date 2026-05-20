import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import OcrPanel from './OcrPanel';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

//
// 覆盖:
//   - 渲染 required props 不崩 + ocrPanelTitle / ocrPanelDisabled 文案出现
//   - stub 状态: OCR 提交 button disabled, 手写原稿 button **不** disabled
//   - 双 button 都有 aria-label (CLAUDE.md §4 SVG-only / IconBtn a11y 铁律)
//   - onSubmitHandwritten 触发当 click
//   - onSubmitOcr 不触发当 disabled (click 不上来)
//   - width prop 自定义
//
// 不覆盖 (后续 phase):
//   - 真实 OCR 识别 + 一句一对照 (端上模型未就位, lhr decision #1)
//   - Tooltip visible hover (jsdom 不模拟 hover transition, 走 chrome MCP)

describe('OcrPanel', () => {
  it('renders without crashing with default props', () => {
    renderWithProviders(<OcrPanel />);
    expect(screen.getByTestId('shenlun-ocr-panel')).toBeInTheDocument();
  });

  it('renders title and disabled hint text from ESSAY_SIKAO_COPY', () => {
    renderWithProviders(<OcrPanel />);
    expect(screen.getByText(ESSAY_SIKAO_COPY.ocrPanelTitle)).toBeInTheDocument();
    expect(
      screen.getByTestId('shenlun-ocr-panel-disabled-hint').textContent,
    ).toBe(ESSAY_SIKAO_COPY.ocrPanelDisabled);
  });

  it('OCR submit button is disabled in stub state', () => {
    renderWithProviders(<OcrPanel />);
    const ocrBtn = screen.getByTestId('shenlun-ocr-submit-ocr');
    expect(ocrBtn).toBeDisabled();
  });

  it('handwritten submit button stays enabled in stub state (handoff §7 mitigation)', () => {
    renderWithProviders(<OcrPanel />);
    const handwrittenBtn = screen.getByTestId('shenlun-ocr-submit-handwritten');
    expect(handwrittenBtn).not.toBeDisabled();
  });

  it('both buttons carry aria-label (CLAUDE.md §4 IconBtn a11y rule)', () => {
    renderWithProviders(<OcrPanel />);
    const ocrBtn = screen.getByTestId('shenlun-ocr-submit-ocr');
    const handwrittenBtn = screen.getByTestId('shenlun-ocr-submit-handwritten');
    expect(ocrBtn.getAttribute('aria-label')).toBe(
      ESSAY_SIKAO_COPY.ocrPanelSubmitOcrLabel,
    );
    expect(handwrittenBtn.getAttribute('aria-label')).toBe(
      ESSAY_SIKAO_COPY.ocrPanelSubmitHandwrittenLabel,
    );
  });

  it('fires onSubmitHandwritten when handwritten button clicked', () => {
    const onSubmitHandwritten = vi.fn();
    renderWithProviders(
      <OcrPanel onSubmitHandwritten={onSubmitHandwritten} />,
    );
    fireEvent.click(screen.getByTestId('shenlun-ocr-submit-handwritten'));
    expect(onSubmitHandwritten).toHaveBeenCalledTimes(1);
  });

  it('does not fire onSubmitOcr when OCR button is disabled (click suppressed)', () => {
    const onSubmitOcr = vi.fn();
    renderWithProviders(<OcrPanel onSubmitOcr={onSubmitOcr} />);
    const ocrBtn = screen.getByTestId('shenlun-ocr-submit-ocr');
    // disabled button does not fire click handlers per HTML spec
    fireEvent.click(ocrBtn);
    expect(onSubmitOcr).not.toHaveBeenCalled();
  });

  it('default width is 240 (handoff §2.6 spec)', () => {
    renderWithProviders(<OcrPanel />);
    const panel = screen.getByTestId('shenlun-ocr-panel');
    expect(panel).toHaveStyle({ width: '240px' });
  });

  it('respects custom width prop', () => {
    renderWithProviders(<OcrPanel width={280} />);
    const panel = screen.getByTestId('shenlun-ocr-panel');
    expect(panel).toHaveStyle({ width: '280px' });
  });
});
