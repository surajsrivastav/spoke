import { Hono } from 'hono'

type WhatsAppTextMessage = {
  object: 'whatsapp_business_account'
  entry: {
    id: string
    changes: {
      value: {
        messaging_product: 'whatsapp'
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts: { profile: { name: string }; wa_id: string }[]
        messages: {
          from: string
          id: string
          timestamp: string
          text?: { body: string }
          type: 'text' | 'interactive'
        }[]
        statuses?: {
          id: string
          status: string
          timestamp: string
          recipient_id: string
        }[]
      }
      field: 'messages'
    }[]
  }[]
}

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
const WHATSAPP_API_VERSION = 'v20.0'
const WHATSAPP_API_BASE = 'https://graph.facebook.com'

export const incomingMessage = new Hono()

incomingMessage.post('/whatsapp', async (c) => {
  const body: WhatsAppTextMessage = await c.req.json()

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value.messages ?? []) {
        if (message.type === 'text' && message.text?.body) {
          const from = message.from
          const text = message.text.body.trim()
          const contactName =
            change.value.contacts?.find((contact) => contact.wa_id === from)?.profile?.name ?? 'Unknown'

          console.log(`[whatsapp] message from ${contactName} (${from}): ${text}`)

          if (text.startsWith('@spoke') || text.startsWith('/spoke')) {
            const goal = text.replace(/^@spoke\s*/i, '').replace(/^\/spoke\s*/i, '').trim()
            console.log(`[whatsapp] creating task: "${goal}" (from ${from})`)
          }

          await sendWhatsAppMessage(from, `Thanks ${contactName}! I received: "${text}"`)
        }
      }
    }
  }

  return c.json({ status: 'ok' }, 200)
})

async function sendWhatsAppMessage(to: string, text: string): Promise<Response> {
  const url = `${WHATSAPP_API_BASE}/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`

  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}
