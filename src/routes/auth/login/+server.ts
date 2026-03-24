import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, platform }) => {
  const clientId = (platform as App.Platform).env.GITHUB_CLIENT_ID
  const redirectUri = `${url.origin}/auth/callback`
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state
  })

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
      'Set-Cookie': `oauth_state=${state}; Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=300`
    }
  })
}
