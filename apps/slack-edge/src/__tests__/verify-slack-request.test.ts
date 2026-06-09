import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'

vi.mock('@harness/shared', () => ({
  env: { SLACK_SIGNING_SECRET: 'test_secret' },
}))

function signBody(body: string, ts: string): string {
  const hmac = crypto.createHmac('sha256', 'test_secret')
  hmac.update(`v0:${ts}:${body}`)
  return `v0=${hmac.digest('hex')}`
}

import { Hono } from 'hono'
import { verifySlackRequest } from '../verify-slack-request.js'

describe('verifySlackRequest', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.use('/test', verifySlackRequest)
    app.post('/test', (c) => c.json({ ok: true }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows request with valid signature', async () => {
    const now = String(Math.floor(Date.now() / 1000))
    const body = JSON.stringify({ event: 'test' })
    const sig = signBody(body, now)

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': sig,
        'x-slack-request-timestamp': now,
      },
      body,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('allows request with valid signature and special characters in body', async () => {
    const now = String(Math.floor(Date.now() / 1000))
    const body = JSON.stringify({ event: 'test', data: 'héllo wörld! @#$%' })
    const sig = signBody(body, now)

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': sig,
        'x-slack-request-timestamp': now,
      },
      body,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('allows request with empty body', async () => {
    const now = String(Math.floor(Date.now() / 1000))
    const body = ''
    const sig = signBody(body, now)

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': sig,
        'x-slack-request-timestamp': now,
      },
      body,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('allows request with timestamp exactly 300 seconds old (boundary)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:05:00Z'))
    const body = JSON.stringify({ event: 'test' })
    const timestamp = '1704067200'
    const sig = signBody(body, timestamp)

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': sig,
        'x-slack-request-timestamp': timestamp,
      },
      body,
    })

    expect(res.status).toBe(200)
    vi.useRealTimers()
  })

  it('returns 401 when x-slack-signature header is missing', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-request-timestamp': '1234567890',
      },
      body: JSON.stringify({ event: 'test' }),
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 401 when x-slack-request-timestamp header is missing', async () => {
    const body = JSON.stringify({ event: 'test' })
    const sig = signBody(body, 'undefined')

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': sig,
      },
      body,
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 401 when timestamp is older than 5 minutes', async () => {
    const body = JSON.stringify({ event: 'test' })
    const sig = signBody(body, '0')

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': sig,
        'x-slack-request-timestamp': '0',
      },
      body,
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 401 when signature does not match', async () => {
    const now = String(Math.floor(Date.now() / 1000))
    const body = JSON.stringify({ event: 'test' })

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': 'v0=0000000000000000000000000000000000000000000000000000000000000000',
        'x-slack-request-timestamp': now,
      },
      body,
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 401 when signature length differs', async () => {
    const now = String(Math.floor(Date.now() / 1000))

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': 'short',
        'x-slack-request-timestamp': now,
      },
      body: JSON.stringify({ event: 'test' }),
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 401 when signature header has wrong prefix', async () => {
    const now = String(Math.floor(Date.now() / 1000))
    const body = JSON.stringify({ event: 'test' })

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': 'v1=abc123def456',
        'x-slack-request-timestamp': now,
      },
      body,
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 401 when signature header is malformed (no v0= prefix)', async () => {
    const now = String(Math.floor(Date.now() / 1000))
    const body = JSON.stringify({ event: 'test' })

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': 'malformed-value',
        'x-slack-request-timestamp': now,
      },
      body,
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('returns 401 for empty body with valid-looking signature', async () => {
    const now = String(Math.floor(Date.now() / 1000))
    const body = ''

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': 'v0=0000000000000000000000000000000000000000000000000000000000000000',
        'x-slack-request-timestamp': now,
      },
      body,
    })

    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })
})
