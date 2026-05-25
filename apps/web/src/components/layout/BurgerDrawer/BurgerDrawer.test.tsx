import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BurgerDrawer } from './BurgerDrawer';

/*
 * BurgerDrawer — SIK-121 W3 H11 placeholder tests.
 * Contract: docs/plan/sik-rail-v5-visual-contract.md §2.5 + §6 H11.
 */

describe('BurgerDrawer (SIK-121 W3 H11 placeholder)', () => {
  it('renders a trigger button with aria-label "打开导航"', () => {
    render(<BurgerDrawer />);
    const trigger = screen.getByRole('button', { name: '打开导航' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders a drawer aside that is hidden by default', () => {
    render(<BurgerDrawer />);
    const drawer = screen.getByTestId('burger-drawer');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
  });

  it('clicking trigger opens the drawer (aria-hidden=false)', () => {
    render(<BurgerDrawer />);
    const trigger = screen.getByTestId('burger-trigger');
    fireEvent.click(trigger);
    const drawer = screen.getByTestId('burger-drawer');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking close button hides the drawer', () => {
    render(<BurgerDrawer />);
    fireEvent.click(screen.getByTestId('burger-trigger'));
    const closeBtn = screen.getByRole('button', { name: '关闭导航' });
    fireEvent.click(closeBtn);
    expect(screen.getByTestId('burger-drawer')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders children inside the drawer', () => {
    render(<BurgerDrawer><span data-testid="child">hello</span></BurgerDrawer>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
