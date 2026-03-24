import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// DELETE /api/keys/:id — revoke an API key (browser session auth)
export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
  if (locals.user == null) return error(401, 'Not authenticated')
  const db = (platform as App.Platform).env.DB

  const result = await db
    .prepare(
      "UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND user_id = ? AND revoked_at IS NULL"
    )
    .bind(params.id, locals.user.id)
    .run()

  if (result.meta.changes === 0) {
    return error(404, 'API key not found or already revoked')
  }

  return json({ ok: true })
}
