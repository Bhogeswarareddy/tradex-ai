import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from '../lib/api/client';

describe('ApiClient 401 Refresh & Redirect Interceptor', () => {
  let client: ApiClient;
  let mockFetch: any;

  beforeEach(() => {
    client = new ApiClient('/api/v1');
    client.setAccessToken('expired-access-token');
    mockFetch = vi.fn();
    (globalThis as any).fetch = mockFetch;
  });

  it('triggers a single silent refresh on 401 and retries original request with new token', async () => {
    // 1st call: returns 401 Unauthorized
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({ detail: 'Token expired' }),
    });

    // 2nd call: POST /api/v1/auth/refresh returns 200 with new token
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ access_token: 'new-valid-token-xyz' }),
    });

    // 3rd call: retried original request with Bearer new-valid-token-xyz returns 200
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ items: [{ id: '1' }] }),
    });

    const res = await client.request<{ items: any[] }>('/analytics/market/top-products');
    
    expect(res.items).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );

    expect(client.getAccessToken()).toBe('new-valid-token-xyz');

    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/v1/analytics/market/top-products',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer new-valid-token-xyz',
        }),
      })
    );
  });

  it('handles refresh failure by clearing token and rejecting', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({ detail: 'Token expired' }),
    });

    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({ detail: 'Refresh cookie expired' }),
    });

    await expect(client.request('/orders')).rejects.toThrow(ApiError);
    expect(client.getAccessToken()).toBeNull();
  });
});
