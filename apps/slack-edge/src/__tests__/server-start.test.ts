import { vi, describe, it, expect, beforeAll } from 'vitest'

vi.hoisted(() => {
  process.env.VITEST = ''
  delete process.env.PORT
})

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

vi.mock('../verify-slack-request.js', () => ({
  verifySlackRequest: async (_c: any, next: any) => { await next() },
}))

vi.mock('@harness/shared', () => ({
  env: {
    SLACK_BOT_TOKEN: 'test_bot_token',
    SLACK_SIGNING_SECRET: 'test_signing_secret',
  },
}))

vi.mock('@harness/db', () => ({
  prisma: { task: { create: vi.fn() } },
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

describe('server start without VITEST', () => {
  let serveFn: any
  let app: any

  beforeAll(async () => {
    serveFn = (await import('@hono/node-server')).serve
    const mod = await import('../index.js')
    app = mod.app
  })

  it('starts server when VITEST is not set', () => {
    expect(serveFn).toHaveBeenCalled()
  })

  it('starts server with default port 3001 when PORT is not set', () => {
    expect(serveFn).toHaveBeenCalledWith(
      expect.objectContaining({ port: 3001 })
    )
  })

  it('starts server with fetch handler', () => {
    expect(serveFn).toHaveBeenCalledWith(
      expect.objectContaining({ fetch: expect.any(Function) })
    )
  })

  it('handles health requests after start', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
