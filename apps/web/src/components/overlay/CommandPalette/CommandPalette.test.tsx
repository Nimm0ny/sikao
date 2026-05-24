import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import type { CommandPaletteGroup } from './CommandPalette';

/*
 * CommandPalette tests — V5 D.3.26 overlay.
 * Why: cover open render + input focus, query filtering (case-insensitive),
 *      ↓↑Enter keyboard nav, click-to-select, and Esc-to-close. Portal
 *      mounts to document.body so testing-library queries find the surface.
 */

const groups: CommandPaletteGroup[] = [
  {
    label: '导航',
    items: [
      { id: 'home', label: '首页', onSelect: () => {} },
      { id: 'practice', label: '练习', onSelect: () => {} },
    ],
  },
  {
    label: '工具',
    items: [
      { id: 'notes', label: '笔记', shortcut: ['Ctrl', 'N'], onSelect: () => {} },
    ],
  },
];

describe('CommandPalette', () => {
  it('renders nothing when open=false and a portal dialog when open=true', () => {
    const { rerender } = render(
      <CommandPalette open={false} onClose={() => {}} groups={groups} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(<CommandPalette open onClose={() => {}} groups={groups} />);
    const dialog = screen.getByRole('dialog', { name: '命令面板' });
    expect(dialog).toBeInTheDocument();
    // input is the combobox surface
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    // all items render initially
    expect(screen.getByRole('option', { name: /首页/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /练习/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /笔记/ })).toBeInTheDocument();
  });

  it('filters items by case-insensitive label substring; shows empty state when no match', () => {
    render(<CommandPalette open onClose={() => {}} groups={groups} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '笔' } });
    expect(screen.queryByRole('option', { name: /首页/ })).toBeNull();
    expect(screen.getByRole('option', { name: /笔记/ })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByTestId('cmdk-empty')).toHaveTextContent('无匹配结果');
  });

  it('moves highlighted option with ArrowDown / ArrowUp and selects with Enter', () => {
    const homeSelect = vi.fn();
    const practiceSelect = vi.fn();
    const onClose = vi.fn();
    const localGroups: CommandPaletteGroup[] = [
      {
        label: '导航',
        items: [
          { id: 'home', label: '首页', onSelect: homeSelect },
          { id: 'practice', label: '练习', onSelect: practiceSelect },
        ],
      },
    ];
    render(<CommandPalette open onClose={onClose} groups={localGroups} />);
    const input = screen.getByRole('combobox');
    // initial highlight = 0 (首页)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(practiceSelect).toHaveBeenCalledTimes(1);
    expect(homeSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('selects highlighted item on click and renders shortcut as <kbd>', () => {
    const noteSelect = vi.fn();
    const onClose = vi.fn();
    const localGroups: CommandPaletteGroup[] = [
      {
        label: '工具',
        items: [{ id: 'notes', label: '笔记', shortcut: ['Ctrl', 'N'], onSelect: noteSelect }],
      },
    ];
    render(<CommandPalette open onClose={onClose} groups={localGroups} />);
    const opt = screen.getByRole('option', { name: /笔记/ });
    const kbds = opt.querySelectorAll('kbd');
    expect(kbds).toHaveLength(2);
    expect(kbds[0]).toHaveTextContent('Ctrl');
    expect(kbds[1]).toHaveTextContent('N');
    fireEvent.click(opt);
    expect(noteSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and locks body scroll while open', () => {
    document.body.style.overflow = 'auto';
    const onClose = vi.fn();
    const { rerender } = render(
      <CommandPalette open onClose={onClose} groups={groups} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<CommandPalette open={false} onClose={onClose} groups={groups} />);
    expect(document.body.style.overflow).toBe('auto');
  });
});
