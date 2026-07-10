import { vi, describe, it, expect } from 'vitest'

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

vi.mock('../verify-slack-request.js', () => ({
  verifySlackRequest: async (_c: unknown, next: () => Promise<void>) => { await next() },
}))

vi.mock('@spoke/shared', () => ({
  env: {
    SLACK_BOT_TOKEN: 'test_bot_token',
    SLACK_SIGNING_SECRET: 'test_signing_secret',
  },
}))

vi.mock('@spoke/db', () => ({
  prisma: { task: { create: vi.fn() } },
  checkBudgetForNewTask: vi.fn().mockResolvedValue({ allowed: true, remaining: Infinity, budget: Infinity, spent: 0 }),
}))

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: vi.fn() },
  })),
}))

vi.mock('node:crypto', () => ({
  default: { randomUUID: () => 'mock-uuid' },
  randomUUID: () => 'mock-uuid',
}))

import { serve } from '@hono/node-server'
import { app } from '../index.js'

describe('server start with VITEST set', () => {
  it('does not start server when VITEST is set', () => {
    expect(serve).not.toHaveBeenCalled()
  })

  it('handles requests', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })
})
