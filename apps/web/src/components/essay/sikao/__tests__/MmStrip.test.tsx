import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MmStrip, type MaterialStripItem, type QuestionStripItem } from '../MmStrip';

describe('MmStrip', () => {
  it('renders material strip on side=l', () => {
    const items: MaterialStripItem[] = [
      { id: 'm1', status: 'marked', markedCount: 2 },
      { id: 'm2', status: 'read' },
      { id: 'm3', status: 'pending' },
    ];
    render(<MmStrip side="l" materials={items} activeIdx={0} onSelect={vi.fn()} />);
    const strip = screen.getByTestId('essay-mm-strip-l');
    expect(strip).toBeInTheDocument();
    // grid template should be 3 equal columns
    expect(strip.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('clicking a material triggers onSelect with index', () => {
    const onSelect = vi.fn();
    const items: MaterialStripItem[] = [
      { id: 'm1', status: 'pending' },
      { id: 'm2', status: 'pending' },
    ];
    render(<MmStrip side="l" materials={items} activeIdx={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('材料 2'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('renders question strip on side=r', () => {
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'submitted', currentChars: 198, requiredChars: 200 },
      { id: 'q2', status: 'pending', currentChars: 0, requiredChars: 300 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={1} onSelect={vi.fn()} />);
    expect(screen.getByTestId('essay-mm-strip-r')).toBeInTheDocument();
    expect(screen.getByLabelText('第 1 题')).toBeInTheDocument();
    expect(screen.getByLabelText('第 2 题')).toBeInTheDocument();
  });

  it('clicking a question triggers onSelect with index', () => {
    const onSelect = vi.fn();
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'pending', currentChars: 0, requiredChars: 200 },
      { id: 'q2', status: 'pending', currentChars: 0, requiredChars: 300 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('第 2 题'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('marks active material as active status', () => {
    const items: MaterialStripItem[] = [
      { id: 'm1', status: 'pending' },
      { id: 'm2', status: 'marked', markedCount: 1 },
    ];
    render(<MmStrip side="l" materials={items} activeIdx={1} onSelect={vi.fn()} />);
    const activeBtn = screen.getByLabelText('材料 2');
    expect(activeBtn.getAttribute('data-status')).toBe('active');
  });

  // ── Phase 1C Q-tab 三态 (2026-05-11) ───────────────────────────────
  it('Q-tab done state renders a check SVG glyph (not emoji ✓)', () => {
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'submitted', currentChars: 198, requiredChars: 200 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={1} onSelect={vi.fn()} />);
    const tab = screen.getByLabelText('第 1 题');
    // ✓ must be inline SVG, not text codepoint
    const svg = tab.querySelector('svg.essay-q-tab-check');
    expect(svg).not.toBeNull();
    // text content should NOT include the unicode ✓ char (U+2713)
    expect(tab.textContent ?? '').not.toMatch(/✓/);
    // Figma Make migration keeps visible tabs compact: Chinese numeral + status dot.
    expect(tab.textContent).toBe('一');
    expect(tab.querySelector('.essay-q-tab-dot')).not.toBeNull();
  });

  it('Q-tab active state has text-accent class + accent underline', () => {
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'submitted', currentChars: 198, requiredChars: 200 },
      { id: 'q2', status: 'writing', currentChars: 142, requiredChars: 500 },
      { id: 'q3', status: 'pending', currentChars: 0, requiredChars: 1000 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={1} onSelect={vi.fn()} />);
    const activeTab = screen.getByLabelText('第 2 题');
    expect(activeTab.className).toMatch(/text-accent/);
    expect(activeTab.className).toMatch(/essay-q-tab--active/);
    expect(activeTab.getAttribute('aria-current')).toBe('true');
    // non-active siblings should not get accent / underline
    const otherTab = screen.getByLabelText('第 1 题');
    expect(otherTab.className).not.toMatch(/text-accent/);
    expect(otherTab.getAttribute('aria-current')).toBeNull();
  });

  it('Q-tab active + done preserves the check glyph', () => {
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'submitted', currentChars: 198, requiredChars: 200 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={0} onSelect={vi.fn()} />);
    const tab = screen.getByLabelText('第 1 题');
    expect(tab.className).toMatch(/text-accent/);
    expect(tab.querySelector('svg.essay-q-tab-check')).not.toBeNull();
  });

  it('Q-tab locked state uses placeholder color, disabled, no click', () => {
    const onSelect = vi.fn();
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'pending', currentChars: 0, requiredChars: 200 },
      { id: 'q2', status: 'locked' },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={0} onSelect={onSelect} />);
    const lockedTab = screen.getByLabelText('第 2 题') as HTMLButtonElement;
    expect(lockedTab.disabled).toBe(true);
    expect(lockedTab.className).toMatch(/text-ink-4/);
    expect(lockedTab.className).toMatch(/essay-q-tab--locked/);
    fireEvent.click(lockedTab);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Q-tab default (pending, non-active) uses text-ink', () => {
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'pending', currentChars: 0, requiredChars: 200 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={1} onSelect={vi.fn()} />);
    const tab = screen.getByLabelText('第 1 题');
    expect(tab.className).toMatch(/text-ink/);
    expect(tab.className).not.toMatch(/text-accent/);
    expect(tab.className).not.toMatch(/text-ink-4/);
  });

  it('Q-tab renders a status dot when there is progress without visible meta text', () => {
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'writing', currentChars: 142, requiredChars: 0 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={0} onSelect={vi.fn()} />);
    const tab = screen.getByLabelText('第 1 题');
    expect(tab.textContent).toBe('一');
    expect(tab.querySelector('.essay-q-tab-dot')).not.toBeNull();
  });

  // ── a11y: role="tablist" + role="tab" + aria-selected (spec 04b L37-47) ──
  it('material strip exposes role="tablist" with aria-label', () => {
    const items: MaterialStripItem[] = [
      { id: 'm1', status: 'pending' },
      { id: 'm2', status: 'pending' },
    ];
    render(<MmStrip side="l" materials={items} activeIdx={0} onSelect={vi.fn()} />);
    const strip = screen.getByTestId('essay-mm-strip-l');
    expect(strip.getAttribute('role')).toBe('tablist');
    expect(strip.getAttribute('aria-label')).toBe('材料切换');
  });

  it('question strip exposes role="tablist" with aria-label', () => {
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'pending', currentChars: 0, requiredChars: 200 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={0} onSelect={vi.fn()} />);
    const strip = screen.getByTestId('essay-mm-strip-r');
    expect(strip.getAttribute('role')).toBe('tablist');
    expect(strip.getAttribute('aria-label')).toBe('题目切换');
  });

  it('Q-tab carries role="tab" + aria-selected per active state', () => {
    const items: QuestionStripItem[] = [
      { id: 'q1', status: 'pending', currentChars: 0, requiredChars: 200 },
      { id: 'q2', status: 'writing', currentChars: 100, requiredChars: 300 },
    ];
    render(<MmStrip side="r" questions={items} activeIdx={1} onSelect={vi.fn()} />);
    const active = screen.getByLabelText('第 2 题');
    const inactive = screen.getByLabelText('第 1 题');
    expect(active.getAttribute('role')).toBe('tab');
    expect(active.getAttribute('aria-selected')).toBe('true');
    expect(active.getAttribute('tabindex')).toBe('0');
    expect(inactive.getAttribute('role')).toBe('tab');
    expect(inactive.getAttribute('aria-selected')).toBe('false');
    expect(inactive.getAttribute('tabindex')).toBe('-1');
  });
});
