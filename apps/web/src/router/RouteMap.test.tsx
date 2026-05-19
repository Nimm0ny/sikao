import { describe, expect, it } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { RedirectPreserveQuery } from './RedirectPreserveQuery';
import { LEGACY_QUERY_PRESERVE_REDIRECTS, ROUTE_MAP, buildPracticeCenterPath } from './RouteMap';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

describe('RouteMap', () => {
  it('builds canonical practice-center paths for both subjects', () => {
    expect(buildPracticeCenterPath('xingce', 'categories')).toBe('/practice/center/xingce/categories');
    expect(buildPracticeCenterPath('xingce', 'papers')).toBe('/practice/center/xingce/papers');
    expect(buildPracticeCenterPath('essay', 'categories')).toBe('/practice/center/essay/categories');
    expect(buildPracticeCenterPath('essay', 'papers')).toBe('/practice/center/essay/papers');
  });

  it('keeps auth and onboarding entry paths frozen for slice 8', () => {
    expect(ROUTE_MAP.login).toBe('/login');
    expect(ROUTE_MAP.dashboard).toBe('/dashboard');
    expect(ROUTE_MAP.studyOnboarding).toBe('/study/onboarding');
  });
});

describe('legacy query-preserve redirects', () => {
  it.each(Object.values(LEGACY_QUERY_PRESERVE_REDIRECTS))(
    'redirects $from to $to without dropping search params',
    async ({ from, to }) => {
      renderWithProviders(
        <Routes>
          <Route path={from} element={<RedirectPreserveQuery to={to} />} />
          <Route path={to} element={<LocationProbe />} />
        </Routes>,
        {
          initialEntries: [`${from}?region=guangdong&year=2025&paperType=mock&page=2`],
        },
      );

      expect(await screen.findByTestId('location-probe')).toHaveTextContent(
        `${to}?region=guangdong&year=2025&paperType=mock&page=2`,
      );
    },
  );
});
