import { describe, expect, test, mock, afterEach, beforeEach } from 'bun:test'

void mock.module('$app/environment', () => ({ dev: true }))

const { notifyNewMessage } = await import('./notify')

const mockSendPushForSession = mock()

const MESSAGE = {
  id: 1,
  session_id: 1,
  role: 'user',
  content: 'hello',
  created_at: '2025-01-01T00:00:00Z'
}

describe('notifyNewMessage (dev mode)', () => {
  beforeEach(() => {
    mockSendPushForSession.mockReset()
    mockSendPushForSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete (globalThis as any).devSessionBroadcast
  })

  test('calls devSessionBroadcast for WebSocket notification', async () => {
    const broadcast = mock()
    ;(globalThis as any).devSessionBroadcast = broadcast

    const env = {
      SESSION_HUB: {} as any,
      DB: {} as any,
      VAPID_PUBLIC_KEY: 'key',
      VAPID_PRIVATE_KEY: 'secret',
      VAPID_SUBJECT: 'mailto:test@example.com'
    }

    await notifyNewMessage(env as any, '1', MESSAGE, mockSendPushForSession as any)
    expect(broadcast).toHaveBeenCalledWith('1', MESSAGE)
  })

  test('sends push notifications in dev mode when VAPID keys are configured', async () => {
    const env = {
      SESSION_HUB: {} as any,
      DB: {} as any,
      VAPID_PUBLIC_KEY: 'key',
      VAPID_PRIVATE_KEY: 'secret',
      VAPID_SUBJECT: 'mailto:test@example.com'
    }

    await notifyNewMessage(env as any, '1', MESSAGE, mockSendPushForSession as any)
    expect(mockSendPushForSession).toHaveBeenCalledWith(
      env.DB,
      env,
      '1',
      MESSAGE
    )
  })

  test('skips push when VAPID keys are empty', async () => {
    const env = {
      SESSION_HUB: {} as any,
      DB: {} as any,
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      VAPID_SUBJECT: ''
    }

    await notifyNewMessage(env as any, '1', MESSAGE, mockSendPushForSession as any)
    expect(mockSendPushForSession).not.toHaveBeenCalled()
  })
})
