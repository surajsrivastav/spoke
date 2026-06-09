import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { webhook } from './webhook.js'
import { incomingMessage } from './handlers/message.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/webhook', webhook)
app.route('/webhook', incomingMessage)

const port = Number(process.env.WHATSAPP_EDGE_PORT ?? process.env.PORT ?? '3002')

if (process.env.VITEST === undefined) {
  serve({ fetch: app.fetch, port })
}

export { app }
