import { describe, expect, it } from 'vitest';
import { router } from './index';

interface RouteNode {
  readonly path?: string;
  readonly children?: readonly RouteNode[];
}

function requireChildren(route: RouteNode | undefined): readonly RouteNode[] {
  expect(route).toBeDefined();
  expect(route?.children).toBeDefined();
  return route?.children ?? [];
}

describe('practice router placement', () => {
  it('keeps practice runtime routes outside the RootLayout shell', () => {
    const routes = (router as unknown as { readonly routes: readonly RouteNode[] }).routes;
    const authRoot = routes.find((route) => route.path === '/');
    const authChildren = requireChildren(authRoot);
    const shellRoute = authChildren.find((route) => route.path === '/');
    const shellChildren = requireChildren(shellRoute);

    const shellPaths = shellChildren.map((route) => route.path).filter(Boolean);
    expect(shellPaths).toContain('practice');
    expect(shellPaths).not.toContain('practice/sessions/:sessionId');
    expect(shellPaths).not.toContain('practice/ai-questions/generating');
    expect(shellPaths).not.toContain('practice/sessions/:sessionId/result');

    const fullscreenPaths = authChildren.map((route) => route.path).filter(Boolean);
    expect(fullscreenPaths).toEqual(expect.arrayContaining([
      'practice/ai-questions/generating',
      'practice/sessions/:sessionId',
      'practice/sessions/:sessionId/result',
    ]));
  });
});
