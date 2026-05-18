import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EssayGrid } from '../EssayGrid';

describe('EssayGrid', () => {
  it('starts at a 50/50 split and resizes from pointer movement', () => {
    render(<EssayGrid source={<div>materials</div>} editor={<div>answer</div>} />);

    const grid = screen.getByTestId('essay-grid');
    Object.defineProperty(grid, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 1000, top: 0, height: 600, right: 1000, bottom: 600 }),
    });

    expect(grid).toHaveStyle({ '--essay-source-pct': '50%' });

    fireEvent.pointerDown(screen.getByTestId('essay-grid-resizer'), { clientX: 500 });
    fireEvent.pointerMove(window, { clientX: 250 });
    fireEvent.pointerUp(window);

    expect(grid).toHaveStyle({ '--essay-source-pct': '25%' });
  });

  it('clamps the split pane to 25 percent minimum on both sides', () => {
    render(<EssayGrid source={<div>materials</div>} editor={<div>answer</div>} />);

    const grid = screen.getByTestId('essay-grid');
    Object.defineProperty(grid, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 1000, top: 0, height: 600, right: 1000, bottom: 600 }),
    });

    fireEvent.pointerDown(screen.getByTestId('essay-grid-resizer'), { clientX: 500 });
    fireEvent.pointerMove(window, { clientX: 900 });
    fireEvent.pointerUp(window);

    expect(grid).toHaveStyle({ '--essay-source-pct': '75%' });
  });
});
