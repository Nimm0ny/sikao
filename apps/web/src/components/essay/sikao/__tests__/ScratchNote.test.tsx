import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ScratchNote } from '../ScratchNote';

const note = {
  id: 'n1',
  body: '初始内容',
  position: 0,
  addedAt: 0,
};

describe('ScratchNote', () => {
  it('renders the body text', () => {
    render(<ScratchNote note={note} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('初始内容')).toBeInTheDocument();
  });

  it('input fires onChange with new text', () => {
    const onChange = vi.fn();
    render(<ScratchNote note={note} onChange={onChange} onRemove={vi.fn()} />);
    const body = screen.getByTestId('essay-scratch-note-body-n1');
    body.textContent = '新内容';
    fireEvent.input(body);
    expect(onChange).toHaveBeenCalledWith('n1', '新内容');
  });

  it('remove button fires onRemove(id)', () => {
    const onRemove = vi.fn();
    render(<ScratchNote note={note} onChange={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByTestId('essay-scratch-note-remove-n1'));
    expect(onRemove).toHaveBeenCalledWith('n1');
  });

  it('contentEditable + aria-label "便签内容"', () => {
    render(<ScratchNote note={note} onChange={vi.fn()} onRemove={vi.fn()} />);
    const body = screen.getByTestId('essay-scratch-note-body-n1');
    expect(body.getAttribute('contenteditable')).toBe('true');
    expect(body.getAttribute('aria-label')).toBe('便签内容');
  });
});
