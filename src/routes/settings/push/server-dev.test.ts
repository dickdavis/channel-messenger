import '../../../tests/use-native-fetch'
import { describe, expect, test, mock } from 'bun:test'
import { mockRequestEvent, mockUser } from '../../../tests/mock-event'
import { MockD1Database } from '../../../tests/mock-d1'

void mock.module('$app/environment', () => ({ dev: true }))

const { POST } = await import('./+server')

describe('POST /settings/push (dev mode)', () => {
  test('allows http:// endpoints in dev mode', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT COUNT', { count: 0 })
    db.onQuery('INSERT OR REPLACE INTO push_subscriptions', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: {
        endpoint: 'http://localhost:8787/push/sub/123',
        keys: { p256dh: 'key1', auth: 'key2' }
      },
      locals: { user: mockUser() },
      db
    })

    const response = await POST(event as any)
    expect(response.status).toBe(201)
  })
})
