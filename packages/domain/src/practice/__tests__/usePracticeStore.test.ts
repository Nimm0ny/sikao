import { beforeEach, describe, expect, it } from 'vitest';

import { usePracticeStore } from '../usePracticeStore';

describe('practice/usePracticeStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    usePracticeStore.getState().clear();
  });

  it('persists segment-local filters and sort to sessionStorage', () => {
    usePracticeStore.getState().patchFilters({ year: 2025, region: 'beijing' }, 'xingce');
    usePracticeStore.getState().setSort('recent', 'xingce');
    usePracticeStore.getState().setSegment('essay');
    usePracticeStore.getState().patchFilters({ examType: 'provincial' }, 'essay');

    const stored = JSON.parse(sessionStorage.getItem('sikao.practice.center-state') ?? '{}');
    expect(stored.segment).toBe('essay');
    expect(stored.filtersBySegment.xingce.year).toBe(2025);
    expect(stored.filtersBySegment.essay.examType).toBe('provincial');
    expect(stored.sortBySegment.xingce).toBe('recent');
  });

  it('hydrates and exposes active segment filters', () => {
    sessionStorage.setItem(
      'sikao.practice.center-state',
      JSON.stringify({
        segment: 'essay',
        filtersBySegment: {
          xingce: { year: 2024 },
          essay: { region: 'zhejiang' },
        },
        sortBySegment: {
          xingce: 'default',
          essay: 'year_desc',
        },
      }),
    );

    usePracticeStore.getState().hydrate();

    expect(usePracticeStore.getState().segment).toBe('essay');
    expect(usePracticeStore.getState().getActiveFilters()).toEqual({
      region: 'zhejiang',
    });
    expect(usePracticeStore.getState().getActiveSort()).toBe('year_desc');
  });
});
