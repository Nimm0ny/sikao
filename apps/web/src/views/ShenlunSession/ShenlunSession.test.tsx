import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import ShenlunSession from './ShenlunSession';

function renderAt(entry: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/practice/essay/session/:sessionId" element={<ShenlunSession />} />
      <Route path="/essay/specialty/:questionId" element={<div data-testid="essay-specialty-destination" />} />
      <Route path="/essay/history" element={<div data-testid="essay-history-destination" />} />
    </Routes>,
    { initialEntries: [entry] },
  );
}

describe('ShenlunSession legacy redirect', () => {
  it('redirects legacy session links to the real essay specialty route', async () => {
    renderAt('/practice/essay/session/123');
    expect(await screen.findByTestId('essay-specialty-destination')).toBeInTheDocument();
  });

  it('redirects missing/empty session ids to essay history fallback', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/practice/essay/session" element={<ShenlunSession />} />
        <Route path="/essay/history" element={<div data-testid="essay-history-destination" />} />
      </Routes>,
      { initialEntries: ['/practice/essay/session'] },
    );
    expect(await screen.findByTestId('essay-history-destination')).toBeInTheDocument();
  });
});
