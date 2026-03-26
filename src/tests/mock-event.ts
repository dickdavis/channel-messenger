import { expect, mock } from 'bun:test'
import { MockD1Database } from './mock-d1'

const NativeRequest = (globalThis as any).__nativeRequest ?? globalThis.Request

export function mockUser (overrides: Partial<App.Locals['user']> = {}): NonNullable<App.Locals['user']> {
  return {
    id: 1,
    github_id: '12345',
    github_username: 'testuser',
    display_name: 'Test User',
    ...overrides
  }
}

export function mockApiUser (overrides: Partial<NonNullable<App.Locals['apiUser']>> = {}): NonNullable<App.Locals['apiUser']> {
  return {
    userId: 1,
    ...overrides
  }
}

interface MockEventOptions {
  method?: string
  url?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
  locals?: Partial<App.Locals>
  db?: MockD1Database
  hmacSecret?: string
  sessionHub?: unknown
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function mockRequestEvent (options: MockEventOptions = {}) {
  const {
    method = 'GET',
    url = 'http://localhost',
    params = {},
    body,
    headers = {},
    locals = {},
    db = new MockD1Database(),
    hmacSecret = 'test-secret',
    sessionHub
  } = options

  const requestInit: RequestInit = { method, headers }
  if (body != null) {
    requestInit.body = JSON.stringify(body)
    ;(requestInit.headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  return {
    params,
    url: new URL(url),
    request: new NativeRequest(url, requestInit),
    locals: {
      user: null,
      apiUser: null,
      ...locals
    },
    platform: {
      env: {
        DB: db as unknown as D1Database,
        HMAC_SECRET: hmacSecret,
        GITHUB_CLIENT_ID: 'test-client-id',
        GITHUB_CLIENT_SECRET: 'test-client-secret',
        SESSION_HUB: sessionHub ?? {},
        ALLOWED_GITHUB_IDS: '',
        VAPID_PUBLIC_KEY: 'test-vapid-public-key',
        VAPID_PRIVATE_KEY: 'test-vapid-private-key',
        VAPID_SUBJECT: 'mailto:test@example.com'
      },
      context: {
        waitUntil: mock(() => {})
      }
    }
  }
}

export async function expectHttpError (fn: () => Promise<unknown>, status: number): Promise<void> {
  let threw = false
  try {
    await fn()
  } catch (e: any) {
    threw = true
    expect(e.status).toBe(status)
  }
  if (!threw) {
    throw new Error(`Expected handler to throw with status ${status}`)
  }
}
