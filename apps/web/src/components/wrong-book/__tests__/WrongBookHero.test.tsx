import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WrongBookHero } from '../WrongBookHero';

const SUMMARY = {
  inPractice: 287,
  todoCount: 84,
  dangerCount: 23,
  graduatedCount: 112,
  weeklyNew: 38,
};

describe('WrongBookHero', () => {
  it('renders 5 stat cells with token-driven values', () => {
    render(<WrongBookHero summary={SUMMARY} />);

    expect(screen.getByTestId('wrong-book-hero')).toBeInTheDocument();
    expect(screen.getByTestId('wrong-book-hero-strip')).toBeInTheDocument();

    expect(screen.getByTestId('wrong-book-hero-in-practice')).toHaveTextContent(
      '287',
    );
    expect(screen.getByTestId('wrong-book-hero-todo')).toHaveTextContent('84');
    expect(screen.getByTestId('wrong-book-hero-danger')).toHaveTextContent('23');
    expect(screen.getByTestId('wrong-book-hero-graduated')).toHaveTextContent(
      '112',
    );
    expect(screen.getByTestId('wrong-book-hero-weekly-new')).toHaveTextContent(
      '38',
    );
  });

  it('renders editorial h1 with subtitle', () => {
    render(<WrongBookHero summary={SUMMARY} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/错题本/);
    expect(h1.textContent).toMatch(/把每一处失分练成肌肉记忆/);
  });
});
