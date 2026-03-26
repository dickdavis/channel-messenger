import { json, error } from '@sveltejs/kit'
import { notifyNewMessage } from '$lib/server/notify'
import type { RequestHandler } from './$types'

// GET /api/sessions/:id/messages — poll for messages (API)
export const GET: RequestHandler = async ({ params, url, locals, platform }) => {
  const userId = locals.apiUser?.userId
  if (userId == null) return error(401, 'Not authenticated')
  const db = (platform as App.Platform).env.DB

  const session = await db
    .prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?')
    .bind(params.id, userId)
    .first()

  if (session == null) {
    return error(404, 'Session not found')
  }

  const since = url.searchParams.get('since')
  if (since != null && since !== '' && !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(since)) {
    return error(400, 'Invalid since parameter')
  }

  let query: string
  let bindings: unknown[]

  if (since != null && since !== '') {
    query =
      'SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ? AND created_at > ? ORDER BY created_at ASC'
    bindings = [params.id, since]
  } else {
    query =
      'SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC'
    bindings = [params.id]
  }

  const { results } = await db.prepare(query).bind(...bindings).all()

  return json(results)
}

// POST /api/sessions/:id/messages — send a message as assistant (API)
export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  const userId = locals.apiUser?.userId
  if (userId == null) return error(401, 'Not authenticated')
  const db = (platform as App.Platform).env.DB

  const session = await db
    .prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?')
    .bind(params.id, userId)
    .first()

  if (session == null) {
    return error(404, 'Session not found')
  }

  const body: { content: string | undefined } = await request.json()
  const { content } = body

  if (content == null || content === '') {
    return error(400, 'Missing content')
  }

  const result = await db
    .prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
    .bind(params.id, 'assistant', content)
    .run()

  await db
    .prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?")
    .bind(params.id)
    .run()

  const env = (platform as App.Platform).env
  ;(platform as App.Platform).context.waitUntil(
    notifyNewMessage(env, params.id, {
      id: result.meta.last_row_id,
      session_id: Number(params.id),
      role: 'assistant',
      content,
      created_at: new Date().toISOString()
    })
  )

  return json({ id: result.meta.last_row_id })
}
