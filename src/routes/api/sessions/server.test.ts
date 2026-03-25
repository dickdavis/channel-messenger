import '../../../tests/use-native-fetch'
import { describe, expect, test } from 'bun:test'
import { POST } from './+server'
import { mockRequestEvent, mockApiUser, expectHttpError } from '../../../tests/mock-event'
import { MockD1Database } from '../../../tests/mock-d1'

describe('POST /api/sessions', () => {
  test('throws 401 when apiUser is null', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/api/sessions',
      body: {}
    })

    await expectHttpError(async () => await POST(event as any), 401)
  })

  test('creates session with provided name', async () => {
    const db = new MockD1Database()
    db.onQuery('INSERT INTO sessions', { meta: { last_row_id: 42, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/api/sessions',
      body: { name: 'my-session' },
      locals: { apiUser: mockApiUser() },
      db
    })

    const response = await POST(event as any)
    const data = await response.json() as any

    expect(data).toEqual({ id: 42, name: 'my-session' })
  })

  test('generates name when not provided', async () => {
    const db = new MockD1Database()
    db.onQuery('INSERT INTO sessions', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/api/sessions',
      body: {},
      locals: { apiUser: mockApiUser() },
      db
    })

    const response = await POST(event as any)
    const data = await response.json() as any

    expect(data.id).toBe(1)
    expect(data.name).toMatch(/^[a-z]+-[a-z]+$/)
  })

  test('binds correct userId to query', async () => {
    const db = new MockD1Database()
    db.onQuery('INSERT INTO sessions', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/api/sessions',
      body: { name: 'test' },
      locals: { apiUser: mockApiUser({ userId: 99 }) },
      db
    })

    await POST(event as any)
    expect(db.calls[0].bindings[0]).toBe(99)
  })
})
