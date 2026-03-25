import '../../tests/use-native-fetch'
import { describe, expect, test } from 'bun:test'
import { load } from './+page.server'
import { mockRequestEvent, mockUser, expectHttpError } from '../../tests/mock-event'
import { MockD1Database } from '../../tests/mock-d1'

describe('load /settings', () => {
  test('throws redirect when user is null', async () => {
    const event = mockRequestEvent({
      url: 'http://localhost/settings'
    })

    await expectHttpError(async () => await load(event as any), 302)
  })

  test('returns API keys for authenticated user', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT id, name, created_at, revoked_at FROM api_keys', {
      results: [
        { id: 1, name: 'key-1', created_at: '2025-01-01T00:00:00Z', revoked_at: null },
        { id: 2, name: null, created_at: '2025-01-02T00:00:00Z', revoked_at: '2025-01-03T00:00:00Z' }
      ]
    })

    const event = mockRequestEvent({
      url: 'http://localhost/settings',
      locals: { user: mockUser() },
      db
    })

    const result = await load(event as any) as any
    expect(result.keys).toHaveLength(2)
    expect(result.keys[0].name).toBe('key-1')
    expect(result.keys[1].revoked_at).toBe('2025-01-03T00:00:00Z')
  })

  test('binds correct user_id to query', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT id, name, created_at, revoked_at FROM api_keys', { results: [] })

    const event = mockRequestEvent({
      url: 'http://localhost/settings',
      locals: { user: mockUser({ id: 55 }) },
      db
    })

    await load(event as any)
    expect(db.calls[0].bindings[0]).toBe(55)
  })
})
