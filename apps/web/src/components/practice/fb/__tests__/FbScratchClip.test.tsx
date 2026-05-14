import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbScratchClip } from '../FbScratchClip';
import type { ScratchClip } from '@sikao/domain/answer-session/usePracticeStore';

describe('FbScratchClip', () => {
  const baseClip: ScratchClip = {
    id: 'clip-1',
    qid: '101',
    content: '差为等差',
    sourceLabel: 'M1',
    createdAt: 0,
  };

  it('renders source label and content', () => {
    render(<FbScratchClip clip={baseClip} onRemove={vi.fn()} />);
    expect(screen.getByText('M1')).toBeInTheDocument();
    expect(screen.getByText('差为等差')).toBeInTheDocument();
  });

  it('omits label when sourceLabel is empty', () => {
    const clip: ScratchClip = { ...baseClip, sourceLabel: undefined };
    render(<FbScratchClip clip={clip} onRemove={vi.fn()} />);
    expect(screen.queryByText('M1')).not.toBeInTheDocument();
  });

  it('clicking remove fires onRemove(id)', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<FbScratchClip clip={baseClip} onRemove={onRemove} />);
    await user.click(screen.getByLabelText('删除便签'));
    expect(onRemove).toHaveBeenCalledWith('clip-1');
  });
});
