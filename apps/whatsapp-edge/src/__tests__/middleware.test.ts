import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('middleware', () => {
  it('CORS headers present on GET /health response', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/health');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('CORS headers present on GET /webhook/whatsapp response', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/webhook/whatsapp');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('CORS headers present on POST /webhook/whatsapp response', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ object: 'whatsapp_business_account' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('CORS headers present on GET / (root) 404 response', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/');
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('OPTIONS request to /health returns CORS headers', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/health', { method: 'OPTIONS' });
    // OPTIONS may return 404 for unregistered routes
    // but CORS middleware should still add headers
    const origin = res.headers.get('access-control-allow-origin');
    expect(origin).toBe('*');
  });
});
