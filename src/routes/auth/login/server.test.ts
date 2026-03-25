import '../../../tests/use-native-fetch'
import { describe, expect, test } from 'bun:test'
import { GET } from './+server'
import { mockRequestEvent } from '../../../tests/mock-event'

describe('GET /auth/login', () => {
  test('redirects to GitHub OAuth URL', async () => {
    const event = mockRequestEvent({
      url: 'http://localhost/auth/login'
    })

    const response = await GET(event as any)

    expect(response.status).toBe(302)
    const location = response.headers.get('Location') ?? ''
    expect(location).toContain('https://github.com/login/oauth/authorize')
  })

  test('includes correct OAuth params', async () => {
    const event = mockRequestEvent({
      url: 'http://localhost/auth/login'
    })

    const response = await GET(event as any)
    const location = new URL(response.headers.get('Location') ?? '')

    expect(location.searchParams.get('client_id')).toBe('test-client-id')
    expect(location.searchParams.get('redirect_uri')).toBe('http://localhost/auth/callback')
    expect(location.searchParams.get('scope')).toBe('read:user')
    expect(location.searchParams.get('state')).toBeTruthy()
  })

  test('sets oauth_state cookie', async () => {
    const event = mockRequestEvent({
      url: 'http://localhost/auth/login'
    })

    const response = await GET(event as any)
    const setCookie = response.headers.get('Set-Cookie') ?? ''

    expect(setCookie).toContain('oauth_state=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Max-Age=300')
  })
})
