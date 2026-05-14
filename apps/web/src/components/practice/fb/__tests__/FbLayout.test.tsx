import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FbLayout } from '../FbLayout';

describe('FbLayout', () => {
  it('renders both reading + scratch slots', () => {
    render(
      <FbLayout
        readingCol={<div data-testid="reading-content">阅读区</div>}
        scratchCol={<div data-testid="scratch-content">草稿区</div>}
      />,
    );
    expect(screen.getByTestId('reading-content')).toBeInTheDocument();
    expect(screen.getByTestId('scratch-content')).toBeInTheDocument();
  });

  it('uses fb-layout testid wrapper with grid', () => {
    render(
      <FbLayout
        readingCol={<span>r</span>}
        scratchCol={<span>s</span>}
      />,
    );
    const layout = screen.getByTestId('fb-layout');
    expect(layout.className).toContain('grid');
    // 1024-1366 双栏窄, ≥1367 双栏宽
    expect(layout.className).toMatch(/lg:grid-cols/);
    expect(layout.className).toMatch(/xl-laptop:grid-cols/);
  });
});
