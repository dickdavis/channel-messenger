import './tests/use-native-fetch'
import { describe, expect, test, mock, beforeEach } from 'bun:test'
import { createSessionCookie } from '$lib/session'
import { generateToken, hashToken } from '$lib/auth'
import { MockD1Database } from './tests/mock-d1'
import { mockRequestEvent, expectHttpError } from './tests/mock-event'

void mock.module('$app/environment', () => ({ dev: false }))

const { handle } = await import('./hooks.server')

const SECRET = 'test-secret'
const TEST_USER = { id: 1, github_id: '12345', github_username: 'testuser', display_name: 'Test' }

const mockResolve = mock(() => new Response('ok'))

describe('handle', () => {
  beforeEach(() => {
    mockResolve.mockClear()
    mockResolve.mockImplementation(() => new Response('ok'))
  })

  test('sets locals.user from valid session cookie', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER, false)
    const event = mockRequestEvent({
      headers: { Cookie: cookie },
      hmacSecret: SECRET
    })

    await handle({ event, resolve: mockResolve } as any)

    expect(event.locals.user).not.toBeNull()
    if (event.locals.user == null) return
    expect(event.locals.user.id).toBe(TEST_USER.id)
    expect(event.locals.user.github_username).toBe(TEST_USER.github_username)
  })

  test('sets locals.user to null for invalid cookie', async () => {
    const event = mockRequestEvent({
      url: 'http://localhost/auth/login',
      headers: { Cookie: 'session=invalid.bad' },
      hmacSecret: SECRET
    })

    await handle({ event, resolve: mockResolve } as any)
    expect(event.locals.user).toBeNull()
  })

  test('initialises locals.apiUser to null', async () => {
    const event = mockRequestEvent({
      url: 'http://localhost/auth/login',
      hmacSecret: SECRET
    })

    await handle({ event, resolve: mockResolve } as any)
    expect(event.locals.apiUser).toBeNull()
  })

  describe('API routes', () => {
    test('verifies Bearer token and sets locals.apiUser', async () => {
      const token = await generateToken()
      const tokenHash = await hashToken(SECRET, token)

      const db = new MockD1Database()
      db.onQuery('SELECT user_id FROM api_keys', { user_id: 42 })

      const event = mockRequestEvent({
        url: 'http://localhost/api/sessions',
        headers: { Authorization: `Bearer ${token}` },
        hmacSecret: SECRET,
        db
      })

      await handle({ event, resolve: mockResolve } as any)

      expect(event.locals.apiUser).toEqual({ userId: 42 })
      expect(db.calls[0].bindings[0]).toBe(tokenHash)
    })

    test('allows request when user has browser session on API route', async () => {
      const cookie = await createSessionCookie(SECRET, TEST_USER, false)
      const event = mockRequestEvent({
        url: 'http://localhost/api/sessions',
        headers: { Cookie: cookie },
        hmacSecret: SECRET
      })

      const response = await handle({ event, resolve: mockResolve } as any)
      expect(mockResolve).toHaveBeenCalled()
      expect(response.status).not.toBe(401)
    })

    test('returns 401 JSON when neither auth path succeeds', async () => {
      const event = mockRequestEvent({
        url: 'http://localhost/api/sessions',
        hmacSecret: SECRET
      })

      const response = await handle({ event, resolve: mockResolve } as any)
      expect(response.status).toBe(401)
      const data = await response.json() as any
      expect(data.error).toBe('Not authenticated')
    })

    test('does not call DB when no Authorization header on API route', async () => {
      const db = new MockD1Database()
      const event = mockRequestEvent({
        url: 'http://localhost/api/sessions',
        hmacSecret: SECRET,
        db
      })

      await handle({ event, resolve: mockResolve } as any)
      expect(db.calls).toHaveLength(0)
    })

    test('ignores non-Bearer Authorization header', async () => {
      const event = mockRequestEvent({
        url: 'http://localhost/api/sessions',
        headers: { Authorization: 'Basic abc123' },
        hmacSecret: SECRET
      })

      const response = await handle({ event, resolve: mockResolve } as any)
      expect(response.status).toBe(401)
      expect(event.locals.apiUser).toBeNull()
    })
  })

  describe('public paths', () => {
    test('allows /auth/login without authentication', async () => {
      const event = mockRequestEvent({
        url: 'http://localhost/auth/login',
        hmacSecret: SECRET
      })

      await handle({ event, resolve: mockResolve } as any)
      expect(mockResolve).toHaveBeenCalled()
    })

    test('allows /auth/callback without authentication', async () => {
      const event = mockRequestEvent({
        url: 'http://localhost/auth/callback?code=abc',
        hmacSecret: SECRET
      })

      await handle({ event, resolve: mockResolve } as any)
      expect(mockResolve).toHaveBeenCalled()
    })
  })

  describe('browser routes', () => {
    test('redirects to /auth/login when user is null', async () => {
      const event = mockRequestEvent({
        url: 'http://localhost/dashboard',
        hmacSecret: SECRET
      })

      await expectHttpError(
        async () => await handle({ event, resolve: mockResolve } as any),
        302
      )
    })

    test('proceeds when user is authenticated', async () => {
      const cookie = await createSessionCookie(SECRET, TEST_USER, false)
      const event = mockRequestEvent({
        url: 'http://localhost/dashboard',
        headers: { Cookie: cookie },
        hmacSecret: SECRET
      })

      await handle({ event, resolve: mockResolve } as any)
      expect(mockResolve).toHaveBeenCalled()
    })
  })
})
