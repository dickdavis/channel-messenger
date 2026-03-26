import { describe, expect, test, mock, afterEach, beforeEach } from 'bun:test'

void mock.module('$app/environment', () => ({ dev: true }))

const { notifyNewMessage } = await import('./notify')

const mockSendPushForSession = mock()

const ASSISTANT_MESSAGE = {
  id: 1,
  session_id: 1,
  role: 'assistant',
  content: 'hello',
  created_at: '2025-01-01T00:00:00Z'
}

const USER_MESSAGE = {
  id: 2,
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

    await notifyNewMessage(env as any, '1', ASSISTANT_MESSAGE, mockSendPushForSession as any)
    expect(broadcast).toHaveBeenCalledWith('1', ASSISTANT_MESSAGE)
  })

  test('sends push notifications for assistant messages when VAPID keys are configured', async () => {
    const env = {
      SESSION_HUB: {} as any,
      DB: {} as any,
      VAPID_PUBLIC_KEY: 'key',
      VAPID_PRIVATE_KEY: 'secret',
      VAPID_SUBJECT: 'mailto:test@example.com'
    }

    await notifyNewMessage(env as any, '1', ASSISTANT_MESSAGE, mockSendPushForSession as any)
    expect(mockSendPushForSession).toHaveBeenCalledWith(
      env.DB,
      env,
      '1',
      ASSISTANT_MESSAGE
    )
  })

  test('skips push for user messages', async () => {
    const env = {
      SESSION_HUB: {} as any,
      DB: {} as any,
      VAPID_PUBLIC_KEY: 'key',
      VAPID_PRIVATE_KEY: 'secret',
      VAPID_SUBJECT: 'mailto:test@example.com'
    }

    await notifyNewMessage(env as any, '1', USER_MESSAGE, mockSendPushForSession as any)
    expect(mockSendPushForSession).not.toHaveBeenCalled()
  })

  test('skips push when VAPID keys are empty', async () => {
    const env = {
      SESSION_HUB: {} as any,
      DB: {} as any,
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      VAPID_SUBJECT: ''
    }

    await notifyNewMessage(env as any, '1', ASSISTANT_MESSAGE, mockSendPushForSession as any)
    expect(mockSendPushForSession).not.toHaveBeenCalled()
  })
})
