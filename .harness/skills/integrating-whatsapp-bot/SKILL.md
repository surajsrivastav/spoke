---
name: integrating-whatsapp-bot
description: WhatsApp Cloud API webhook + message handling with Hono
---

## Overview
Connects Harness to WhatsApp via Meta's WhatsApp Cloud API. Receives incoming messages via webhook, sends replies, and creates tasks from `@harness` mentions.

## When to Use
- Setting up `apps/whatsapp-edge/`
- Handling WhatsApp webhook verification (GET)
- Processing incoming WhatsApp messages (POST)
- Sending messages back via WhatsApp API
- Creating tasks from WhatsApp messages

## How to Apply

### 1. Webhook Verification
WhatsApp Cloud API requires a GET endpoint with `hub.mode`, `hub.verify_token`, `hub.challenge` query params. Return the challenge as plain text.

### 2. Incoming Message Handling
WhatsApp sends POST requests with a `messages` array. Each message has a `from` (sender WA ID), `type`, and `text.body`. Check for `@harness` prefix to create tasks.

### 3. Sending Messages
POST to `https://graph.facebook.com/v20.0/{phone-number-id}/messages` with Bearer token auth.

## API Reference
- **Webhook verify**: `GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
- **Incoming messages**: `POST /webhook/whatsapp`

## Configuration
| Env Var | Description |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Permanent or temp access token from Meta Developer portal |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from your WABA |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Arbitrary string you choose; set same in Meta Developer portal |

## Anti-patterns
- ❌ Don't hardcode verify token in source
- ❌ Don't skip error handling on WhatsApp API send calls
- ❌ Don't trust unverified webhook requests

## Related Skills
- `writing-hono-api` — Route handler patterns
- `writing-typescript-module` — Module structure
