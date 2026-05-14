import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  it('shows on hover and hides on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="收藏" side="top">
        <button type="button">Star</button>
      </Tooltip>,
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(screen.getByRole('button', { name: 'Star' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('收藏');

    await user.unhover(screen.getByRole('button', { name: 'Star' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows on focus and hides on blur', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="设置" side="right">
        <button type="button">Settings</button>
      </Tooltip>,
    );

    await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('设置');

    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('hides when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="暂停" side="bottom">
        <button type="button">Pause</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('connects the trigger to the tooltip with aria-describedby', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="答题卡" side="left">
        <button type="button">Sheet</button>
      </Tooltip>,
    );

    await user.tab();

    const trigger = screen.getByRole('button', { name: 'Sheet' });
    const tooltip = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(tooltip.id).toBeTruthy();
  });

  it('uses tokenized design-system classes', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="笔记" side="top">
        <button type="button">Note</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button', { name: 'Note' }));
    expect(screen.getByRole('tooltip')).toHaveClass(
      'rounded-tiny',
      'bg-ink',
      'text-white',
      'shadow-pop',
    );
  });
});
