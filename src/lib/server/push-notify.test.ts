import { describe, expect, test, mock, beforeEach, spyOn } from 'bun:test'
import { MockD1Database } from '../../tests/mock-d1'

const mockSendNotification = mock()

const webpushMock = {
  sendNotification: mockSendNotification
}

void mock.module('web-push', () => ({
  default: webpushMock,
  ...webpushMock
}))

const { sendPushForSession } = await import('./push-notify')

const ENV = {
  VAPID_SUBJECT: 'mailto:test@example.com',
  VAPID_PUBLIC_KEY: 'test-public-key',
  VAPID_PRIVATE_KEY: 'test-private-key'
}

const EXPECTED_VAPID_OPTIONS = {
  vapidDetails: {
    subject: ENV.VAPID_SUBJECT,
    publicKey: ENV.VAPID_PUBLIC_KEY,
    privateKey: ENV.VAPID_PRIVATE_KEY
  }
}

describe('sendPushForSession', () => {
  beforeEach(() => {
    mockSendNotification.mockReset()
    mockSendNotification.mockResolvedValue({})
  })

  test('does nothing when session is not found', async () => {
    const db = new MockD1Database()

    await sendPushForSession(db as any, ENV, '999', { role: 'assistant', content: 'hello' })
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  test('does nothing when user has no subscriptions', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'My Session' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', { results: [] })

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'hello' })
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  test('passes VAPID details as per-request options', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'Test' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 1, endpoint: 'https://push.example.com', key_p256dh: 'p256', key_auth: 'auth' }]
    })

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'hi' })

    const call = mockSendNotification.mock.calls[0]
    expect(call[2]).toEqual(EXPECTED_VAPID_OPTIONS)
  })

  test('sends notification to each subscription', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'My Session' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [
        { id: 1, endpoint: 'https://push1.example.com', key_p256dh: 'p1', key_auth: 'a1' },
        { id: 2, endpoint: 'https://push2.example.com', key_p256dh: 'p2', key_auth: 'a2' }
      ]
    })

    await sendPushForSession(db as any, ENV, '5', { role: 'assistant', content: 'hello' })

    expect(mockSendNotification).toHaveBeenCalledTimes(2)

    const firstCall = mockSendNotification.mock.calls[0]
    expect(firstCall[0]).toEqual({ endpoint: 'https://push1.example.com', keys: { p256dh: 'p1', auth: 'a1' } })

    const secondCall = mockSendNotification.mock.calls[1]
    expect(secondCall[0]).toEqual({ endpoint: 'https://push2.example.com', keys: { p256dh: 'p2', auth: 'a2' } })
  })

  test('sends correct payload with session name and URL', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'Deploy Fix' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 1, endpoint: 'https://push.example.com', key_p256dh: 'p', key_auth: 'a' }]
    })

    await sendPushForSession(db as any, ENV, '42', { role: 'assistant', content: 'Build succeeded' })

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(payload.title).toBe('Deploy Fix')
    expect(payload.body).toBe('Build succeeded')
    expect(payload.url).toBe('/?session=42')
  })

  test('uses fallback title when session has no name', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: null })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 1, endpoint: 'https://push.example.com', key_p256dh: 'p', key_auth: 'a' }]
    })

    await sendPushForSession(db as any, ENV, '7', { role: 'assistant', content: 'hi' })

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(payload.title).toBe('Session 7')
  })

  test('truncates long session name to 100 chars', async () => {
    const db = new MockD1Database()
    const longName = 'a'.repeat(150)
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: longName })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 1, endpoint: 'https://push.example.com', key_p256dh: 'p', key_auth: 'a' }]
    })

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'hi' })

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(payload.title).toBe('a'.repeat(100) + '\u2026')
    expect(payload.title.length).toBe(101)
  })

  test('does not truncate session name of exactly 100 chars', async () => {
    const db = new MockD1Database()
    const name = 'b'.repeat(100)
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 1, endpoint: 'https://push.example.com', key_p256dh: 'p', key_auth: 'a' }]
    })

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'hi' })

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(payload.title).toBe(name)
  })

  test('truncates long message content to 200 chars', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'Test' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 1, endpoint: 'https://push.example.com', key_p256dh: 'p', key_auth: 'a' }]
    })

    const longContent = 'x'.repeat(300)
    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: longContent })

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(payload.body.length).toBe(201) // 200 chars + ellipsis
    expect(payload.body).toBe('x'.repeat(200) + '\u2026')
  })

  test('does not truncate content of exactly 200 chars', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'Test' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 1, endpoint: 'https://push.example.com', key_p256dh: 'p', key_auth: 'a' }]
    })

    const content = 'x'.repeat(200)
    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content })

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(payload.body).toBe(content)
  })

  test('deletes subscription when push service returns 410 Gone', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'Test' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 77, endpoint: 'https://expired.example.com', key_p256dh: 'p', key_auth: 'a' }]
    })
    db.onQuery('DELETE FROM push_subscriptions', { meta: { last_row_id: 0, changes: 1 } })

    mockSendNotification.mockRejectedValue({ statusCode: 410 })

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'test' })

    const deleteCall = db.calls.find((c) => c.sql.includes('DELETE FROM push_subscriptions'))
    expect(deleteCall).toBeTruthy()
    if (deleteCall == null) return
    expect(deleteCall.bindings[0]).toBe(77)
  })

  test('logs non-410 errors to console.error', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'Test' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [{ id: 1, endpoint: 'https://push.example.com', key_p256dh: 'p', key_auth: 'a' }]
    })

    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    mockSendNotification.mockRejectedValue({ statusCode: 500 })

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'test' })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0][0]).toBe('Push notification failed')
    expect(errorSpy.mock.calls[0][1]).toMatchObject({ endpoint: 'https://push.example.com', statusCode: 500 })

    const deleteCall = db.calls.find((c) => c.sql.includes('DELETE FROM push_subscriptions'))
    expect(deleteCall).toBeUndefined()

    errorSpy.mockRestore()
  })

  test('does not throw when one subscription fails', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'Test' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', {
      results: [
        { id: 1, endpoint: 'https://fail.example.com', key_p256dh: 'p1', key_auth: 'a1' },
        { id: 2, endpoint: 'https://ok.example.com', key_p256dh: 'p2', key_auth: 'a2' }
      ]
    })

    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    mockSendNotification
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce({})

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'test' })
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
    errorSpy.mockRestore()
  })

  test('queries subscriptions using session owner user_id', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 42, name: 'Test' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', { results: [] })

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'test' })

    const subQuery = db.calls.find((c) => c.sql.includes('push_subscriptions'))
    expect(subQuery).toBeTruthy()
    if (subQuery == null) return
    expect(subQuery.bindings[0]).toBe(42)
  })

  test('applies LIMIT to subscription query', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id, name FROM sessions', { user_id: 1, name: 'Test' })
    db.onQuery('SELECT id, endpoint, key_p256dh, key_auth FROM push_subscriptions', { results: [] })

    await sendPushForSession(db as any, ENV, '1', { role: 'assistant', content: 'test' })

    const subQuery = db.calls.find((c) => c.sql.includes('push_subscriptions'))
    expect(subQuery).toBeTruthy()
    if (subQuery == null) return
    expect(subQuery.sql).toContain('LIMIT')
    expect(subQuery.bindings[1]).toBe(20)
  })
})
