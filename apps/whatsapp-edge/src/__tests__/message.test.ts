import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

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

const baseBody = {
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

function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

describe('incomingMessage handler', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('POST with valid text message calls fetch with correct URL, method, headers, body', async () => {
    const { app } = await import('../index.js');

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(baseBody),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);

    const expectedUrl = 'https://graph.facebook.com/v20.0/test_phone_id/messages';
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(call[0]).toBe(expectedUrl);
    expect(call[1].method).toBe('POST');
    expect(call[1].headers).toEqual({
      Authorization: 'Bearer test_access_token',
      'Content-Type': 'application/json',
    });
    const fetchBody = JSON.parse(call[1].body as string);
    expect(fetchBody.messaging_product).toBe('whatsapp');
    expect(fetchBody.recipient_type).toBe('individual');
    expect(fetchBody.to).toBe('15559876543');
    expect(fetchBody.type).toBe('text');
    expect(fetchBody.text.body).toBe('Thanks John! I received: "Hello"');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] message from John (15559876543): Hello',
    );
  });

  it('POST with @harness command calls fetch and logs task creation with correct goal', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '@harness create a task';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const fetchBody = JSON.parse(call[1].body as string);
    expect(fetchBody.text.body).toContain('Thanks John');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] creating task: "create a task" (from 15559876543)',
    );
  });

  it('POST with /harness command returns 200 and logs task creation', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '/harness create a task';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] creating task: "create a task" (from 15559876543)',
    );
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('POST with empty text body does not call fetch (body is falsy)', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text = { body: '' };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST with empty messages array does not call fetch', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages = [];

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST with null messages array does not call fetch', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages = null;

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST with status-only webhook does not call fetch', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
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
                  { id: 'status1', status: 'read', timestamp: '1234567890', recipient_id: '15559876543' },
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
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST with missing entry array does not call fetch', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    const body = { object: 'whatsapp_business_account' };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST with null entry array does not call fetch', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    const body = { object: 'whatsapp_business_account', entry: null };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST with missing changes array does not call fetch', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    const body = { object: 'whatsapp_business_account', entry: [{ id: '123' }] };

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST with empty contacts array uses Unknown as name', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.contacts = [];

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body as string);
    expect(fetchBody.text.body).toContain('Unknown');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] message from Unknown (15559876543): Hello',
    );
  });

  it('POST with non-matching contact wa_id uses Unknown as name', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.contacts[0].wa_id = 'different_id';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body as string);
    expect(fetchBody.text.body).toContain('Unknown');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] message from Unknown (15559876543): Hello',
    );
  });

  it('POST with undefined contacts uses Unknown as name', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    delete body.entry[0].changes[0].value.contacts;

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body as string);
    expect(fetchBody.text.body).toContain('Unknown');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] message from Unknown (15559876543): Hello',
    );
  });

  it('POST with interactive type message does not call fetch', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].type = 'interactive';
    delete body.entry[0].changes[0].value.messages[0].text;

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST with message that has no text property does not call fetch', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    const body = deepCopy(baseBody);
    delete body.entry[0].changes[0].value.messages[0].text;

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('POST trims whitespace from message text', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '  Hello World  ';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body as string);
    expect(fetchBody.text.body).toContain('Hello World');
    expect(fetchBody.text.body).not.toContain('  ');
  });

  it('POST with harness command extracts goal correctly with trimming', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '  @harness   my goal here  ';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] creating task: "my goal here" (from 15559876543)',
    );
  });

  it('handles message where contact name matches exactly (not Unknown)', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(baseBody),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body as string);
    expect(fetchBody.text.body).toContain('John');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] message from John (15559876543): Hello',
    );
  });

  it('POST with whitespace-only text still calls fetch (body.trim() becomes empty but text is truthy)', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '   ';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('POST with @HARNESS uppercase does not create task (startsWith is case-sensitive)', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '@HARNESS do something';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    expect(consoleSpy).not.toHaveBeenCalledWith(
      '[whatsapp] creating task: "do something" (from 15559876543)',
    );
  });

  it('POST with @harness followed by extra whitespace still extracts goal correctly', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '@harness     implement feature x';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] creating task: "implement feature x" (from 15559876543)',
    );
  });

  it('POST with /harness followed by multiple spaces extracts goal correctly', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '/harness     implement feature x';

    const res = await app.request('/webhook/whatsapp', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[whatsapp] creating task: "implement feature x" (from 15559876543)',
    );
  });

  it('POST with @harness and no space after still extracts goal correctly', async () => {
    const { app } = await import('../index.js');
    vi.mocked(globalThis.fetch).mockClear();
    consoleSpy.mockClear();
    const body = deepCopy(baseBody);
    body.entry[0].changes[0].value.messages[0].text.body = '@harnessgoal';

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
});
