import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockTaskCreate, mockPostMessage } = vi.hoisted(() => ({
  mockTaskCreate: vi.fn(),
  mockPostMessage: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  default: { randomUUID: () => 'mock-uuid' },
  randomUUID: () => 'mock-uuid',
}));

vi.mock('@harness/db', () => ({
  prisma: { task: { create: mockTaskCreate } },
}));

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
  })),
}));

vi.mock('@harness/shared', () => ({
  env: { SLACK_BOT_TOKEN: 'test_bot_token' },
}));

import slackEvent from '../handlers/slack-event.js';

const mentionEvent = (overrides: Record<string, unknown> = {}) => ({
  type: 'event_callback',
  event: {
    type: 'app_mention',
    user: 'U12345',
    ts: '1234567890.123456',
    channel: 'C67890',
    text: '<@U98765> write tests',
    ...overrides,
  },
});

describe('F-01: Slack Entry Point — Acceptance Criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskCreate.mockResolvedValue({
      id: 'mock-uuid',
      goal: 'write tests',
      status: 'pending',
      created_by: 'U12345',
    });
  });

  describe('✅ Happy paths', () => {
    it('creates task and replies to channel within 2s', async () => {
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentionEvent()),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(mockTaskCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          goal: 'write tests',
          created_by: 'U12345',
          status: 'pending',
        }),
      });
      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'C67890',
        thread_ts: '1234567890.123456',
        text: expect.stringContaining('Task created!'),
      });
    });

    it('passes url_verification challenge', async () => {
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url_verification', challenge: 'challenge_xyz' }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ challenge: 'challenge_xyz' });
    });
  });

  describe('❌ Sad paths', () => {
    it('empty goal replies with error and does not create task', async () => {
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentionEvent({ text: '<@U98765>' })),
      });
      expect(res.status).toBe(200);
      expect(mockTaskCreate).not.toHaveBeenCalled();
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('no text field falls back gracefully', async () => {
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentionEvent({ text: undefined })),
      });
      expect(res.status).toBe(200);
      expect(mockTaskCreate).not.toHaveBeenCalled();
    });

    it('non-app_mention events do not create tasks', async () => {
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'event_callback',
          event: { type: 'reaction_added' },
        }),
      });
      expect(res.status).toBe(200);
      expect(mockTaskCreate).not.toHaveBeenCalled();
    });

    it('returns 200 to avoid Slack retry storms even on failures', async () => {
      mockTaskCreate.mockRejectedValue(new Error('DB error'));
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentionEvent()),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });

  describe('⚠️ Edge cases', () => {
    it('stores goal with special characters and emojis verbatim', async () => {
      const goal = "fix the 🐛 in the auth/login route — it's returning 500";
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentionEvent({ text: `<@U98765> ${goal}` })),
      });
      expect(res.status).toBe(200);
      expect(mockTaskCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ goal }),
      });
    });

    it('handles goal with mixed languages and unicode', async () => {
      const goal = 'Implementar autenticación JWT 中文测试 テスト';
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentionEvent({ text: `<@U98765> ${goal}` })),
      });
      expect(res.status).toBe(200);
      expect(mockTaskCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ goal }),
      });
    });

    it('handles missing event object gracefully', async () => {
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'event_callback' }),
      });
      expect(res.status).toBe(200);
      expect(mockTaskCreate).not.toHaveBeenCalled();
    });

    it('handles extremely long goal', async () => {
      const goal = 'a'.repeat(2000);
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentionEvent({ text: `<@U98765> ${goal}` })),
      });
      expect(res.status).toBe(200);
      expect(mockTaskCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ goal }),
      });
    });

    it('handles goal with only whitespace (should treat as empty)', async () => {
      const res = await slackEvent.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentionEvent({ text: '<@U98765>   ' })),
      });
      expect(res.status).toBe(200);
      expect(mockTaskCreate).not.toHaveBeenCalled();
    });
  });
});
