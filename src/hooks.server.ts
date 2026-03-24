import { verifySession } from '$lib/session'
import { verifyToken } from '$lib/auth'
import { redirect } from '@sveltejs/kit'
import { dev } from '$app/environment'
import type { Handle } from '@sveltejs/kit'

const PUBLIC_PATHS = ['/auth/login', '/auth/callback']

export const handle: Handle = async ({ event, resolve }) => {
  // Share platform env with the Vite plugin for WebSocket auth in dev
  if (dev && event.platform?.env != null && globalThis.devPlatformEnv == null) {
    globalThis.devPlatformEnv = event.platform.env
  }

  const secret = event.platform?.env.HMAC_SECRET ?? ''
  const cookieHeader = event.request.headers.get('Cookie')
  event.locals.user = await verifySession(secret, cookieHeader)
  event.locals.apiUser = null

  // Validate Bearer token for API routes
  if (event.url.pathname.startsWith('/api/')) {
    const authHeader = event.request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ') === true) {
      const db = (event.platform as App.Platform).env.DB
      event.locals.apiUser = await verifyToken(db, secret, authHeader.slice(7))
    }

    // API routes require either browser session or valid API token
    if ((event.locals.user != null) || (event.locals.apiUser != null)) {
      return await resolve(event)
    }
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p))) {
    return await resolve(event)
  }

  // Require browser session for everything else
  if (event.locals.user == null) {
    redirect(302, '/auth/login')
  }

  return await resolve(event)
}
