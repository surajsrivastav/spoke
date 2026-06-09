import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const originalFetch = globalThis.fetch;
const originalAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalAccessToken !== undefined) {
    process.env.WHATSAPP_ACCESS_TOKEN = originalAccessToken;
  } else {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
  }
  if (originalPhoneNumberId !== undefined) {
    process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
  } else {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  }
});

const makeBody = () => ({
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
});

describe('env defaults when WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not set', () => {
  it('uses empty string defaults for token and phone number ID in fetch call', async () => {
    const { app } = await import('../index.js');

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(makeBody()),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const expectedUrl = 'https://graph.facebook.com/v20.0//messages';
    expect(call[0]).toBe(expectedUrl);
    expect(call[1].headers).toEqual({
      Authorization: 'Bearer ',
      'Content-Type': 'application/json',
    });
  });
});
