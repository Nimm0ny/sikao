import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { MaterialsPanel } from '../panels/MaterialsPanel';
import { HighlightRail } from '../panels/HighlightRail';
import { MaterialOverview } from '../pieces/MaterialOverview';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { mockPaper } from '@sikao/test-utils/essayExamMock';

afterEach(() => {
  cleanup();
  useExamSession.setState({
    paper: null,
    phase: 'prestart',
    currentQ: 0,
    textsByQ: [],
    elapsedByQ: [],
    warned5min: {},
    scratch: '',
    highlights: {},
    leftMode: 'normal',
    leftWidthPx: 320,
    matIdx: 0,
    drawerOpen: false,
    overview: false,
    marking: false,
    query: '',
    fontSize: 15,
    gridFontSize: 18,
    rightOpen: true,
    celebrateQ: -1,
    warnToastQ: -1,
  });
});

function setup() {
  useExamSession.getState().hydrate(mockPaper);
  useExamSession.setState({ phase: 'running' });
}

describe('HighlightRail (PR7 F3.15)', () => {
  it('renders empty hint when no highlights stored', () => {
    render(
      <HighlightRail
        materials={mockPaper.materials}
        highlights={{}}
        onSendToScratch={() => {}}
        onCollectAll={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByTestId('exam-highlight-rail')).toBeInTheDocument();
    expect(screen.getByTestId('exam-highlight-rail-collect-btn')).toBeDisabled();
    expect(screen.getByText(/在材料中划线后/)).toBeInTheDocument();
  });

  it('groups items by material and labels with title', () => {
    const m1 = mockPaper.materials[0];
    const m3 = mockPaper.materials[2];
    render(
      <HighlightRail
        materials={mockPaper.materials}
        highlights={{
          [m1.id]: [{ start: 0, end: 8 }],
          [m3.id]: [{ start: 0, end: 6 }],
        }}
        onSendToScratch={() => {}}
        onCollectAll={() => {}}
        onRemove={() => {}}
      />,
    );
    const items = screen.getAllByText((_, el) => el?.getAttribute('data-testid')?.startsWith('exam-highlight-rail-item-') ?? false);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(m1.title)).toBeInTheDocument();
    expect(screen.getByText(m3.title)).toBeInTheDocument();
  });

  it('truncates long highlight text and triggers onSendToScratch on double-click', async () => {
    const user = userEvent.setup();
    let sent = '';
    render(
      <HighlightRail
        materials={mockPaper.materials}
        highlights={{ m1: [{ start: 0, end: 80 }] }}
        onSendToScratch={(line) => { sent = line; }}
        onCollectAll={() => {}}
        onRemove={() => {}}
      />,
    );
    const item = screen.getByTestId('exam-highlight-rail-item-m1-0');
    expect(item).toHaveTextContent('…');
    await user.dblClick(item);
    expect(sent).toContain('「');
    expect(sent).toContain('（资料一）');
  });

  it('removes a highlight when × is clicked', async () => {
    const user = userEvent.setup();
    let removedMid = '';
    let removedIdx = -1;
    render(
      <HighlightRail
        materials={mockPaper.materials}
        highlights={{ m1: [{ start: 0, end: 8 }, { start: 30, end: 40 }] }}
        onSendToScratch={() => {}}
        onCollectAll={() => {}}
        onRemove={(matId, idx) => {
          removedMid = matId;
          removedIdx = idx;
        }}
      />,
    );
    const xBtn = screen
      .getByTestId('exam-highlight-rail-item-m1-1')
      .querySelector('button');
    expect(xBtn).toBeTruthy();
    await user.click(xBtn!);
    expect(removedMid).toBe('m1');
    expect(removedIdx).toBe(1);
  });
});

describe('MaterialOverview (PR7 F3.17)', () => {
  it('renders one card per material with title / subtitle / preview', () => {
    render(
      <MaterialOverview
        materials={mockPaper.materials}
        matIdx={0}
        matchCounts={[0, 0, 0, 0]}
        highlightCounts={[0, 0, 0, 0]}
        onSelect={() => {}}
      />,
    );
    for (let i = 0; i < mockPaper.materials.length; i += 1) {
      expect(screen.getByTestId(`exam-materials-overview-card-${i}`)).toBeInTheDocument();
    }
    expect(screen.getByText('· 当前')).toBeInTheDocument();
  });

  it('shows hit + 划线 badges when counts > 0', () => {
    render(
      <MaterialOverview
        materials={mockPaper.materials}
        matIdx={0}
        matchCounts={[3, 0, 0, 0]}
        highlightCounts={[1, 2, 0, 0]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('命中 3')).toBeInTheDocument();
    expect(screen.getByText('划线 1')).toBeInTheDocument();
    expect(screen.getByText('划线 2')).toBeInTheDocument();
  });

  it('fires onSelect with the card index on click', async () => {
    const user = userEvent.setup();
    let selected = -1;
    render(
      <MaterialOverview
        materials={mockPaper.materials}
        matIdx={0}
        matchCounts={[0, 0, 0, 0]}
        highlightCounts={[0, 0, 0, 0]}
        onSelect={(i) => { selected = i; }}
      />,
    );
    await user.click(screen.getByTestId('exam-materials-overview-card-2'));
    expect(selected).toBe(2);
  });
});

describe('MaterialsPanel wide + overview integration', () => {
  it('shows the rail only in wide mode', () => {
    setup();
    const { rerender } = renderWithProviders(<MaterialsPanel />);
    expect(screen.queryByTestId('exam-highlight-rail')).not.toBeInTheDocument();
    act(() => {
      useExamSession.setState({ leftMode: 'wide' });
    });
    rerender(<MaterialsPanel />);
    expect(screen.getByTestId('exam-highlight-rail')).toBeInTheDocument();
  });

  it('overview replaces the reader and clicking a card switches matIdx + closes overview', async () => {
    const user = userEvent.setup();
    setup();
    useExamSession.setState({ overview: true });
    renderWithProviders(<MaterialsPanel />);
    expect(screen.getByTestId('exam-materials-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('exam-materials-body')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('exam-materials-overview-card-2'));
    const s = useExamSession.getState();
    expect(s.matIdx).toBe(2);
    expect(s.overview).toBe(false);
  });

  it('collect-all action concatenates all highlights into scratch grouped by material', () => {
    setup();
    useExamSession.setState({
      leftMode: 'wide',
      highlights: {
        m1: [{ start: 0, end: 4 }],
        m3: [{ start: 0, end: 4 }],
      },
    });
    renderWithProviders(<MaterialsPanel />);
    act(() => {
      useExamSession.getState().collectAllHighlightsToScratch();
    });
    const scratch = useExamSession.getState().scratch;
    expect(scratch).toContain('▼ 资料一');
    expect(scratch).toContain('▼ 资料三');
    expect(scratch).toContain('· 「');
  });
});
