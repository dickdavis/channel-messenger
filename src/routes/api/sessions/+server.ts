import { json, error } from '@sveltejs/kit'
import { generateName } from '$lib/names'
import type { RequestHandler } from './$types'

// POST /api/sessions — MCP server registers a new session (Bearer token auth)
export const POST: RequestHandler = async ({ locals, request, platform }) => {
  if (locals.apiUser == null) return error(401, 'API token required')
  const db = (platform as App.Platform).env.DB

  const body = (await request.json().catch(() => ({}))) as { name?: string }
  const name = (body.name != null && body.name !== '') ? body.name : generateName()

  const result = await db
    .prepare('INSERT INTO sessions (user_id, name) VALUES (?, ?)')
    .bind(locals.apiUser.userId, name)
    .run()

  return json({ id: result.meta.last_row_id, name })
}
