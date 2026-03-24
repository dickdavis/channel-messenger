import { clearSessionCookie } from '$lib/session'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': clearSessionCookie()
    }
  })
}
