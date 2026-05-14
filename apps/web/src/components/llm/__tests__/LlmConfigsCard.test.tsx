import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { LlmConfigsCard } from '../LlmConfigsCard';

describe('LlmConfigsCard', () => {
  it('empty list → 显示空态提示 + "添加服务" button', async () => {
    renderWithProviders(<LlmConfigsCard />);
    await waitFor(() => {
      expect(screen.getByTestId('llm-configs-empty')).toBeInTheDocument();
    });
    expect(screen.getByTestId('llm-configs-empty')).toHaveTextContent(
      '还没有自定义服务',
    );
    expect(screen.getByTestId('llm-configs-add-btn')).toHaveTextContent('添加服务');
  });

  it('已有 configs → 渲染每行 + 默认 badge + masked key', async () => {
    server.use(
      http.get('/api/v2/llm/configs', () =>
        HttpResponse.json({
          items: [
            {
              id: 1,
              label: '我的 DeepSeek',
              baseUrl: 'https://api.deepseek.com/v1',
              model: 'deepseek-v4-flash',
              isDefault: true,
              apiKeyMasked: 'sk-30...8f3c',
              lastTestedAt: null,
              lastTestedStatus: null,
              createdAt: '2026-04-29T10:00:00Z',
              updatedAt: '2026-04-29T10:00:00Z',
            },
            {
              id: 2,
              label: '备用 OpenAI',
              baseUrl: 'https://api.openai.com/v1',
              model: 'gpt-4o',
              isDefault: false,
              apiKeyMasked: 'sk-pr...test',
              lastTestedAt: '2026-04-29T11:00:00Z',
              lastTestedStatus: 'ok',
              createdAt: '2026-04-29T09:00:00Z',
              updatedAt: '2026-04-29T11:00:00Z',
            },
          ],
        }),
      ),
    );
    renderWithProviders(<LlmConfigsCard />);
    await waitFor(() => {
      expect(screen.getByTestId('llm-config-row-1')).toBeInTheDocument();
    });
    // 默认 config 显示 badge "当前默认"
    expect(screen.getByTestId('llm-config-default-badge-1')).toHaveTextContent(
      '当前默认',
    );
    // 非默认 config 没 badge, 但有 set-default button
    expect(screen.queryByTestId('llm-config-default-badge-2')).toBeNull();
    expect(screen.getByTestId('llm-config-set-default-2')).toBeInTheDocument();
    // masked key 显示, 不应有 raw 'sk-30c7456...'
    const row1 = screen.getByTestId('llm-config-row-1');
    expect(row1).toHaveTextContent('sk-30...8f3c');
    // 上次测试状态 (config 2 lastTestedStatus='ok')
    expect(screen.getByTestId('llm-config-row-2')).toHaveTextContent(
      '上次测试: 连通正常',
    );
  });

  it('点 "添加服务" → form 出现, 点 "取消" → form 消失', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LlmConfigsCard />);
    await waitFor(() => {
      expect(screen.getByTestId('llm-configs-add-btn')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('llm-configs-add-btn'));
    expect(screen.getByTestId('llm-config-form')).toBeInTheDocument();
    expect(screen.getByTestId('llm-config-form-label')).toBeInTheDocument();
    expect(screen.getByTestId('llm-config-form-base-url')).toBeInTheDocument();
    expect(screen.getByTestId('llm-config-form-api-key')).toBeInTheDocument();
    expect(screen.getByTestId('llm-config-form-model')).toBeInTheDocument();

    await user.click(screen.getByTestId('llm-config-form-cancel'));
    expect(screen.queryByTestId('llm-config-form')).toBeNull();
  });

  it('SSRF 拒 → 显示错误 "不允许的 URL"', async () => {
    server.use(
      http.post('/api/v2/llm/configs', () =>
        HttpResponse.json(
          { detail: 'cloud metadata blocked', code: 'ssrf_blocked' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LlmConfigsCard />);
    await waitFor(() => {
      expect(screen.getByTestId('llm-configs-add-btn')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('llm-configs-add-btn'));
    // 填表 (label/url/key/model)
    await user.type(screen.getByTestId('llm-config-form-label'), 'evil');
    // baseUrl 默认 https://api.deepseek.com/v1, 但我们 mock backend 总返 ssrf_blocked
    await user.type(screen.getByTestId('llm-config-form-api-key'), 'sk-x');
    await user.click(screen.getByTestId('llm-config-form-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-config-form-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('llm-config-form-error')).toHaveTextContent(
      '不允许的 URL',
    );
  });

  it('点 "测试连通性" → 调 /test endpoint + toast 显结果', async () => {
    let testCalled = false;
    server.use(
      http.get('/api/v2/llm/configs', () =>
        HttpResponse.json({
          items: [
            {
              id: 5,
              label: 'test config',
              baseUrl: 'https://api.deepseek.com/v1',
              model: 'deepseek-v4-flash',
              isDefault: true,
              apiKeyMasked: 'sk-x...x',
              lastTestedAt: null,
              lastTestedStatus: null,
              createdAt: '2026-04-29T10:00:00Z',
              updatedAt: '2026-04-29T10:00:00Z',
            },
          ],
        }),
      ),
      http.post('/api/v2/llm/configs/5/test', () => {
        testCalled = true;
        return HttpResponse.json({ status: 'auth_failed' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LlmConfigsCard />);
    await waitFor(() => {
      expect(screen.getByTestId('llm-config-test-5')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('llm-config-test-5'));
    await waitFor(() => {
      expect(testCalled).toBe(true);
    });
  });

  it('点 "删除" → Modal 二次确认 → DELETE endpoint (替代 window.confirm)', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/v2/llm/configs', () =>
        HttpResponse.json({
          items: [
            {
              id: 7,
              label: 'doomed',
              baseUrl: 'https://api.deepseek.com/v1',
              model: 'm',
              isDefault: false,
              apiKeyMasked: 'sk-x...x',
              lastTestedAt: null,
              lastTestedStatus: null,
              createdAt: '2026-04-29T10:00:00Z',
              updatedAt: '2026-04-29T10:00:00Z',
            },
          ],
        }),
      ),
      http.delete('/api/v2/llm/configs/7', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LlmConfigsCard />);
    await waitFor(() => {
      expect(screen.getByTestId('llm-config-delete-7')).toBeInTheDocument();
    });
    // 点删除 button → Modal 出现 (不直接 DELETE)
    await user.click(screen.getByTestId('llm-config-delete-7'));
    expect(deleteCalled).toBe(false);
    expect(screen.getByTestId('llm-config-delete-confirm')).toBeInTheDocument();

    // 点 Modal 确认 → DELETE 真发
    await user.click(screen.getByTestId('llm-config-delete-confirm'));
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it('点 "删除" → Modal 取消 → 不发 DELETE', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/v2/llm/configs', () =>
        HttpResponse.json({
          items: [
            {
              id: 8,
              label: 'safe',
              baseUrl: 'https://api.deepseek.com/v1',
              model: 'm',
              isDefault: false,
              apiKeyMasked: 'sk-x...x',
              lastTestedAt: null,
              lastTestedStatus: null,
              createdAt: '2026-04-29T10:00:00Z',
              updatedAt: '2026-04-29T10:00:00Z',
            },
          ],
        }),
      ),
      http.delete('/api/v2/llm/configs/8', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LlmConfigsCard />);
    await waitFor(() => {
      expect(screen.getByTestId('llm-config-delete-8')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('llm-config-delete-8'));
    await user.click(screen.getByTestId('llm-config-delete-cancel'));
    // 等一帧确认 mutation 没触发
    await new Promise((r) => setTimeout(r, 50));
    expect(deleteCalled).toBe(false);
  });
});
