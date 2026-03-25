import '../tests/use-native-fetch'
import { describe, expect, test } from 'bun:test'
import { load } from './+page.server'
import { mockRequestEvent, mockUser, expectHttpError } from '../tests/mock-event'
import { MockD1Database } from '../tests/mock-d1'

describe('load / (home page)', () => {
  test('throws redirect when user is null', async () => {
    const event = mockRequestEvent({
      url: 'http://localhost/'
    })

    await expectHttpError(async () => await load(event as any), 302)
  })

  test('returns sessions for authenticated user', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT id, name, status, created_at FROM sessions', {
      results: [
        { id: 1, name: 'session-1', status: 'active', created_at: '2025-01-01T00:00:00Z' },
        { id: 2, name: 'session-2', status: 'active', created_at: '2025-01-02T00:00:00Z' }
      ]
    })

    const event = mockRequestEvent({
      url: 'http://localhost/',
      locals: { user: mockUser() },
      db
    })

    const result = await load(event as any) as any
    expect(result.sessions).toHaveLength(2)
    expect(result.sessions[0].name).toBe('session-1')
  })

  test('binds correct user_id to query', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT id, name, status, created_at FROM sessions', { results: [] })

    const event = mockRequestEvent({
      url: 'http://localhost/',
      locals: { user: mockUser({ id: 77 }) },
      db
    })

    await load(event as any)
    expect(db.calls[0].bindings[0]).toBe(77)
  })
})
