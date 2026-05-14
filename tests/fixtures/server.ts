import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// MSW v2 setup for vitest. setupTests.ts hooks lifecycle:
//   beforeAll → server.listen()
//   afterEach → server.resetHandlers()
//   afterAll  → server.close()
//
// In-test override pattern:
//   server.use(http.get('/api/v2/papers', () => HttpResponse.error()));
export const server = setupServer(...handlers);
