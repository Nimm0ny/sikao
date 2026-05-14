import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MaterialClip } from '../MaterialClip';
import { ESSAY_CLIP_MIME } from '@sikao/domain/shenlun/types';

function makeDataTransfer() {
  const store = new Map<string, string>();
  return {
    setData: vi.fn((type: string, value: string) => {
      store.set(type, value);
    }),
    getData: (type: string) => store.get(type) ?? '',
    types: [] as string[],
    effectAllowed: 'none',
    _store: store,
  };
}

describe('MaterialClip', () => {
  it('renders the clipped phrase as content', () => {
    render(
      <MaterialClip
        matId="m1"
        start={0}
        end={3}
        text="片段"
        sourceLabel="M1·段一"
      />,
    );
    expect(screen.getByText('片段')).toBeInTheDocument();
  });

  it('renders provided children instead of plain text', () => {
    render(
      <MaterialClip
        matId="m1"
        start={0}
        end={3}
        text="abc"
        sourceLabel="M1·段一"
      >
        <span>child-content</span>
      </MaterialClip>,
    );
    expect(screen.getByText('child-content')).toBeInTheDocument();
  });

  it('writes EssayClipDragPayload + text/plain on dragstart', () => {
    render(
      <MaterialClip
        matId="m2"
        start={5}
        end={11}
        text="下放 137 项审批"
        sourceLabel="M2·段三"
      />,
    );
    const span = screen.getByTestId('essay-material-clip-m2-5');
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(span, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      '「下放 137 项审批」',
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      ESSAY_CLIP_MIME,
      expect.any(String),
    );
    const payloadRaw = dataTransfer._store.get(ESSAY_CLIP_MIME);
    expect(payloadRaw).toBeDefined();
    const payload = JSON.parse(payloadRaw ?? '{}');
    expect(payload).toMatchObject({
      matId: 'm2',
      start: 5,
      end: 11,
      text: '下放 137 项审批',
      sourceLabel: 'M2·段三',
    });
  });

  it('exposes data-source-label for parent introspection', () => {
    render(
      <MaterialClip
        matId="m1"
        start={0}
        end={2}
        text="ab"
        sourceLabel="M1·段二"
      />,
    );
    const span = screen.getByTestId('essay-material-clip-m1-0');
    expect(span.getAttribute('data-source-label')).toBe('M1·段二');
  });

  it('does not use a native title tooltip', () => {
    render(
      <MaterialClip
        matId="m1"
        start={0}
        end={2}
        text="ab"
        sourceLabel="M1·段一"
      />,
    );
    const span = screen.getByTestId('essay-material-clip-m1-0');
    expect(span).not.toHaveAttribute('title');
    expect(span).toHaveAttribute('data-source-label', 'M1·段一');
  });
});
