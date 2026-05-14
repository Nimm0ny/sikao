import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { ScratchPad } from '../ScratchPad';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { ESSAY_CLIP_MIME, type EssayClipDragPayload } from '@sikao/domain/shenlun/types';
import { __resetClipIdCounter } from '../lib/clipId';

function makeDropEvent(payload?: EssayClipDragPayload, plain?: string) {
  const store = new Map<string, string>();
  if (payload) store.set(ESSAY_CLIP_MIME, JSON.stringify(payload));
  if (plain) store.set('text/plain', plain);
  return {
    dataTransfer: {
      types: Array.from(store.keys()),
      getData: (t: string) => store.get(t) ?? '',
      dropEffect: 'none',
    },
  };
}

const samplePayload: EssayClipDragPayload = {
  matId: 'm1',
  start: 5,
  end: 11,
  text: '下放 137 项',
  sourceLabel: 'M2·段三',
};

beforeEach(() => {
  __resetClipIdCounter();
  // Reset SIKAO V3 store fields before each test.
  act(() => {
    useExamSession.setState({
      scratchClips: [],
      scratchNotes: [],
      citationsByQ: [],
    });
  });
});

describe('ScratchPad', () => {
  it('renders empty state when no clips / notes', () => {
    render(<ScratchPad />);
    expect(screen.getByTestId('essay-scratch-pad')).toBeInTheDocument();
    expect(screen.getByText(/拖入划线短语/)).toBeInTheDocument();
  });

  it('accepts a clip drop and adds to store', () => {
    render(<ScratchPad />);
    const pad = screen.getByTestId('essay-scratch-pad');
    fireEvent.drop(pad, makeDropEvent(samplePayload));
    const clips = useExamSession.getState().scratchClips;
    expect(clips).toHaveLength(1);
    expect(clips[0].text).toBe('下放 137 项');
    expect(clips[0].sourceLabel).toBe('M2·段三');
  });

  it('dedupes drops of the same matId+start+end', () => {
    render(<ScratchPad />);
    const pad = screen.getByTestId('essay-scratch-pad');
    fireEvent.drop(pad, makeDropEvent(samplePayload));
    fireEvent.drop(pad, makeDropEvent(samplePayload));
    expect(useExamSession.getState().scratchClips).toHaveLength(1);
  });

  it('does not add a clip on plain-text-only drop', () => {
    render(<ScratchPad />);
    const pad = screen.getByTestId('essay-scratch-pad');
    fireEvent.drop(pad, makeDropEvent(undefined, '「foo」'));
    expect(useExamSession.getState().scratchClips).toHaveLength(0);
  });

  it('toggles dropping state during dragover/drop', () => {
    render(<ScratchPad />);
    const pad = screen.getByTestId('essay-scratch-pad');
    fireEvent.dragOver(pad, makeDropEvent(samplePayload));
    expect(pad.getAttribute('data-dropping')).toBe('true');
    fireEvent.drop(pad, makeDropEvent(samplePayload));
    expect(pad.getAttribute('data-dropping')).toBe('false');
  });

  it('renders a ScratchClip card per clip in store', () => {
    act(() => {
      useExamSession.setState({
        scratchClips: [
          {
            id: 'clip-1',
            matId: 'm1',
            start: 0,
            end: 3,
            text: '片段一',
            sourceLabel: 'M1·段一',
            position: 0,
            addedAt: 0,
          },
        ],
      });
    });
    render(<ScratchPad />);
    expect(screen.getByTestId('essay-scratch-clip-clip-1')).toBeInTheDocument();
    expect(screen.getByText('片段一')).toBeInTheDocument();
  });

  it('add note button creates an empty ScratchNote in store', () => {
    render(<ScratchPad />);
    fireEvent.click(screen.getByTestId('essay-scratch-pad-add-note'));
    expect(useExamSession.getState().scratchNotes).toHaveLength(1);
  });

  it('does not silently accept malformed payload (fail-fast)', () => {
    // Malformed JSON in the custom MIME — ScratchPad's parsePayload throws.
    // React surfaces the throw as an unhandled error (test silences it via
    // a window error handler) but importantly the store does NOT pick up a
    // bogus clip — that's the user-visible fail-fast contract.
    const onError = vi.fn();
    window.addEventListener('error', onError);
    try {
      render(<ScratchPad />);
      const pad = screen.getByTestId('essay-scratch-pad');
      try {
        fireEvent.drop(pad, {
          dataTransfer: {
            types: [ESSAY_CLIP_MIME],
            getData: (t: string) =>
              t === ESSAY_CLIP_MIME ? '{not-json}' : '',
            dropEffect: 'none',
          },
        });
      } catch {
        // Vitest may surface React's handler throw synchronously in some
        // environments; either way we just want to assert no clip was added.
      }
      expect(useExamSession.getState().scratchClips).toHaveLength(0);
    } finally {
      window.removeEventListener('error', onError);
    }
  });
});
