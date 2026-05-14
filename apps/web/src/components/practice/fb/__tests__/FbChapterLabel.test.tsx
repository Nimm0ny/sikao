import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FbChapterLabel } from '../FbChapterLabel';

describe('FbChapterLabel', () => {
  it('renders num + title', () => {
    render(<FbChapterLabel numLabel="CHAPTER 01" title="言语理解" />);
    expect(screen.getByText('CHAPTER 01')).toBeInTheDocument();
    expect(screen.getByText('言语理解')).toBeInTheDocument();
  });

  it('shows completion label when provided', () => {
    render(
      <FbChapterLabel
        numLabel="CHAPTER 02"
        title="数量判断"
        completionLabel="5 / 11"
      />,
    );
    expect(screen.getByText('5 / 11')).toBeInTheDocument();
  });

  it('hides completion label when undefined', () => {
    const { container } = render(
      <FbChapterLabel numLabel="CHAPTER 01" title="言语理解" />,
    );
    expect(container.textContent).not.toContain('/');
  });

  it('renders with role=separator + aria-label', () => {
    render(<FbChapterLabel numLabel="CHAPTER 01" title="言语理解" />);
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-label', 'CHAPTER 01 言语理解');
  });
});
