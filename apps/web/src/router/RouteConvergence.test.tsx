import type { ReactNode } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Outlet,
  RouterProvider,
  createMemoryRouter,
} from 'react-router-dom';

import { useAuthStore } from '@sikao/domain/auth/useAuthStore';

vi.mock('@/layouts/AppShell', () => ({
  AppShell: ({ children }: { readonly children?: ReactNode }) => (
    <div data-testid="route-app-shell">{children ?? <Outlet />}</div>
  ),
}));

vi.mock('@/views/Dashboard', () => ({
  default: () => <div data-testid="route-dashboard-home">dashboard home</div>,
}));

vi.mock('@/views/PracticeCenter', () => ({
  default: () => <div data-testid="route-practice-center">practice center</div>,
}));

vi.mock('@/views/CategoryTree', () => ({
  default: () => <div data-testid="route-practice-categories">practice categories</div>,
}));

vi.mock('@/views/WrongBook', () => ({
  default: () => <div data-testid="route-review-home">review home</div>,
}));

vi.mock('@/views/WrongQuestionDetailView', () => ({
  default: () => <div data-testid="route-review-detail">review detail</div>,
}));

vi.mock('@/views/WrongQuestionRedoView', () => ({
  default: () => <div data-testid="route-review-redo">review redo</div>,
}));

vi.mock('@/views/SmartReviewView', () => ({
  default: () => <div data-testid="route-review-smart">review smart</div>,
}));

vi.mock('@/views/Profile', () => ({
  default: () => <div data-testid="route-profile">profile</div>,
}));

vi.mock('@/views/ProfileLearning', () => ({
  default: () => <div data-testid="route-profile-learning">profile learning</div>,
}));

vi.mock('@/views/ProfileRecords', () => ({
  default: () => <div data-testid="route-profile-records">profile records</div>,
}));

vi.mock('@/views/NotesHome', () => ({
  default: () => <div data-testid="route-notes">notes</div>,
}));

vi.mock('@/views/auth/Login', () => ({
  default: () => <div data-testid="route-login">login</div>,
}));

vi.mock('@/views/marketing', () => ({
  Marketing: () => <div data-testid="route-marketing">marketing</div>,
  Privacy: () => <div data-testid="route-privacy">privacy</div>,
  Terms: () => <div data-testid="route-terms">terms</div>,
  Cookies: () => <div data-testid="route-cookies">cookies</div>,
}));

import { appRoutes } from './index';

function renderRouter(initialEntries: readonly string[]) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [...initialEntries],
  });
  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

describe('Home route convergence', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('renders marketing at root for guests', async () => {
    renderRouter(['/']);
    expect(await screen.findByTestId('route-marketing')).toBeInTheDocument();
  });

  it('treats guest legacy home aliases as marketing entrypoints', async () => {
    const appEntry = renderRouter(['/app']);
    expect(await screen.findByTestId('route-marketing')).toBeInTheDocument();
    expect(appEntry.router.state.location.pathname).toBe('/');
    appEntry.unmount();

    const todayEntry = renderRouter(['/study/today']);
    expect(await screen.findByTestId('route-marketing')).toBeInTheDocument();
    expect(todayEntry.router.state.location.pathname).toBe('/');
  });

  it('rewrites protected legacy aliases before sending guests to login', async () => {
    const dashboardEntry = renderRouter(['/dashboard']);
    expect(await screen.findByTestId('route-login')).toBeInTheDocument();
    expect(dashboardEntry.router.state.location.pathname).toBe('/login');
    expect(dashboardEntry.router.state.location.state?.from).toBe('/profile/learning');
    dashboardEntry.unmount();

    const practiceEntry = renderRouter(['/practice/center']);
    expect(await screen.findByTestId('route-login')).toBeInTheDocument();
    expect(practiceEntry.router.state.location.pathname).toBe('/login');
    expect(practiceEntry.router.state.location.state?.from).toBe('/practice');
    practiceEntry.unmount();

    const reviewEntry = renderRouter(['/wrong-book/12']);
    expect(await screen.findByTestId('route-login')).toBeInTheDocument();
    expect(reviewEntry.router.state.location.pathname).toBe('/login');
    expect(reviewEntry.router.state.location.state?.from).toBe('/review/items/12');
  });

  it('renders the dashboard host at root for authenticated users', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });

    const { router } = renderRouter(['/']);

    expect(await screen.findByTestId('route-dashboard-home')).toBeInTheDocument();
    expect(screen.getByTestId('route-app-shell')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('redirects legacy app entrypoints into the canonical home route', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });

    const appEntry = renderRouter(['/app']);
    expect(await screen.findByTestId('route-dashboard-home')).toBeInTheDocument();
    expect(appEntry.router.state.location.pathname).toBe('/');
    appEntry.unmount();

    const todayEntry = renderRouter(['/study/today']);
    expect(await screen.findByTestId('route-dashboard-home')).toBeInTheDocument();
    expect(todayEntry.router.state.location.pathname).toBe('/');
  });

  it('redirects dashboard and me to the new profile subpages', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });

    const dashboardEntry = renderRouter(['/dashboard']);
    expect(await screen.findByTestId('route-profile-learning')).toBeInTheDocument();
    expect(dashboardEntry.router.state.location.pathname).toBe('/profile/learning');
    dashboardEntry.unmount();

    const meEntry = renderRouter(['/me']);
    expect(await screen.findByTestId('route-profile')).toBeInTheDocument();
    expect(meEntry.router.state.location.pathname).toBe('/profile');
    meEntry.unmount();

    const planEntry = renderRouter(['/plan']);
    expect(await screen.findByTestId('route-dashboard-home')).toBeInTheDocument();
    expect(planEntry.router.state.location.pathname).toBe('/');
    planEntry.unmount();

    const progressEntry = renderRouter(['/progress']);
    expect(await screen.findByTestId('route-profile-learning')).toBeInTheDocument();
    expect(progressEntry.router.state.location.pathname).toBe('/profile/learning');
  });

  it('redirects practice and review legacy families to canonical paths', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'tester', displayName: 'Tester' },
    });

    const practiceEntry = renderRouter(['/practice/center']);
    expect(await screen.findByTestId('route-practice-center')).toBeInTheDocument();
    expect(practiceEntry.router.state.location.pathname).toBe('/practice');
    practiceEntry.unmount();

    const nestedPracticeEntry = renderRouter(['/practice/center/xingce/categories']);
    expect(await screen.findByTestId('route-practice-categories')).toBeInTheDocument();
    expect(nestedPracticeEntry.router.state.location.pathname).toBe('/practice/xingce/categories');
    nestedPracticeEntry.unmount();

    const reviewEntry = renderRouter(['/wrong-book']);
    expect(await screen.findByTestId('route-review-home')).toBeInTheDocument();
    expect(reviewEntry.router.state.location.pathname).toBe('/review');
    reviewEntry.unmount();

    const smartEntry = renderRouter(['/wrong-book/smart-review']);
    expect(await screen.findByTestId('route-review-smart')).toBeInTheDocument();
    expect(smartEntry.router.state.location.pathname).toBe('/review/smart');
    smartEntry.unmount();

    const detailLanding = renderRouter(['/wrong-book/12']);
    expect(await screen.findByTestId('route-review-detail')).toBeInTheDocument();
    expect(detailLanding.router.state.location.pathname).toBe('/review/items/12');
    detailLanding.unmount();

    const detailEntry = renderRouter(['/wrong-book/12/redo']);
    expect(await screen.findByTestId('route-review-redo')).toBeInTheDocument();
    expect(detailEntry.router.state.location.pathname).toBe('/review/items/12/redo');
  });
});
