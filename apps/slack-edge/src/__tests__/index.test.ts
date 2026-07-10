import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockTaskCreate, mockPostMessage, mockVerifySlackRequest } = vi.hoisted(() => ({
  mockTaskCreate: vi.fn(),
  mockPostMessage: vi.fn(),
  mockVerifySlackRequest: vi.fn(async (_c: unknown, next: () => Promise<void>) => { await next() }),
}))

vi.mock('@spoke/db', () => ({
  prisma: {
    task: {
      create: mockTaskCreate,
    },
  },
  checkBudgetForNewTask: vi.fn().mockResolvedValue({ allowed: true, remaining: Infinity, budget: Infinity, spent: 0 }),
}))

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
  })),
}))

vi.mock('../verify-slack-request.js', () => ({
  verifySlackRequest: mockVerifySlackRequest,
}))

vi.mock('@spoke/shared', () => ({
  env: {
    SLACK_BOT_TOKEN: 'test_bot_token',
    SLACK_SIGNING_SECRET: 'test_signing_secret',
  },
}))

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

import { app } from '../index.js'

describe('Hono server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TARGET_REPO_URL = 'https://github.com/org/repo'
  })

  it('GET /health returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('does not start server in test environment', async () => {
    const { serve } = await import('@hono/node-server')
    expect(serve).not.toHaveBeenCalled()
  })

  it('mounts /slack/events route', async () => {
    const res = await app.request('/slack/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'url_verification', challenge: 'challenge_abc_123' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ challenge: 'challenge_abc_123' })
  })

  it('applies verifySlackRequest middleware to /slack/events', async () => {
    await app.request('/slack/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'url_verification', challenge: 'c' }),
    })
    expect(mockVerifySlackRequest).toHaveBeenCalled()
  })

  it('does not apply verifySlackRequest middleware to /health', async () => {
    await app.request('/health')
    expect(mockVerifySlackRequest).not.toHaveBeenCalled()
  })

  it('GET /unknown returns 404', async () => {
    const res = await app.request('/unknown')
    expect(res.status).toBe(404)
  })

  it('POST /slack/events with url_verification challenge returns the challenge', async () => {
    const res = await app.request('/slack/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'url_verification', challenge: 'challenge_abc_123' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ challenge: 'challenge_abc_123' })
  })

  it('POST /slack/events with app_mention creates a Task and replies via Slack API', async () => {
    mockTaskCreate.mockResolvedValue({
      id: 'mock-uuid-123',
      goal: 'write tests',
      status: 'pending',
      created_by: 'U12345',
    })

    const res = await app.request('/slack/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U12345',
          ts: '1234567890.123456',
          channel: 'C67890',
          text: '<@U98765> write tests',
        },
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect(mockTaskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        goal: 'write tests',
        created_by: 'U12345',
        status: 'pending',
      }),
    })

    expect(mockPostMessage).toHaveBeenCalledWith({
      channel: 'C67890',
      thread_ts: '1234567890.123456',
      text: expect.stringContaining('Task created!'),
    })
  })

  it('POST /slack/events with app_mention but empty goal returns ok without creating task', async () => {
    const res = await app.request('/slack/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U12345',
          ts: '1234567890.123456',
          channel: 'C67890',
          text: '<@U98765>',
        },
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockTaskCreate).not.toHaveBeenCalled()
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('POST /slack/events with fallthrough event type returns ok', async () => {
    const res = await app.request('/slack/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_callback',
        event: { type: 'reaction_added' },
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
