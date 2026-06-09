import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('webhook handler', () => {
  it('GET with valid verify token returns challenge', async () => {
    const { app } = await import('../index.js');
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=harness_verify_token&hub.challenge=12345',
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('12345');
  });

  it('GET with wrong verify token returns 403 with failure text', async () => {
    const { app } = await import('../index.js');
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=12345',
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe('Verification failed');
  });

  it('GET with missing mode returns 403 with failure text', async () => {
    const { app } = await import('../index.js');
    const res = await app.request(
      '/webhook/whatsapp?hub.verify_token=harness_verify_token&hub.challenge=12345',
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe('Verification failed');
  });

  it('GET with missing challenge returns 403 with failure text', async () => {
    const { app } = await import('../index.js');
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=harness_verify_token',
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe('Verification failed');
  });

  it('GET with no query params returns 403 with failure text', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/webhook/whatsapp');
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe('Verification failed');
  });

  it('GET with missing token returns 403', async () => {
    const { app } = await import('../index.js');
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=subscribe&hub.challenge=12345',
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe('Verification failed');
  });

  it('GET with wrong mode returns 403', async () => {
    const { app } = await import('../index.js');
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=unsubscribe&hub.verify_token=harness_verify_token&hub.challenge=12345',
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe('Verification failed');
  });
});
