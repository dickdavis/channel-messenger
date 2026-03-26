import '../../../tests/use-native-fetch'
import { describe, expect, test, mock } from 'bun:test'
import { mockRequestEvent, mockUser, expectHttpError } from '../../../tests/mock-event'
import { MockD1Database } from '../../../tests/mock-d1'

void mock.module('$app/environment', () => ({ dev: false }))

const { POST, DELETE } = await import('./+server')

describe('POST /settings/push', () => {
  test('throws 401 when user not authenticated', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: { endpoint: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } }
    })

    await expectHttpError(async () => await POST(event as any), 401)
  })

  test('throws 400 when endpoint is missing', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: { keys: { p256dh: 'key1', auth: 'key2' } },
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await POST(event as any), 400)
  })

  test('throws 400 when endpoint is empty string', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: { endpoint: '', keys: { p256dh: 'key1', auth: 'key2' } },
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await POST(event as any), 400)
  })

  test('throws 400 when keys.p256dh is missing', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: { endpoint: 'https://push.example.com', keys: { auth: 'key2' } },
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await POST(event as any), 400)
  })

  test('throws 400 when keys.auth is missing', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: { endpoint: 'https://push.example.com', keys: { p256dh: 'key1' } },
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await POST(event as any), 400)
  })

  test('throws 400 when keys object is missing entirely', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: { endpoint: 'https://push.example.com' },
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await POST(event as any), 400)
  })

  test('throws 400 when endpoint is not https', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: { endpoint: 'http://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } },
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await POST(event as any), 400)
  })

  test('throws 400 when endpoint exceeds max length', async () => {
    const longEndpoint = 'https://push.example.com/' + 'a'.repeat(2048)
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: { endpoint: longEndpoint, keys: { p256dh: 'key1', auth: 'key2' } },
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await POST(event as any), 400)
  })

  test('throws 400 when user has too many subscriptions', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT COUNT', { count: 20 })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: {
        endpoint: 'https://push.example.com/new',
        keys: { p256dh: 'key1', auth: 'key2' }
      },
      locals: { user: mockUser() },
      db
    })

    await expectHttpError(async () => await POST(event as any), 400)
  })

  test('inserts subscription and returns 201', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT COUNT', { count: 0 })
    db.onQuery('INSERT OR REPLACE INTO push_subscriptions', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: { p256dh: 'p256dh-key-value', auth: 'auth-key-value' }
      },
      locals: { user: mockUser({ id: 42 }) },
      db
    })

    const response = await POST(event as any)
    expect(response.status).toBe(201)

    const data = await response.json() as any
    expect(data.ok).toBe(true)
  })

  test('binds correct values to the insert query', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT COUNT', { count: 0 })
    db.onQuery('INSERT OR REPLACE INTO push_subscriptions', { meta: { last_row_id: 1, changes: 1 } })

    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/settings/push',
      body: {
        endpoint: 'https://push.example.com/sub/123',
        keys: { p256dh: 'my-p256dh', auth: 'my-auth' }
      },
      locals: { user: mockUser({ id: 7 }) },
      db
    })

    await POST(event as any)

    const insertCall = db.calls.find((c) => c.sql.includes('INSERT OR REPLACE'))
    expect(insertCall).toBeTruthy()
    if (insertCall == null) return
    expect(insertCall.bindings[0]).toBe(7)
    expect(insertCall.bindings[1]).toBe('https://push.example.com/sub/123')
    expect(insertCall.bindings[2]).toBe('my-p256dh')
    expect(insertCall.bindings[3]).toBe('my-auth')
  })
})

describe('DELETE /settings/push', () => {
  test('throws 401 when user not authenticated', async () => {
    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/push',
      body: { endpoint: 'https://push.example.com' }
    })

    await expectHttpError(async () => await DELETE(event as any), 401)
  })

  test('throws 400 when endpoint is missing', async () => {
    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/push',
      body: {},
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await DELETE(event as any), 400)
  })

  test('throws 400 when endpoint is empty string', async () => {
    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/push',
      body: { endpoint: '' },
      locals: { user: mockUser() }
    })

    await expectHttpError(async () => await DELETE(event as any), 400)
  })

  test('deletes subscription and returns 200', async () => {
    const db = new MockD1Database()
    db.onQuery('DELETE FROM push_subscriptions', { meta: { last_row_id: 0, changes: 1 } })

    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/push',
      body: { endpoint: 'https://push.example.com/sub/123' },
      locals: { user: mockUser({ id: 5 }) },
      db
    })

    const response = await DELETE(event as any)
    expect(response.status).toBe(200)

    const data = await response.json() as any
    expect(data.ok).toBe(true)
  })

  test('binds correct user_id and endpoint to delete query', async () => {
    const db = new MockD1Database()
    db.onQuery('DELETE FROM push_subscriptions', { meta: { last_row_id: 0, changes: 1 } })

    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/push',
      body: { endpoint: 'https://push.example.com/sub/456' },
      locals: { user: mockUser({ id: 99 }) },
      db
    })

    await DELETE(event as any)

    const deleteCall = db.calls.find((c) => c.sql.includes('DELETE FROM push_subscriptions'))
    expect(deleteCall).toBeTruthy()
    if (deleteCall == null) return
    expect(deleteCall.bindings[0]).toBe(99)
    expect(deleteCall.bindings[1]).toBe('https://push.example.com/sub/456')
  })
})
