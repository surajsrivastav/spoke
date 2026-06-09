import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('WhatsApp webhook server', () => {
  it('GET /health returns ok', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET / returns 404', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/');
    expect(res.status).toBe(404);
  });

  it('GET /unknown returns 404', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/unknown');
    expect(res.status).toBe(404);
  });

  it('GET /webhook (without subpath) returns 404', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/webhook');
    expect(res.status).toBe(404);
  });

  it('response includes CORS headers', async () => {
    const { app } = await import('../index.js');
    const res = await app.request('/health');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('GET /webhook with valid verify token returns challenge', async () => {
    const { app } = await import('../index.js');
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=harness_verify_token&hub.challenge=12345',
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('12345');
  });

  it('GET /webhook with wrong verify token returns 403', async () => {
    const { app } = await import('../index.js');
    const res = await app.request(
      '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=12345',
    );
    expect(res.status).toBe(403);
  });

  it('POST /webhook processes incoming text messages', async () => {
    const { app } = await import('../index.js');
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15551234567', phone_number_id: '456' },
                contacts: [{ profile: { name: 'John' }, wa_id: '15559876543' }],
                messages: [
                  {
                    from: '15559876543',
                    id: 'msg1',
                    timestamp: '1234567890',
                    type: 'text',
                    text: { body: 'Hello' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: 'ok' });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalled();
  });

  it('POST /webhook with non-message events returns 200', async () => {
    const { app } = await import('../index.js');
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15551234567', phone_number_id: '456' },
                statuses: [
                  {
                    id: 'status1',
                    status: 'read',
                    timestamp: '1234567890',
                    recipient_id: '15559876543',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: 'ok' });
  });
});
