import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnswerCardPanel } from './AnswerCardPanel';

describe('AnswerCardPanel', () => {
  it('open=false renders neither panel nor scrim', () => {
    render(
      <AnswerCardPanel open={false} onClose={vi.fn()} header={<div>HEADER</div>}>
        <div>BODY</div>
      </AnswerCardPanel>,
    );
    expect(screen.queryByTestId('answer-card-panel')).toBeNull();
    expect(screen.queryByTestId('answer-card-panel-scrim')).toBeNull();
  });

  it('open=true renders header + body + footer + scrim', () => {
    render(
      <AnswerCardPanel
        open
        onClose={vi.fn()}
        header={<div data-testid="hdr">HEADER</div>}
        footer={<div data-testid="ftr">FOOTER</div>}
      >
        <div data-testid="bod">BODY</div>
      </AnswerCardPanel>,
    );
    expect(screen.getByTestId('answer-card-panel')).toBeInTheDocument();
    expect(screen.getByTestId('answer-card-panel-scrim')).toBeInTheDocument();
    expect(screen.getByTestId('hdr')).toBeInTheDocument();
    expect(screen.getByTestId('bod')).toBeInTheDocument();
    expect(screen.getByTestId('ftr')).toBeInTheDocument();
    expect(screen.getByTestId('answer-card-panel-close')).toBeInTheDocument();
  });

  it('close button fires onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AnswerCardPanel open onClose={onClose} header={<div>H</div>}>
        <div>B</div>
      </AnswerCardPanel>,
    );
    await user.click(screen.getByTestId('answer-card-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('scrim click fires onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AnswerCardPanel open onClose={onClose} header={<div>H</div>}>
        <div>B</div>
      </AnswerCardPanel>,
    );
    await user.click(screen.getByTestId('answer-card-panel-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key fires onClose when open', () => {
    const onClose = vi.fn();
    render(
      <AnswerCardPanel open onClose={onClose} header={<div>H</div>}>
        <div>B</div>
      </AnswerCardPanel>,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key does not fire onClose when closed', () => {
    const onClose = vi.fn();
    render(
      <AnswerCardPanel open={false} onClose={onClose} header={<div>H</div>}>
        <div>B</div>
      </AnswerCardPanel>,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closeOnEsc=false ignores Escape', () => {
    const onClose = vi.fn();
    render(
      <AnswerCardPanel open onClose={onClose} closeOnEsc={false} header={<div>H</div>}>
        <div>B</div>
      </AnswerCardPanel>,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
