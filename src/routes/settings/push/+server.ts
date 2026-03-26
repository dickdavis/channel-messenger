import { json, error } from '@sveltejs/kit'
import { dev } from '$app/environment'
import type { RequestHandler } from './$types'

interface SubscribeBody {
  endpoint?: string
  keys?: { p256dh?: string, auth?: string }
}

interface UnsubscribeBody {
  endpoint?: string
}

const MAX_ENDPOINT_LENGTH = 2048
const MAX_SUBSCRIPTIONS_PER_USER = 20

function isValidEndpoint (endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false
  if (endpoint.startsWith('https://')) return true
  if (dev && endpoint.startsWith('http://')) return true
  return false
}

// POST /settings/push — subscribe to push notifications
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (locals.user == null) return error(401, 'Not authenticated')
  const db = (platform as App.Platform).env.DB

  const body: SubscribeBody = await request.json()
  const { endpoint, keys } = body

  if (endpoint == null || endpoint === '' || keys?.p256dh == null || keys.p256dh === '' || keys?.auth == null || keys.auth === '') {
    return error(400, 'Missing subscription fields')
  }

  if (!isValidEndpoint(endpoint)) {
    return error(400, 'Invalid endpoint URL')
  }

  const count = await db
    .prepare('SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?')
    .bind(locals.user.id)
    .first<{ count: number }>()

  if (count != null && count.count >= MAX_SUBSCRIPTIONS_PER_USER) {
    return error(400, 'Too many subscriptions')
  }

  await db
    .prepare(
      'INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, key_p256dh, key_auth) VALUES (?, ?, ?, ?)'
    )
    .bind(locals.user.id, endpoint, keys.p256dh, keys.auth)
    .run()

  return json({ ok: true }, { status: 201 })
}

// DELETE /settings/push — unsubscribe from push notifications
export const DELETE: RequestHandler = async ({ request, locals, platform }) => {
  if (locals.user == null) return error(401, 'Not authenticated')
  const db = (platform as App.Platform).env.DB

  const body: UnsubscribeBody = await request.json()
  const { endpoint } = body

  if (endpoint == null || endpoint === '') {
    return error(400, 'Missing endpoint')
  }

  await db
    .prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .bind(locals.user.id, endpoint)
    .run()

  return json({ ok: true })
}
