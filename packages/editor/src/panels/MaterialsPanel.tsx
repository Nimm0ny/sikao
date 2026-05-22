import { useEffect, useMemo, useRef } from 'react';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { MaterialsHeader } from '../pieces/MaterialsHeader';
import { MaterialTabs } from '../pieces/MaterialTabs';
import { MaterialReader } from '../pieces/MaterialReader';
import { MaterialOverview } from '../pieces/MaterialOverview';
import { HighlightRail } from './HighlightRail';
import { countMatches } from '@sikao/answer-engine/highlight/highlightRanges';

// MaterialsPanel — left pane composer.
//
// Layout:
//   - Standard (normal / collapsed): main column = header / tabs / reader.
//   - Wide: main column + 220px right-edge HighlightRail.
//   - Overview mode: tabs underline hides, body switches from MaterialReader
//     to MaterialOverview (2x2 cards). Tabs row stays visible so the user
//     can fall back to a reader.

export function MaterialsPanel() {
  const paper = useExamSession((s) => s.paper);
  const matIdx = useExamSession((s) => s.matIdx);
  const setMatIdx = useExamSession((s) => s.setMatIdx);
  const query = useExamSession((s) => s.query);
  const setQuery = useExamSession((s) => s.setQuery);
  const drawerOpen = useExamSession((s) => s.drawerOpen);
  const setDrawerOpen = useExamSession((s) => s.setDrawerOpen);
  const overview = useExamSession((s) => s.overview);
  const setOverview = useExamSession((s) => s.setOverview);
  const leftMode = useExamSession((s) => s.leftMode);
  const setLeftMode = useExamSession((s) => s.setLeftMode);
  const marking = useExamSession((s) => s.marking);
  const setMarking = useExamSession((s) => s.setMarking);
  const fontSize = useExamSession((s) => s.fontSize);
  const bumpFontSize = useExamSession((s) => s.bumpFontSize);
  const highlights = useExamSession((s) => s.highlights);
  const setHighlights = useExamSession((s) => s.setHighlights);
  const appendLineToScratch = useExamSession((s) => s.appendLineToScratch);
  const collectAllHighlightsToScratch = useExamSession((s) => s.collectAllHighlightsToScratch);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchFocusPulse = useExamSession((s) => s.searchFocusPulse);

  // ⌘F pulse from ExamShell — open the drawer first (so the input isn't
  // collapsed behind max-height: 0), then move focus + select for instant
  // type-over. Skip on the initial mount (pulse=0) so we don't yank focus
  // every time MaterialsPanel hydrates.
  useEffect(() => {
    if (searchFocusPulse === 0) return;
    setDrawerOpen(true);
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [searchFocusPulse, setDrawerOpen]);

  const bodies = useMemo(
    () => (paper ? paper.materials.map((m) => m.body) : []),
    [paper],
  );
  const matchCounts = useMemo(() => countMatches(bodies, query), [bodies, query]);
  const highlightCounts = useMemo(
    () => (paper ? paper.materials.map((m) => (highlights[m.id] ?? []).length) : []),
    [paper, highlights],
  );

  if (!paper) return null;
  const material = paper.materials[matIdx];
  const matHighlights = highlights[material.id] ?? [];
  const wide = leftMode === 'wide';

  const noMatchOnThisTab = Boolean(query.trim()) && (matchCounts[matIdx] ?? 0) === 0;
  const firstOtherHitIdx = noMatchOnThisTab
    ? matchCounts.findIndex((c, i) => i !== matIdx && c > 0)
    : -1;
  const otherMatchCount = matchCounts.reduce(
    (sum, c, i) => (i === matIdx ? sum : sum + c),
    0,
  );

  return (
    <div
      className="h-full bg-surface border-r border-line min-w-0 flex flex-row"
      data-testid="exam-materials-panel"
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <MaterialsHeader
          ref={searchInputRef}
          count={paper.materials.length}
          query={query}
          setQuery={setQuery}
          drawerOpen={drawerOpen}
          toggleDrawer={() => setDrawerOpen((v) => !v)}
          overview={overview}
          toggleOverview={() => setOverview((v) => !v)}
          wide={wide}
          toggleWide={() => setLeftMode(wide ? 'normal' : 'wide')}
        />
        <MaterialTabs
          materials={paper.materials}
          matIdx={matIdx}
          onSelect={(i) => {
            setMatIdx(i);
            setOverview(false);
          }}
          matchCounts={matchCounts}
          highlightCounts={highlightCounts}
          hideUnderline={overview}
        />
        {overview ? (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <MaterialOverview
              materials={paper.materials}
              matIdx={matIdx}
              matchCounts={matchCounts}
              highlightCounts={highlightCounts}
              onSelect={(i) => {
                setMatIdx(i);
                setOverview(false);
              }}
            />
          </div>
        ) : (
          <MaterialReader
            material={material}
            marking={{
              highlights: matHighlights,
              marking,
              toggle: () => setMarking((v) => !v),
              onAdd: (range) => {
                setHighlights((prev) => ({
                  ...prev,
                  [material.id]: [...(prev[material.id] ?? []), range],
                }));
              },
            }}
            search={{
              query,
              noMatchOnThisTab,
              otherMatchCount,
              firstOtherHitMaterial: firstOtherHitIdx >= 0 ? paper.materials[firstOtherHitIdx] : undefined,
              onJumpToFirstHit: firstOtherHitIdx >= 0 ? () => setMatIdx(firstOtherHitIdx) : undefined,
            }}
            nav={{
              matIdx,
              total: paper.materials.length,
              onJumpPrev: matIdx > 0 ? () => setMatIdx(matIdx - 1) : undefined,
              onJumpNext: matIdx < paper.materials.length - 1 ? () => setMatIdx(matIdx + 1) : undefined,
            }}
            typography={{
              fontSize,
              bumpFontSize,
            }}
          />
        )}
      </div>

      {wide && (
        <HighlightRail
          materials={paper.materials}
          highlights={highlights}
          onSendToScratch={appendLineToScratch}
          onCollectAll={collectAllHighlightsToScratch}
          onRemove={(matId, idx) => {
            setHighlights((prev) => {
              const list = prev[matId] ?? [];
              const next = { ...prev };
              const filtered = list.filter((_, i) => i !== idx);
              if (filtered.length === 0) delete next[matId];
              else next[matId] = filtered;
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
