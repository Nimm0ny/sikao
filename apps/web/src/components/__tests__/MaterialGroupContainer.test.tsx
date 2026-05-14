import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MaterialGroupContainer from '../questions/MaterialGroupContainer';
import type { MaterialGroup, MaterialGroupAssetV2 } from '@sikao/api-client/types/api';

function makeAsset(overrides: Partial<MaterialGroupAssetV2> = {}): MaterialGroupAssetV2 {
  return {
    id: 1,
    assetRole: 'material',
    mimeType: 'image/png',
    displayOrder: 1,
    url: '/api/v2/assets/material-groups/1',
    ...overrides,
  };
}

function makeGroup(overrides: Partial<MaterialGroup> = {}): MaterialGroup {
  return {
    materialGroupId: 'mg-1',
    blockId: 'b-1',
    title: '材料一',
    content: '<p>2023 年制造业增加值 18,400 亿元。</p>',
    groupKind: 'reading',
    questions: [],
    ...overrides,
  };
}

describe('MaterialGroupContainer', () => {
  it('renders sanitized material text', () => {
    render(<MaterialGroupContainer materialGroup={makeGroup()} />);
    expect(screen.getByText(/2023 年制造业/)).toBeInTheDocument();
  });

  it('omits asset block entirely when no assets', () => {
    render(<MaterialGroupContainer materialGroup={makeGroup({ assets: [] })} />);
    expect(screen.queryByTestId('material-assets')).not.toBeInTheDocument();
  });

  it('omits asset block when assets is undefined (back-compat with old payload)', () => {
    const group = makeGroup();
    delete (group as { assets?: unknown }).assets;
    render(<MaterialGroupContainer materialGroup={group} />);
    expect(screen.queryByTestId('material-assets')).not.toBeInTheDocument();
  });

  it('renders one img per image asset with src + alt + lazy', () => {
    const assets = [
      makeAsset({ id: 1, url: '/u/1', assetRole: '图1' }),
      makeAsset({ id: 2, url: '/u/2', assetRole: '图2' }),
    ];
    render(<MaterialGroupContainer materialGroup={makeGroup({ assets })} />);
    expect(screen.getByTestId('material-assets')).toBeInTheDocument();
    const img1 = screen.getByTestId('material-asset-1') as HTMLImageElement;
    const img2 = screen.getByTestId('material-asset-2') as HTMLImageElement;
    expect(img1.getAttribute('src')).toBe('/u/1');
    expect(img1.getAttribute('alt')).toBe('图1');
    expect(img1.getAttribute('loading')).toBe('lazy');
    expect(img2.getAttribute('src')).toBe('/u/2');
  });

  it('skips non-image assets (e.g. mimeType audio/*)', () => {
    const assets = [
      makeAsset({ id: 1, mimeType: 'image/jpeg' }),
      makeAsset({ id: 2, mimeType: 'audio/mp3' }),
      makeAsset({ id: 3, mimeType: 'image/png' }),
    ];
    render(<MaterialGroupContainer materialGroup={makeGroup({ assets })} />);
    expect(screen.getByTestId('material-asset-1')).toBeInTheDocument();
    expect(screen.queryByTestId('material-asset-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('material-asset-3')).toBeInTheDocument();
  });

  it('falls back to "材料图" alt when assetRole is empty', () => {
    const assets = [makeAsset({ id: 9, assetRole: '' })];
    render(<MaterialGroupContainer materialGroup={makeGroup({ assets })} />);
    const img = screen.getByTestId('material-asset-9') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('材料图');
  });
});
