import { Hono } from 'hono'
import crypto from 'node:crypto'
import { prisma, checkBudgetForNewTask } from '@spoke/db'
import { WebClient } from '@slack/web-api'
import { env } from '@spoke/shared'

const slackEvent = new Hono()
const slackClient = new WebClient(env.SLACK_BOT_TOKEN)

slackEvent.post('/events', async (c) => {
  const body = await c.req.json()

  if (body.type === 'url_verification') {
    return c.json({ challenge: body.challenge })
  }

  if (body.type === 'event_callback' && body.event?.type === 'app_mention') {
    const event = body.event
    const userId = event.user as string
    const threadTs = event.ts as string
    const channelId = event.channel as string

    const text: string = event.text ?? ''
    const goal = text.replace(/<@[^>]+>/, '').trim()

    if (!goal) {
      return c.json({ ok: true })
    }

    const repoUrl = process.env.TARGET_REPO_URL ?? ''
    if (!repoUrl) {
      try {
        await slackClient.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: ':warning: No target repository configured. Set `TARGET_REPO_URL` on the Slack edge service.',
        })
      } catch (err) {
        console.error('[slack] failed to post config warning:', err instanceof Error ? err.message : String(err))
      }
      return c.json({ ok: true })
    }

    try {
      const teamId = process.env.SPOKE_TEAM_ID
      const budget = await checkBudgetForNewTask(teamId, env.DEFAULT_COST_CAP_USD)
      if (!budget.allowed) {
        await slackClient.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: `:no_entry: Task rejected — ${budget.reason}`,
        })
        return c.json({ ok: true })
      }

      const task = await prisma.task.create({
        data: {
          id: crypto.randomUUID(),
          goal,
          repo_url: repoUrl,
          branch_target: process.env.TARGET_BRANCH ?? 'main',
          status: 'pending',
          created_by: userId,
          ...(teamId ? { team_id: teamId } : {}),
        },
      })

      await slackClient.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `Task created! ID: \`${task.id}\`\nGoal: ${goal}`,
      })
    } catch (err) {
      console.error('[slack] failed to create task:', err instanceof Error ? err.message : String(err))
    }
  }

  return c.json({ ok: true })
})

export default slackEvent
