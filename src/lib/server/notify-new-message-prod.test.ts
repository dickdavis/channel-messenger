import { describe, expect, test, mock, beforeEach } from 'bun:test'

void mock.module('$app/environment', () => ({ dev: false }))

const mockSendPushForSession = mock()
void mock.module('./push-notify', () => ({
  sendPushForSession: mockSendPushForSession
}))

const { notifyNewMessage } = await import('./notify')

const MESSAGE = {
  id: 1,
  session_id: 1,
  role: 'user',
  content: 'hello',
  created_at: '2025-01-01T00:00:00Z'
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeEnv (overrides: Record<string, unknown> = {}) {
  const mockFetch = mock(() => new Response('ok'))
  return {
    mockFetch,
    env: {
      SESSION_HUB: {
        idFromName: mock(() => 'do-id'),
        get: mock(() => ({ fetch: mockFetch }))
      },
      DB: {} as any,
      VAPID_PUBLIC_KEY: 'test-public-key',
      VAPID_PRIVATE_KEY: 'test-private-key',
      VAPID_SUBJECT: 'mailto:test@example.com',
      ...overrides
    }
  }
}

describe('notifyNewMessage (production mode)', () => {
  beforeEach(() => {
    mockSendPushForSession.mockReset()
    mockSendPushForSession.mockResolvedValue(undefined)
  })

  test('calls both notifySessionHub and sendPushForSession', async () => {
    const { mockFetch, env } = makeEnv()

    await notifyNewMessage(env as any, '1', MESSAGE)

    // WebSocket notification was sent
    expect(mockFetch).toHaveBeenCalled()
    // Push notification was sent
    expect(mockSendPushForSession).toHaveBeenCalledWith(
      env.DB,
      env,
      '1',
      MESSAGE
    )
  })

  test('skips push when VAPID_PUBLIC_KEY is empty', async () => {
    const { env } = makeEnv({ VAPID_PUBLIC_KEY: '' })

    await notifyNewMessage(env as any, '1', MESSAGE)
    expect(mockSendPushForSession).not.toHaveBeenCalled()
  })

  test('skips push when VAPID_PRIVATE_KEY is empty', async () => {
    const { env } = makeEnv({ VAPID_PRIVATE_KEY: '' })

    await notifyNewMessage(env as any, '1', MESSAGE)
    expect(mockSendPushForSession).not.toHaveBeenCalled()
  })

  test('skips push when VAPID_SUBJECT is empty', async () => {
    const { env } = makeEnv({ VAPID_SUBJECT: '' })

    await notifyNewMessage(env as any, '1', MESSAGE)
    expect(mockSendPushForSession).not.toHaveBeenCalled()
  })

  test('does not throw when push notification fails', async () => {
    const { env } = makeEnv()
    mockSendPushForSession.mockRejectedValue(new Error('push failed'))

    // Should not throw — uses Promise.allSettled
    await notifyNewMessage(env as any, '1', MESSAGE)
  })

  test('does not throw when WebSocket notification fails', async () => {
    const mockFetch = mock(() => { throw new Error('DO fetch failed') })
    const { env } = makeEnv()
    env.SESSION_HUB.get = mock(() => ({ fetch: mockFetch }))

    // Should not throw — uses Promise.allSettled
    await notifyNewMessage(env as any, '1', MESSAGE)
  })

  test('passes correct session ID to both notification paths', async () => {
    const { env } = makeEnv()

    await notifyNewMessage(env as any, '42', MESSAGE)

    // WebSocket path uses session-{id}
    expect(env.SESSION_HUB.idFromName).toHaveBeenCalledWith('session-42')
    // Push path receives the session ID
    expect(mockSendPushForSession.mock.calls[0][2]).toBe('42')
  })
})
