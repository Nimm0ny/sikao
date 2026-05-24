import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SpriteIcon } from './SpriteIcon';

describe('SpriteIcon', () => {
  it('renders <svg><use href="/icons.svg#<id>" />', () => {
    const { container } = render(<SpriteIcon id="check" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const use = svg!.querySelector('use');
    expect(use?.getAttribute('href')).toBe('/icons.svg#check');
  });

  it('defaults to size=18', () => {
    const { container } = render(<SpriteIcon id="nav-home" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('18');
    expect(svg.getAttribute('height')).toBe('18');
  });

  it('honors size prop', () => {
    const { container } = render(<SpriteIcon id="check" size={14} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');
  });

  it('carries aria-hidden=true by default (decorative)', () => {
    const { container } = render(<SpriteIcon id="check" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('exposes aria-label + role=img when label provided', () => {
    const { container } = render(<SpriteIcon id="check" aria-label="已掌握" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBe('已掌握');
    expect(svg.getAttribute('role')).toBe('img');
  });
});
