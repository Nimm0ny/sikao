import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbActions } from '../FbActions';

describe('FbActions', () => {
  const baseProps = {
    questionId: 'q42',
    isFavorited: false,
    isMarked: false,
    hasNote: false,
    onToggleFavorite: vi.fn(),
    onToggleMark: vi.fn(),
    onOpenNote: vi.fn(),
  };

  it('renders 4 toolbar buttons (fav/mark/note/highlight-stub) in vertical layout', () => {
    render(<FbActions {...baseProps} />);
    const toolbar = screen.getByTestId('fb-actions');
    expect(toolbar.className).toMatch(/flex-col/);
    expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByLabelText('收藏')).toBeInTheDocument();
    expect(screen.getByLabelText('标记')).toBeInTheDocument();
    expect(screen.getByLabelText('笔记')).toBeInTheDocument();
    expect(screen.getByLabelText(/划线/)).toBeInTheDocument();
  });

  it('highlight stub button is disabled + aria-hidden when onHighlightArm 未注入 (P1 stub)', () => {
    render(<FbActions {...baseProps} />);
    const stub = screen.getByLabelText(/划线/);
    expect(stub).toBeDisabled();
    expect(stub).toHaveAttribute('aria-hidden', 'true');
  });

  it('P5b/2 highlight button enabled + 点击 → onHighlightArm(qid) (注入后)', async () => {
    const onHighlightArm = vi.fn();
    const user = userEvent.setup();
    render(
      <FbActions {...baseProps} onHighlightArm={onHighlightArm} />,
    );
    const btn = screen.getByLabelText('划线');
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute('aria-hidden');
    await user.click(btn);
    expect(onHighlightArm).toHaveBeenCalledWith('q42');
  });

  it('clicking favorite toggles via onToggleFavorite(qid, !current)', async () => {
    const onToggleFavorite = vi.fn();
    const user = userEvent.setup();
    render(<FbActions {...baseProps} onToggleFavorite={onToggleFavorite} />);
    await user.click(screen.getByLabelText('收藏'));
    expect(onToggleFavorite).toHaveBeenCalledWith('q42', true);
  });

  it('clicking mark when isMarked=true fires onToggleMark(qid, false)', async () => {
    const onToggleMark = vi.fn();
    const user = userEvent.setup();
    render(<FbActions {...baseProps} isMarked onToggleMark={onToggleMark} />);
    await user.click(screen.getByLabelText('已标记'));
    expect(onToggleMark).toHaveBeenCalledWith('q42', false);
  });

  it('clicking note fires onOpenNote(qid)', async () => {
    const onOpenNote = vi.fn();
    const user = userEvent.setup();
    render(<FbActions {...baseProps} onOpenNote={onOpenNote} />);
    await user.click(screen.getByLabelText('笔记'));
    expect(onOpenNote).toHaveBeenCalledWith('q42');
  });

  it('isFavorited=true reflects aria-pressed + variant on', () => {
    render(<FbActions {...baseProps} isFavorited />);
    const fav = screen.getByLabelText('已收藏');
    expect(fav).toHaveAttribute('aria-pressed', 'true');
  });
});
