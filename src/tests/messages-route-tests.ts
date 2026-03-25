import { describe, expect, test } from 'bun:test'
import { MockD1Database } from './mock-d1'
import { mockRequestEvent, mockUser, mockApiUser, expectHttpError } from './mock-event'

interface MessagesTestConfig {
  GET: (event: any) => Response | Promise<Response>
  POST: (event: any) => Response | Promise<Response>
  authKey: 'user' | 'apiUser'
  insertRole: 'user' | 'assistant'
  routePrefix: string
}

function makeAuth (config: MessagesTestConfig): Partial<App.Locals> {
  if (config.authKey === 'user') {
    return { user: mockUser() }
  }
  return { apiUser: mockApiUser() }
}

export function defineMessagesRouteTests (config: MessagesTestConfig): void {
  const { GET, POST, authKey, insertRole, routePrefix } = config

  describe(`GET ${routePrefix}/:id/messages`, () => {
    test(`throws 401 when ${authKey} is null`, async () => {
      const event = mockRequestEvent({
        url: `http://localhost${routePrefix}/1/messages`,
        params: { id: '1' }
      })

      await expectHttpError(async () => await GET(event as any), 401)
    })

    test('throws 404 when session not found', async () => {
      const db = new MockD1Database()

      const event = mockRequestEvent({
        url: `http://localhost${routePrefix}/999/messages`,
        params: { id: '999' },
        locals: makeAuth(config),
        db
      })

      await expectHttpError(async () => await GET(event as any), 404)
    })

    test('returns all messages when no since param', async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })
      db.onQuery('SELECT id, session_id', {
        results: [
          { id: 1, session_id: 1, role: 'user', content: 'hi', created_at: '2025-01-01T00:00:00Z' },
          { id: 2, session_id: 1, role: 'assistant', content: 'hello', created_at: '2025-01-01T00:00:01Z' }
        ]
      })

      const event = mockRequestEvent({
        url: `http://localhost${routePrefix}/1/messages`,
        params: { id: '1' },
        locals: makeAuth(config),
        db
      })

      const response = await GET(event as any)
      const data = await response.json() as any

      expect(data).toHaveLength(2)
      expect(data[0].role).toBe('user')
      expect(data[1].role).toBe('assistant')
    })

    test('filters messages by since param with T separator', async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })
      db.onQuery('SELECT id, session_id', { results: [] })

      const event = mockRequestEvent({
        url: `http://localhost${routePrefix}/1/messages?since=2025-01-01T00:00:00Z`,
        params: { id: '1' },
        locals: makeAuth(config),
        db
      })

      await GET(event as any)

      const selectCall = db.calls.find((c) => c.sql.includes('created_at >'))
      expect(selectCall).toBeTruthy()
      if (selectCall == null) return
      expect(selectCall.bindings[1]).toBe('2025-01-01T00:00:00Z')
    })

    test('accepts since param with space separator', async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })
      db.onQuery('SELECT id, session_id', { results: [] })

      const event = mockRequestEvent({
        url: `http://localhost${routePrefix}/1/messages?since=2025-01-01 00:00:00`,
        params: { id: '1' },
        locals: makeAuth(config),
        db
      })

      const response = await GET(event as any)
      expect(response.status).toBe(200)
    })

    test('throws 400 for invalid since format', async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })

      const event = mockRequestEvent({
        url: `http://localhost${routePrefix}/1/messages?since=not-a-date`,
        params: { id: '1' },
        locals: makeAuth(config),
        db
      })

      await expectHttpError(async () => await GET(event as any), 400)
    })
  })

  describe(`POST ${routePrefix}/:id/messages`, () => {
    test(`throws 401 when ${authKey} is null`, async () => {
      const event = mockRequestEvent({
        method: 'POST',
        url: `http://localhost${routePrefix}/1/messages`,
        params: { id: '1' },
        body: { content: 'hello' }
      })

      await expectHttpError(async () => await POST(event as any), 401)
    })

    test('throws 404 when session not found', async () => {
      const db = new MockD1Database()

      const event = mockRequestEvent({
        method: 'POST',
        url: `http://localhost${routePrefix}/999/messages`,
        params: { id: '999' },
        body: { content: 'hello' },
        locals: makeAuth(config),
        db
      })

      await expectHttpError(async () => await POST(event as any), 404)
    })

    test('throws 400 when content is missing', async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })

      const event = mockRequestEvent({
        method: 'POST',
        url: `http://localhost${routePrefix}/1/messages`,
        params: { id: '1' },
        body: {},
        locals: makeAuth(config),
        db
      })

      await expectHttpError(async () => await POST(event as any), 400)
    })

    test('throws 400 when content is empty string', async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })

      const event = mockRequestEvent({
        method: 'POST',
        url: `http://localhost${routePrefix}/1/messages`,
        params: { id: '1' },
        body: { content: '' },
        locals: makeAuth(config),
        db
      })

      await expectHttpError(async () => await POST(event as any), 400)
    })

    test(`inserts message with role=${insertRole} and returns id`, async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 42, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const event = mockRequestEvent({
        method: 'POST',
        url: `http://localhost${routePrefix}/1/messages`,
        params: { id: '1' },
        body: { content: 'hello world' },
        locals: makeAuth(config),
        db
      })

      const response = await POST(event as any)
      const data = await response.json() as any

      expect(data).toEqual({ id: 42 })

      const insertCall = db.calls.find((c) => c.sql.includes('INSERT INTO messages'))
      expect(insertCall).toBeTruthy()
      if (insertCall == null) return
      expect(insertCall.bindings[1]).toBe(insertRole)
      expect(insertCall.bindings[2]).toBe('hello world')
    })

    test('calls waitUntil with notifySessionHub', async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 1, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const event = mockRequestEvent({
        method: 'POST',
        url: `http://localhost${routePrefix}/1/messages`,
        params: { id: '1' },
        body: { content: 'test' },
        locals: makeAuth(config),
        db
      })

      await POST(event as any)
      expect(event.platform.context.waitUntil).toHaveBeenCalled()
    })
  })
}
