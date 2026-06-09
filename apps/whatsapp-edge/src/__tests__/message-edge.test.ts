import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const originalFetch = globalThis.fetch;
const originalAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
  process.env.WHATSAPP_ACCESS_TOKEN = 'test_access_token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test_phone_id';
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  process.env.WHATSAPP_ACCESS_TOKEN = originalAccessToken;
  process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
});

describe('spoke command edge cases', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('/spoke with no space (like /spokegoal) extracts goal correctly', async () => {
    const { app } = await import('../index.js');
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15551234567', phone_number_id: '456' },
            contacts: [{ profile: { name: 'John' }, wa_id: '15559876543' }],
            messages: [{ from: '15559876543', id: 'msg1', timestamp: '1234567890', type: 'text', text: { body: '/spokegoal' } }],
          },
          field: 'messages',
        }],
      }],
    };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] creating task: "goal" (from 15559876543)',
    );
  });

  it('/spoke with multiple spaces uses correct regex semantics', async () => {
    const { app } = await import('../index.js');
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15551234567', phone_number_id: '456' },
            contacts: [{ profile: { name: 'John' }, wa_id: '15559876543' }],
            messages: [{ from: '15559876543', id: 'msg1', timestamp: '1234567890', type: 'text', text: { body: '/spoke   goal' } }],
          },
          field: 'messages',
        }],
      }],
    };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] creating task: "goal" (from 15559876543)',
    );
  });

  it('/spoke with trailing spaces checks trim behavior', async () => {
    const { app } = await import('../index.js');
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15551234567', phone_number_id: '456' },
            contacts: [{ profile: { name: 'John' }, wa_id: '15559876543' }],
            messages: [{ from: '15559876543', id: 'msg1', timestamp: '1234567890', type: 'text', text: { body: '/spoke goal   ' } }],
          },
          field: 'messages',
        }],
      }],
    };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] creating task: "goal" (from 15559876543)',
    );
  });

  it('contact with null profile still works (fails if ?.name is removed)', async () => {
    const { app } = await import('../index.js');
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15551234567', phone_number_id: '456' },
            contacts: [{ profile: { name: 'John' }, wa_id: '15559876543' }],
            messages: [{ from: '15559876543', id: 'msg1', timestamp: '1234567890', type: 'text', text: { body: 'Hello' } }],
          },
          field: 'messages',
        }],
      }],
    };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body as string);
    expect(fetchBody.text.body).toContain('John');
  });

  it('contact found but profile name missing uses Unknown (kills ?.name removal)', async () => {
    const { app } = await import('../index.js');
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15551234567', phone_number_id: '456' },
            contacts: [{ wa_id: '15559876543' }],
            messages: [{ from: '15559876543', id: 'msg1', timestamp: '1234567890', type: 'text', text: { body: 'Hello' } }],
          },
          field: 'messages',
        }],
      }],
    };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body as string);
    expect(fetchBody.text.body).toContain('Unknown');
  });
});
