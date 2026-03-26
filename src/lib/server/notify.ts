import { dev } from '$app/environment'
import { sendPushForSession } from './push-notify'

interface MessagePayload {
  id: number | null
  session_id: number
  role: string
  content: string
  created_at: string
}

export async function notifySessionHub (
  sessionHub: DurableObjectNamespace,
  sessionId: string,
  message: MessagePayload
): Promise<void> {
  // In dev, broadcast via the Vite plugin's in-process WebSocket server
  if (dev) {
    if (typeof globalThis.devSessionBroadcast === 'function') {
      globalThis.devSessionBroadcast(sessionId, message)
    }
    return
  }

  // In production, notify the Durable Object
  const doId = sessionHub.idFromName(`session-${sessionId}`)
  const stub = sessionHub.get(doId)
  await stub.fetch('https://internal/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  })
}

export async function notifyNewMessage (
  env: App.Platform['env'],
  sessionId: string,
  message: MessagePayload
): Promise<void> {
  const tasks: Array<Promise<void>> = [
    notifySessionHub(env.SESSION_HUB, sessionId, message)
  ]

  if (env.VAPID_PUBLIC_KEY !== '' && env.VAPID_PRIVATE_KEY !== '' && env.VAPID_SUBJECT !== '') {
    tasks.push(sendPushForSession(env.DB, env, sessionId, message))
  }

  await Promise.allSettled(tasks)
}
