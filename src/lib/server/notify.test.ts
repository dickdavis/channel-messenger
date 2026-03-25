import { describe, expect, test, mock, afterEach } from 'bun:test'

void mock.module('$app/environment', () => ({ dev: true }))

const { notifySessionHub } = await import('./notify')

const MESSAGE = {
  id: 1,
  session_id: 1,
  role: 'user',
  content: 'hello',
  created_at: '2025-01-01T00:00:00Z'
}

describe('notifySessionHub (dev mode)', () => {
  afterEach(() => {
    delete (globalThis as any).devSessionBroadcast
  })

  test('calls globalThis.devSessionBroadcast when available', async () => {
    const broadcast = mock()
    ;(globalThis as any).devSessionBroadcast = broadcast

    await notifySessionHub({} as any, '1', MESSAGE)
    expect(broadcast).toHaveBeenCalledWith('1', MESSAGE)
  })

  test('does nothing when devSessionBroadcast is not set', async () => {
    await notifySessionHub({} as any, '1', MESSAGE)
  })

  test('does not call DurableObject methods', async () => {
    const mockFetch = mock()
    const stubHub = {
      idFromName: mock(() => 'id'),
      get: mock(() => ({ fetch: mockFetch }))
    }

    await notifySessionHub(stubHub as any, '1', MESSAGE)
    expect(stubHub.idFromName).not.toHaveBeenCalled()
  })
})
