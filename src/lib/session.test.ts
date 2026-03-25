import { describe, expect, test } from 'bun:test'
import { createSessionCookie, verifySession, clearSessionCookie } from './session'

const SECRET = 'test-hmac-secret'
const TEST_USER = {
  id: 1,
  github_id: '12345',
  github_username: 'testuser',
  display_name: 'Test User'
}

function extractCookieValue (cookie: string): string {
  return cookie.split('=').slice(1).join('=').split(';')[0]
}

describe('createSessionCookie', () => {
  test('returns Set-Cookie string with session= prefix', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER)
    expect(cookie).toMatch(/^session=/)
  })

  test('contains HttpOnly and SameSite=Lax flags', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
  })

  test('includes Secure flag when secure=true', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER, true)
    expect(cookie).toContain('Secure')
  })

  test('omits Secure flag when secure=false', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER, false)
    expect(cookie).not.toContain('Secure')
  })

  test('cookie value is base64payload.signature format', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER)
    const value = extractCookieValue(cookie)
    const parts = value.split('.')
    expect(parts).toHaveLength(2)
    expect(parts[0].length).toBeGreaterThan(0)
    expect(parts[1].length).toBeGreaterThan(0)
  })

  test('payload contains correct user fields and expiry', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER)
    const value = extractCookieValue(cookie)
    const data = value.split('.')[0]
    const payload = JSON.parse(atob(data))

    expect(payload.userId).toBe(TEST_USER.id)
    expect(payload.githubId).toBe(TEST_USER.github_id)
    expect(payload.githubUsername).toBe(TEST_USER.github_username)
    expect(payload.displayName).toBe(TEST_USER.display_name)
    expect(payload.exp).toBeGreaterThan(Date.now())
  })
})

describe('verifySession', () => {
  test('returns user object for valid cookie', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER, false)
    const user = await verifySession(SECRET, cookie)

    expect(user).not.toBeNull()
    if (user == null) return
    expect(user.id).toBe(TEST_USER.id)
    expect(user.github_id).toBe(TEST_USER.github_id)
    expect(user.github_username).toBe(TEST_USER.github_username)
    expect(user.display_name).toBe(TEST_USER.display_name)
  })

  test('roundtrips null display_name correctly', async () => {
    const userWithNullName = { ...TEST_USER, display_name: null }
    const cookie = await createSessionCookie(SECRET, userWithNullName, false)
    const user = await verifySession(SECRET, cookie)

    expect(user).not.toBeNull()
    if (user == null) return
    expect(user.display_name).toBeNull()
  })

  test('returns null for null cookieHeader', async () => {
    const user = await verifySession(SECRET, null)
    expect(user).toBeNull()
  })

  test('returns null for empty string cookieHeader', async () => {
    const user = await verifySession(SECRET, '')
    expect(user).toBeNull()
  })

  test('returns null when no session= cookie present', async () => {
    const user = await verifySession(SECRET, 'other=value; foo=bar')
    expect(user).toBeNull()
  })

  test('returns null for tampered signature', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER, false)
    const value = extractCookieValue(cookie)
    const [data] = value.split('.')
    const tampered = `session=${data}.aaaaaaaaaa; Path=/; HttpOnly; SameSite=Lax`

    const user = await verifySession(SECRET, tampered)
    expect(user).toBeNull()
  })

  test('returns null for cookie value with no dot separator', async () => {
    const user = await verifySession(SECRET, 'session=justpayloadnodot')
    expect(user).toBeNull()
  })

  test('returns null for expired session', async () => {
    const originalNow = Date.now
    const cookie = await createSessionCookie(SECRET, TEST_USER, false)

    Date.now = () => originalNow() + 8 * 24 * 60 * 60 * 1000
    try {
      const user = await verifySession(SECRET, cookie)
      expect(user).toBeNull()
    } finally {
      Date.now = originalNow
    }
  })

  test('returns null for malformed base64 payload', async () => {
    const user = await verifySession(SECRET, 'session=!!!invalid!!!.abcdef')
    expect(user).toBeNull()
  })

  test('returns null with wrong secret', async () => {
    const cookie = await createSessionCookie(SECRET, TEST_USER, false)
    const user = await verifySession('wrong-secret', cookie)
    expect(user).toBeNull()
  })
})

describe('clearSessionCookie', () => {
  test('returns Set-Cookie with Max-Age=0', () => {
    const cookie = clearSessionCookie()
    expect(cookie).toContain('Max-Age=0')
  })

  test('clears the session cookie', () => {
    const cookie = clearSessionCookie()
    expect(cookie).toMatch(/^session=;/)
  })
})
