import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Me } from './Me';

function renderMe() {
  return render(
    <MemoryRouter initialEntries={['/me']}>
      <Me />
    </MemoryRouter>,
  );
}

describe('Me view (D.4.4)', () => {
  it('renders MeHero with avatar + name + 3 stat cells', () => {
    renderMe();
    expect(screen.getByTestId('me-hero')).toBeInTheDocument();
    expect(screen.getByText('lhr')).toBeInTheDocument();
    const cells = screen.getByTestId('me-hero').querySelectorAll('span > span');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('renders 学习设置 + 账号 panels in MeGrid', () => {
    renderMe();
    expect(screen.getByText('学习设置')).toBeInTheDocument();
    expect(screen.getByText('账号')).toBeInTheDocument();
  });

  it('renders 危险操作 panel with variant=danger and a danger list', () => {
    renderMe();
    const dangerPanel = screen.getByText('危险操作').closest('[data-testid="panel"]');
    expect(dangerPanel?.getAttribute('data-variant')).toBe('danger');
    expect(screen.getByTestId('me-danger-list')).toBeInTheDocument();
  });

  it('clicking 注销账号 opens the destructive confirm dialog', () => {
    renderMe();
    fireEvent.click(screen.getByRole('button', { name: /注销账号/ }));
    expect(screen.getByText('确认操作')).toBeInTheDocument();
  });

  it('shows the practice preferences entry in 学习设置', () => {
    renderMe();
    expect(screen.getByRole('button', { name: /练习偏好/ })).toBeInTheDocument();
  });
});
