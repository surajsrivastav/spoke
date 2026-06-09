import { createMiddleware } from 'hono/factory'
import crypto from 'node:crypto'
import { env } from '@harness/shared'

export const verifySlackRequest = createMiddleware(async (c, next) => {
  const timestamp = c.req.header('x-slack-request-timestamp')
  const signature = c.req.header('x-slack-signature')

  if (!timestamp || !signature) {
    return c.text('Unauthorized', 401)
  }

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return c.text('Unauthorized', 401)
  }

  const rawBody = await c.req.raw.clone().text()
  const sigBase = `v0:${timestamp}:${rawBody}`
  const hmac = crypto.createHmac('sha256', env.SLACK_SIGNING_SECRET)
  hmac.update(sigBase)
  const expectedSignature = `v0=${hmac.digest('hex')}`

  const expectedBuffer = Buffer.from(expectedSignature)
  const actualBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== actualBuffer.length) {
    return c.text('Unauthorized', 401)
  }

  if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return c.text('Unauthorized', 401)
  }

  await next()
})
