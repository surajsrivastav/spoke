import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { verifySlackRequest } from './verify-slack-request.js'
import slackEvent from './handlers/slack-event.js'

export const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.use('/slack/*', verifySlackRequest)
app.route('/slack', slackEvent)

const port = Number(process.env.PORT ?? '3001')

if (!process.env.VITEST) {
  serve({ fetch: app.fetch, port })
}
