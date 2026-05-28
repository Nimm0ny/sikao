/* @vitest-environment node */

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getPrototypeRoot,
  PROTOTYPE_ROUTE_PREFIX,
  resolvePrototypeFile,
} from './prototypeHost';

const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('prototypeHost', () => {
  it('resolves a valid prototype asset under .tmp_review', () => {
    const filePath = resolvePrototypeFile(
      APP_ROOT,
      `${PROTOTYPE_ROUTE_PREFIX}/out/Tab1-Home/Home%20v2.1.html`,
    );

    expect(filePath).toBe(resolve(APP_ROOT, '../../.tmp_review/out/Tab1-Home/Home v2.1.html'));
  });

  it('supports top-level .tmp_review assets outside out/', () => {
    const filePath = resolvePrototypeFile(
      APP_ROOT,
      `${PROTOTYPE_ROUTE_PREFIX}/home-frame.html`,
    );

    expect(filePath).toBe(resolve(APP_ROOT, '../../.tmp_review/home-frame.html'));
  });

  it('rejects path traversal outside .tmp_review', () => {
    const filePath = resolvePrototypeFile(
      APP_ROOT,
      `${PROTOTYPE_ROUTE_PREFIX}/../vite.config.ts`,
    );

    expect(filePath).toBeNull();
  });

  it('returns null for unrelated routes', () => {
    expect(resolvePrototypeFile(APP_ROOT, '/practice')).toBeNull();
  });

  it('computes the shared prototype root from app root', () => {
    expect(getPrototypeRoot(APP_ROOT)).toBe(resolve(APP_ROOT, '../../.tmp_review'));
  });
});
