import webpush from 'web-push'

interface PushEnv {
  VAPID_SUBJECT: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
}

interface PushMessage {
  role: string
  content: string
}

const MAX_TITLE_LENGTH = 100
const MAX_SUBSCRIPTIONS = 20

export async function sendPushForSession (
  db: D1Database,
  env: PushEnv,
  sessionId: string,
  message: PushMessage
): Promise<void> {
  const session = await db
    .prepare('SELECT user_id, name FROM sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ user_id: number, name: string | null }>()

  if (session == null) return

  const { results: subs } = await db
    .prepare('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions WHERE user_id = ? LIMIT ?')
    .bind(session.user_id, MAX_SUBSCRIPTIONS)
    .all<{ id: number, endpoint: string, key_p256dh: string, key_auth: string }>()

  if (subs.length === 0) return

  const vapidOptions = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  }

  const rawTitle = session.name ?? `Session ${sessionId}`
  const title = rawTitle.length > MAX_TITLE_LENGTH
    ? rawTitle.slice(0, MAX_TITLE_LENGTH) + '\u2026'
    : rawTitle
  const body = message.content.length > 200
    ? message.content.slice(0, 200) + '\u2026'
    : message.content
  const payload = JSON.stringify({
    title,
    body,
    url: `/?session=${sessionId}`
  })

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.key_p256dh, auth: sub.key_auth } },
        payload,
        { vapidDetails: vapidOptions }
      )
    } catch (err: unknown) {
      const statusCode = err != null && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode: number }).statusCode
        : undefined
      if (statusCode === 410) {
        await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run()
      } else {
        console.error('Push notification failed', { endpoint: sub.endpoint, statusCode, err })
      }
    }
  }))
}
