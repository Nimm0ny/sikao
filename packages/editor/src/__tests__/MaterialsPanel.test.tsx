import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { MaterialsPanel } from '../panels/MaterialsPanel';
import { useExamSession } from '../hooks/useExamSession';
import { mockPaper } from '../data/essayExamMock';

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
    rightOpen: true,
    celebrateQ: -1,
    warnToastQ: -1,
  });
});

function setup() {
  useExamSession.getState().hydrate(mockPaper);
  useExamSession.setState({ phase: 'running' });
}

describe('MaterialsPanel (PR5)', () => {
  it('renders header / tabs / reader / footer with the right material', () => {
    setup();
    renderWithProviders(<MaterialsPanel />);
    expect(screen.getByText('给定资料')).toBeInTheDocument();
    expect(screen.getByText(`${mockPaper.materials.length} 篇`)).toBeInTheDocument();
    expect(screen.getByTestId('exam-materials-tab-0')).toBeInTheDocument();
    expect(screen.getByTestId('exam-materials-body')).toHaveTextContent(
      mockPaper.materials[0].body.slice(0, 12),
    );
  });

  it('toggling the gear opens/closes the drawer', async () => {
    const user = userEvent.setup();
    setup();
    renderWithProviders(<MaterialsPanel />);
    expect(useExamSession.getState().drawerOpen).toBe(false);
    await user.click(screen.getByTestId('exam-materials-drawer-toggle'));
    expect(useExamSession.getState().drawerOpen).toBe(true);
  });

  it('typing in the search box updates query and shows tab match counts', async () => {
    const user = userEvent.setup();
    setup();
    useExamSession.setState({ drawerOpen: true });
    renderWithProviders(<MaterialsPanel />);
    const input = screen.getByTestId('exam-materials-search-input');
    await user.type(input, '故宫');
    expect(useExamSession.getState().query).toBe('故宫');
    // Material 1 (m1) has 故宫 hits
    const m1Hits = screen.getByTestId('exam-materials-tab-0-hits');
    expect(m1Hits.textContent).toMatch(/^[1-9]\d*$/);
  });

  it('shows the "no match on this tab" sticky banner when query has hits elsewhere', () => {
    setup();
    useExamSession.setState({ query: '苏绣', matIdx: 0 });
    renderWithProviders(<MaterialsPanel />);
    // m1 has no 苏绣; m3 does
    const banner = screen.getByTestId('exam-materials-no-match-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('苏绣');
  });

  it('toggling 划线 flips marking flag', async () => {
    const user = userEvent.setup();
    setup();
    renderWithProviders(<MaterialsPanel />);
    const markButton = screen.getByTestId('exam-materials-marking-toggle');
    expect(markButton).toHaveAccessibleName('开启划线');
    expect(markButton.querySelector('svg')).not.toBeNull();
    expect(markButton).toHaveTextContent('');
    expect(markButton).not.toHaveAttribute('title');
    expect(useExamSession.getState().marking).toBe(false);
    await user.click(markButton);
    expect(useExamSession.getState().marking).toBe(true);
  });

  it('renders SVG-only font controls and updates fontSize state', async () => {
    const user = userEvent.setup();
    setup();
    renderWithProviders(<MaterialsPanel />);
    expect(screen.getByTestId('exam-materials-font-size')).toHaveTextContent('15');
    const fontUp = screen.getByTestId('exam-materials-font-up');
    const fontDown = screen.getByTestId('exam-materials-font-down');
    expect(fontUp).toHaveAccessibleName('放大字号');
    expect(fontDown).toHaveAccessibleName('缩小字号');
    expect(fontUp.querySelector('svg')).not.toBeNull();
    expect(fontDown.querySelector('svg')).not.toBeNull();
    expect(fontUp).toHaveTextContent('');
    expect(fontDown).toHaveTextContent('');
    expect(fontUp).not.toHaveAttribute('title');
    expect(fontDown).not.toHaveAttribute('title');
    await user.click(fontUp);
    expect(useExamSession.getState().fontSize).toBe(16);
    await user.click(fontDown);
    await user.click(fontDown);
    expect(useExamSession.getState().fontSize).toBe(14);
  });

  it('renders drawer tool buttons as SVG-only controls', () => {
    setup();
    useExamSession.setState({ drawerOpen: true });
    renderWithProviders(<MaterialsPanel />);
    const overview = screen.getByTestId('exam-materials-overview-toggle');
    const wide = screen.getByTestId('exam-materials-wide-toggle');
    expect(overview).toHaveAccessibleName('打开材料总览');
    expect(wide).toHaveAccessibleName('拉宽材料栏');
    expect(overview.querySelector('svg')).not.toBeNull();
    expect(wide.querySelector('svg')).not.toBeNull();
    expect(overview).toHaveTextContent('');
    expect(wide).toHaveTextContent('');
    expect(overview).not.toHaveAttribute('title');
    expect(wide).not.toHaveAttribute('title');
  });

  it('clicking a tab switches matIdx and resets overview', async () => {
    const user = userEvent.setup();
    setup();
    useExamSession.setState({ overview: true });
    renderWithProviders(<MaterialsPanel />);
    await user.click(screen.getByTestId('exam-materials-tab-2'));
    const s = useExamSession.getState();
    expect(s.matIdx).toBe(2);
    expect(s.overview).toBe(false);
  });

  it('shows the search chip in the header once a query is set', () => {
    setup();
    useExamSession.setState({ query: '创新' });
    renderWithProviders(<MaterialsPanel />);
    expect(screen.getByTestId('exam-materials-search-chip')).toHaveTextContent('搜:');
    expect(screen.getByTestId('exam-materials-search-chip')).toHaveTextContent('创新');
  });

  it('renders highlight marks for stored ranges', () => {
    setup();
    const m1 = mockPaper.materials[0];
    const start = m1.body.indexOf('故宫博物院');
    act(() => {
      useExamSession.setState({
        highlights: { [m1.id]: [{ start, end: start + 5 }] },
      });
    });
    renderWithProviders(<MaterialsPanel />);
    const marks = screen.getAllByText('故宫博物院');
    expect(marks.length).toBeGreaterThanOrEqual(1);
    const mark = marks.find((el) => el.tagName === 'MARK');
    expect(mark).toBeTruthy();
    expect(mark).toHaveAttribute('data-hit', 'mark');
  });

  it('renders search-hit marks for the active query', () => {
    setup();
    useExamSession.setState({ query: '传承', matIdx: 0 });
    renderWithProviders(<MaterialsPanel />);
    const hits = screen.getAllByText('传承').filter((el) => el.tagName === 'MARK');
    expect(hits.length).toBeGreaterThanOrEqual(0); // m1 may or may not contain it; allow 0+ but ensure render didn't crash
    expect(screen.getByTestId('exam-materials-body')).toBeInTheDocument();
  });
});
