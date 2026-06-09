import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockTaskCreate, mockPostMessage } = vi.hoisted(() => ({
  mockTaskCreate: vi.fn(),
  mockPostMessage: vi.fn(),
}))

vi.mock('node:crypto', () => ({
  default: { randomUUID: () => 'mock-uuid' },
  randomUUID: () => 'mock-uuid',
}))

vi.mock('@harness/db', () => ({
  prisma: {
    task: {
      create: mockTaskCreate,
    },
  },
}))

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
  })),
}))

vi.mock('@harness/shared', () => ({
  env: {
    SLACK_BOT_TOKEN: 'test_bot_token',
  },
}))

import slackEvent from '../handlers/slack-event.js'

describe('slackEvent handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('url_verification returns challenge', async () => {
    const res = await slackEvent.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'url_verification', challenge: 'challenge_xyz' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ challenge: 'challenge_xyz' })
  })

  it('app_mention with goal creates task and sends message', async () => {
    mockTaskCreate.mockResolvedValue({
      id: 'mock-uuid',
      goal: 'write tests',
      status: 'pending',
      created_by: 'U12345',
    })

    const res = await slackEvent.request('/events', {
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
        repo_url: '',
        branch_target: 'main',
      }),
    })
    expect(mockPostMessage).toHaveBeenCalledWith({
      channel: 'C67890',
      thread_ts: '1234567890.123456',
      text: expect.stringContaining('Task created!'),
    })
  })

  it('app_mention with empty goal returns ok without creating task', async () => {
    const res = await slackEvent.request('/events', {
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

  it('app_mention without text field falls back to empty string and returns ok', async () => {
    const res = await slackEvent.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U12345',
          ts: '1234567890.123456',
          channel: 'C67890',
        },
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockTaskCreate).not.toHaveBeenCalled()
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('event_callback with non-app_mention event does not create task', async () => {
    const res = await slackEvent.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_callback',
        event: {
          type: 'some_other_event',
          user: 'U12345',
          ts: '1234567890.123456',
          channel: 'C67890',
          text: 'some text',
        },
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockTaskCreate).not.toHaveBeenCalled()
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('non-event_callback type with app_mention event does not create task', async () => {
    const res = await slackEvent.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'not_event_callback',
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
    expect(mockTaskCreate).not.toHaveBeenCalled()
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('event_callback without event object returns ok', async () => {
    const res = await slackEvent.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'event_callback' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockTaskCreate).not.toHaveBeenCalled()
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('invalid JSON body returns error', async () => {
    const res = await slackEvent.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    })
    expect(res.status).toBe(500)
  })
})
