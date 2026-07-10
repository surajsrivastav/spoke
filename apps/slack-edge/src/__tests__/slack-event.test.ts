import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockTaskCreate, mockPostMessage } = vi.hoisted(() => ({
  mockTaskCreate: vi.fn(),
  mockPostMessage: vi.fn(),
}))

vi.mock('node:crypto', () => ({
  default: { randomUUID: () => 'mock-uuid' },
  randomUUID: () => 'mock-uuid',
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

vi.mock('@spoke/shared', () => ({
  env: {
    SLACK_BOT_TOKEN: 'test_bot_token',
  },
}))

import slackEvent from '../handlers/slack-event.js'
import { checkBudgetForNewTask } from '@spoke/db'

describe('slackEvent handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TARGET_REPO_URL = 'https://github.com/org/repo'
    vi.mocked(checkBudgetForNewTask).mockResolvedValue({ allowed: true, remaining: Infinity, budget: Infinity, spent: 0 })
  })

  it('warns and skips task creation when TARGET_REPO_URL is not configured', async () => {
    delete process.env.TARGET_REPO_URL

    const res = await slackEvent.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U12345',
          ts: '1234.5678',
          channel: 'C67890',
          text: '<@U98765> do something',
        },
      }),
    })

    expect(res.status).toBe(200)
    expect(mockTaskCreate).not.toHaveBeenCalled()
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('TARGET_REPO_URL') }),
    )
  })

  it('rejects the task when the team budget is exhausted (F-07)', async () => {
    vi.mocked(checkBudgetForNewTask).mockResolvedValue({
      allowed: false,
      remaining: 3,
      budget: 200,
      spent: 197,
      reason: 'Team budget nearly exhausted ($3.00 remaining). Reduce the task cap or request a budget increase.',
    })

    const res = await slackEvent.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U12345',
          ts: '1234.5678',
          channel: 'C67890',
          text: '<@U98765> refactor the entire auth module',
        },
      }),
    })

    expect(res.status).toBe(200)
    expect(mockTaskCreate).not.toHaveBeenCalled()
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C67890',
        text: expect.stringContaining('budget nearly exhausted'),
      }),
    )
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
        repo_url: 'https://github.com/org/repo',
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
