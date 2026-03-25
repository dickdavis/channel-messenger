import '../../../tests/use-native-fetch'
import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test'
import { GET } from './+server'
import { mockRequestEvent, expectHttpError } from '../../../tests/mock-event'
import { MockD1Database } from '../../../tests/mock-d1'

const VALID_STATE = 'test-state-uuid'

const originalFetch = globalThis.fetch
const mockFetch = mock() as any

beforeEach(() => {
  mockFetch.mockReset()
  globalThis.fetch = mockFetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

function callbackEvent (options: {
  code?: string
  state?: string
  oauthState?: string
  db?: MockD1Database
} = {}): ReturnType<typeof mockRequestEvent> {
  const {
    code = 'valid-code',
    state = VALID_STATE,
    oauthState = VALID_STATE,
    db = new MockD1Database()
  } = options

  const params = new URLSearchParams()
  if (code !== '') params.set('code', code)
  if (state !== '') params.set('state', state)

  const headers: Record<string, string> = {}
  if (oauthState !== '') {
    headers.Cookie = `oauth_state=${oauthState}`
  }

  return mockRequestEvent({
    url: `http://localhost/auth/callback?${params.toString()}`,
    headers,
    db
  })
}

function mockGitHubSuccess (githubUser = { id: 12345, login: 'testuser', name: 'Test User' }): void {
  mockFetch
    .mockImplementationOnce(async () => new Response(
      JSON.stringify({ access_token: 'gho_fake_token' }),
      { headers: { 'Content-Type': 'application/json' } }
    ))
    .mockImplementationOnce(async () => new Response(
      JSON.stringify(githubUser),
      { headers: { 'Content-Type': 'application/json' } }
    ))
}

describe('GET /auth/callback', () => {
  test('throws 400 when code parameter is missing', async () => {
    const event = callbackEvent({ code: '' })
    await expectHttpError(async () => await GET(event as any), 400)
  })

  test('throws 400 when state does not match cookie', async () => {
    const event = callbackEvent({ state: 'wrong-state', oauthState: 'different-state' })
    await expectHttpError(async () => await GET(event as any), 400)
  })

  test('throws 400 when oauth_state cookie is missing', async () => {
    const event = callbackEvent({ oauthState: '' })
    await expectHttpError(async () => await GET(event as any), 400)
  })

  test('throws 400 when GitHub token exchange fails', async () => {
    mockFetch.mockImplementationOnce(async () => new Response(
      JSON.stringify({ error: 'bad_verification_code' }),
      { headers: { 'Content-Type': 'application/json' } }
    ))

    const event = callbackEvent()
    await expectHttpError(async () => await GET(event as any), 400)
  })

  test('throws 403 when user is not in allowlist', async () => {
    mockGitHubSuccess({ id: 99999, login: 'blocked', name: 'Blocked' })

    const event = callbackEvent()
    ;(event.platform.env as any).ALLOWED_GITHUB_IDS = '111,222'

    await expectHttpError(async () => await GET(event as any), 403)
  })

  test('allows user when allowlist is empty', async () => {
    mockGitHubSuccess()

    const db = new MockD1Database()
    db.onQuery('SELECT id, github_id', null)
    db.onQuery('INSERT INTO users', { meta: { last_row_id: 1, changes: 1 } })

    const event = callbackEvent({ db })
    const response = await GET(event as any)
    expect(response.status).toBe(302)
  })

  test('allows user when their ID is in the allowlist', async () => {
    mockGitHubSuccess({ id: 12345, login: 'testuser', name: 'Test' })

    const db = new MockD1Database()
    db.onQuery('SELECT id, github_id', null)
    db.onQuery('INSERT INTO users', { meta: { last_row_id: 1, changes: 1 } })

    const event = callbackEvent({ db })
    ;(event.platform.env as any).ALLOWED_GITHUB_IDS = '111,12345,222'

    const response = await GET(event as any)
    expect(response.status).toBe(302)
  })

  test('creates new user when not found in DB', async () => {
    mockGitHubSuccess({ id: 42, login: 'newuser', name: 'New User' })

    const db = new MockD1Database()
    db.onQuery('SELECT id, github_id', null)
    db.onQuery('INSERT INTO users', { meta: { last_row_id: 10, changes: 1 } })

    const event = callbackEvent({ db })
    const response = await GET(event as any)

    expect(response.status).toBe(302)

    const insertCall = db.calls.find((c) => c.sql.includes('INSERT INTO users'))
    expect(insertCall).toBeTruthy()
    if (insertCall == null) return
    expect(insertCall.bindings[0]).toBe('42')
    expect(insertCall.bindings[1]).toBe('newuser')
    expect(insertCall.bindings[2]).toBe('New User')
  })

  test('updates existing user when found in DB', async () => {
    mockGitHubSuccess({ id: 42, login: 'updated-login', name: 'Updated Name' })

    const db = new MockD1Database()
    db.onQuery('SELECT id, github_id', { id: 5, github_id: '42', github_username: 'old-login', display_name: 'Old Name' })
    db.onQuery('UPDATE users', { meta: { last_row_id: 0, changes: 1 } })

    const event = callbackEvent({ db })
    const response = await GET(event as any)

    expect(response.status).toBe(302)

    const updateCall = db.calls.find((c) => c.sql.includes('UPDATE users'))
    expect(updateCall).toBeTruthy()
    if (updateCall == null) return
    expect(updateCall.bindings[0]).toBe('updated-login')
    expect(updateCall.bindings[1]).toBe('Updated Name')
    expect(updateCall.bindings[2]).toBe(5)
  })

  test('redirects to / and sets session + clears state cookie', async () => {
    mockGitHubSuccess()

    const db = new MockD1Database()
    db.onQuery('SELECT id, github_id', null)
    db.onQuery('INSERT INTO users', { meta: { last_row_id: 1, changes: 1 } })

    const event = callbackEvent({ db })
    const response = await GET(event as any)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/')

    const cookies = response.headers.getSetCookie()
    expect(cookies.length).toBeGreaterThanOrEqual(2)

    const sessionCookie = cookies.find((c) => c.startsWith('session=') && !c.includes('Max-Age=0'))
    expect(sessionCookie).toBeTruthy()

    const stateCookie = cookies.find((c) => c.includes('oauth_state=') && c.includes('Max-Age=0'))
    expect(stateCookie).toBeTruthy()
  })
})
