import '../../../tests/use-native-fetch'
import { describe, expect, test } from 'bun:test'
import { POST } from './+server'
import { mockRequestEvent, mockUser, expectHttpError } from '../../../tests/mock-event'
import { MockD1Database } from '../../../tests/mock-d1'

describe('POST /settings/keys', () => {
  test('throws 401 when user not authenticated', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/keys',
      body: {}
    })

    await expectHttpError(async () => await POST(event as any), 401)
  })

  test('generates token and returns it with name', async () => {
    const db = new MockD1Database()
    db.onQuery('INSERT INTO api_keys', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/keys',
      body: { name: 'my-key' },
      locals: { user: mockUser() },
      db
    })

    const response = await POST(event as any)
    const data = await response.json() as any

    expect(data.token).toMatch(/^[0-9a-f]{64}$/)
    expect(data.name).toBe('my-key')
  })

  test('stores hashed token in DB, not raw token', async () => {
    const db = new MockD1Database()
    db.onQuery('INSERT INTO api_keys', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/keys',
      body: { name: 'test' },
      locals: { user: mockUser() },
      db
    })

    const response = await POST(event as any)
    const data = await response.json() as any

    const storedHash = db.calls[0].bindings[1]
    expect(storedHash).not.toBe(data.token)
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('defaults name to null when not provided', async () => {
    const db = new MockD1Database()
    db.onQuery('INSERT INTO api_keys', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/keys',
      body: {},
      locals: { user: mockUser() },
      db
    })

    const response = await POST(event as any)
    const data = await response.json() as any

    expect(data.name).toBeNull()
    expect(db.calls[0].bindings[2]).toBeNull()
  })

  test('handles malformed JSON body gracefully', async () => {
    const db = new MockD1Database()
    db.onQuery('INSERT INTO api_keys', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/keys',
      locals: { user: mockUser() },
      db
    })
    // Override request with non-JSON body
    ;(event as any).request = new Request('http://localhost/settings/keys', {
      method: 'POST',
      body: 'not json'
    })

    const response = await POST(event as any)
    const data = await response.json() as any
    expect(data.token).toMatch(/^[0-9a-f]{64}$/)
    expect(data.name).toBeNull()
  })
})
