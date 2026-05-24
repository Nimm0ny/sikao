import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { server } from '../mocks/server';
import { AiQuestionsGenerating } from './AiQuestionsGenerating';

function renderGenerating(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      { path: '/practice/ai-questions/generating', element: <AiQuestionsGenerating /> },
      { path: '/practice/sessions/:sessionId', element: <div data-testid="session-route-hit" /> },
    ],
    { initialEntries: [initialEntry] },
  );
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

describe('AiQuestionsGenerating', () => {
  it('submits a validated config exactly once in StrictMode and navigates to the session route', async () => {
    let generateCalls = 0;
    let createSessionCalls = 0;
    let generateBody: unknown = null;
    let createSessionBody: unknown = null;

    server.use(
      http.post('/api/v2/practice/ai-questions/generate', async ({ request }) => {
        generateCalls += 1;
        generateBody = await request.json();
        return HttpResponse.json({
          requestId: 901,
          status: 'partial_pool',
          durationMs: 1200,
          poolCount: 6,
          llmGeneratedCount: 4,
          questionIds: [9001, 9002],
        });
      }),
      http.post('/api/v2/practice/sessions', async ({ request }) => {
        createSessionCalls += 1;
        createSessionBody = await request.json();
        return HttpResponse.json({ id: 6001 });
      }),
    );

    renderGenerating('/practice/ai-questions/generating?type=xingce&categoryL1=logic&categoryL2=analysis&count=10&yearRange=recent_3&difficultyMin=0.2&difficultyMax=0.8&practiceMode=full_set&excludeDone=true&onlyWrong=false');

    expect(await screen.findByTestId('session-route-hit')).toBeInTheDocument();
    await waitFor(() => {
      expect(generateCalls).toBe(1);
      expect(createSessionCalls).toBe(1);
    });
    expect(generateBody).toEqual({
      config: {
        type: 'xingce',
        categoryL1: 'logic',
        categoryL2: 'analysis',
        yearRange: 'recent_3',
        difficultyRange: [0.2, 0.8],
        count: 10,
        excludeAlreadyDone: true,
        onlyWrong: false,
        practiceMode: 'full_set',
      },
    });
    expect(createSessionBody).toEqual({
      track: 'xingce',
      entryKind: 'ai_questions',
      mode: 'ai_generated',
      practiceMode: 'full_set',
      config: { aiRequestId: 901 },
    });
  });

  it('renders a failure state when generation fails', async () => {
    server.use(
      http.post('/api/v2/practice/ai-questions/generate', () =>
        HttpResponse.json({ detail: 'rate limited' }, { status: 503 }),
      ),
    );

    renderGenerating('/practice/ai-questions/generating?type=xingce&count=10&yearRange=recent_3&difficultyMin=0&difficultyMax=1&practiceMode=full_set&excludeDone=true&onlyWrong=false');

    expect(await screen.findByRole('button', { name: '返回练习中心' })).toBeInTheDocument();
    expect(screen.getByText('AxiosError: Request failed with status code 503')).toBeInTheDocument();
  });

  it('renders a controlled failure state for invalid query params without firing requests', async () => {
    let generateCalls = 0;
    let createSessionCalls = 0;

    server.use(
      http.post('/api/v2/practice/ai-questions/generate', () => {
        generateCalls += 1;
        return HttpResponse.json({ detail: 'unexpected call' }, { status: 500 });
      }),
      http.post('/api/v2/practice/sessions', () => {
        createSessionCalls += 1;
        return HttpResponse.json({ detail: 'unexpected call' }, { status: 500 });
      }),
    );

    renderGenerating('/practice/ai-questions/generating?type=xingce&count=foo&yearRange=recent_3&difficultyMin=0&difficultyMax=1&practiceMode=full_set&excludeDone=true&onlyWrong=false');

    expect(await screen.findByRole('button', { name: '返回练习中心' })).toBeInTheDocument();
    expect(screen.getByText('count must be a finite number')).toBeInTheDocument();
    await waitFor(() => {
      expect(generateCalls).toBe(0);
      expect(createSessionCalls).toBe(0);
    });
  });

  it('rejects empty numeric params instead of coercing them to zero', async () => {
    let generateCalls = 0;

    server.use(
      http.post('/api/v2/practice/ai-questions/generate', () => {
        generateCalls += 1;
        return HttpResponse.json({ detail: 'unexpected call' }, { status: 500 });
      }),
    );

    renderGenerating('/practice/ai-questions/generating?type=xingce&count=10&yearRange=recent_3&difficultyMin=&difficultyMax=1&practiceMode=full_set&excludeDone=true&onlyWrong=false');

    expect(await screen.findByRole('button', { name: '返回练习中心' })).toBeInTheDocument();
    expect(screen.getByText('difficultyMin must be a finite number')).toBeInTheDocument();
    await waitFor(() => {
      expect(generateCalls).toBe(0);
    });
  });
});
