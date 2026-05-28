/* @vitest-environment node */

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DESIGN_SYSTEM_FONT_ROUTE_PREFIX,
  getDesignSystemFontRoot,
  listDesignSystemFonts,
  resolveDesignSystemFontFile,
} from './designSystemFontHost';

const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('designSystemFontHost', () => {
  it('computes the shared font root from app root', () => {
    expect(getDesignSystemFontRoot(APP_ROOT)).toBe(
      resolve(APP_ROOT, '../../packages/design-system/src/fonts'),
    );
  });

  it('resolves a valid hosted font asset', () => {
    const filePath = resolveDesignSystemFontFile(
      APP_ROOT,
      `${DESIGN_SYSTEM_FONT_ROUTE_PREFIX}/dm-sans-latin-variable.woff2`,
    );

    expect(filePath).toBe(
      resolve(APP_ROOT, '../../packages/design-system/src/fonts/dm-sans-latin-variable.woff2'),
    );
  });

  it('rejects path traversal outside the font root', () => {
    const filePath = resolveDesignSystemFontFile(
      APP_ROOT,
      `${DESIGN_SYSTEM_FONT_ROUTE_PREFIX}/../tokens.css`,
    );

    expect(filePath).toBeNull();
  });

  it('lists self-hosted design-system fonts for build emission', () => {
    const files = listDesignSystemFonts(APP_ROOT);
    expect(files.some((file) => file.fileName === 'dm-sans-latin-variable.woff2')).toBe(true);
  });
});
