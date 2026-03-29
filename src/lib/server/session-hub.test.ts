import { describe, expect, test, mock, beforeEach } from 'bun:test'
import { MockD1Database } from '../../tests/mock-d1'

// Mock external dependencies
const mockVerifyToken = mock()
const mockVerifySession = mock()

void mock.module('../auth', () => ({
  verifyToken: mockVerifyToken
}))

void mock.module('../session', () => ({
  verifySession: mockVerifySession
}))

void mock.module('cloudflare:workers', () => ({
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  DurableObject: class {}
}))

const { SessionHub } = await import('./session-hub')

function createMockWebSocket (attachment: Record<string, unknown> = {}): {
  ws: any
  sent: string[]
  closed: Array<{ code: number, reason: string }>
} {
  let currentAttachment = { ...attachment }
  const sent: string[] = []
  const closed: Array<{ code: number, reason: string }> = []

  const ws = {
    send: mock((data: string) => { sent.push(data) }),
    close: mock((code: number, reason: string) => { closed.push({ code, reason }) }),
    serializeAttachment: mock((a: Record<string, unknown>) => { currentAttachment = a }),
    deserializeAttachment: mock(() => currentAttachment)
  }

  return { ws, sent, closed }
}

function createHub (db?: MockD1Database): any {
  const mockDb = db ?? new MockD1Database()
  const websockets: any[] = []

  const hub = Object.create(SessionHub.prototype)
  hub.env = {
    DB: mockDb as unknown as D1Database,
    HMAC_SECRET: 'test-secret',
    VAPID_PUBLIC_KEY: 'test-public-key',
    VAPID_PRIVATE_KEY: 'test-private-key',
    VAPID_SUBJECT: 'mailto:test@example.com'
  }
  hub.ctx = {
    acceptWebSocket: mock(),
    waitUntil: mock(),
    getWebSockets: mock(() => websockets)
  }

  return { hub, mockDb, websockets }
}

describe('SessionHub.webSocketMessage', () => {
  beforeEach(() => {
    mockVerifyToken.mockReset()
    mockVerifySession.mockReset()
  })

  test('ignores non-string data', async () => {
    const { hub } = createHub()
    const { ws, sent } = createMockWebSocket()

    await hub.webSocketMessage(ws, new ArrayBuffer(8))
    expect(sent).toHaveLength(0)
  })

  test('ignores invalid JSON', async () => {
    const { hub } = createHub()
    const { ws, sent } = createMockWebSocket()

    await hub.webSocketMessage(ws, 'not json')
    expect(sent).toHaveLength(0)
  })

  describe('auth messages', () => {
    test('authenticates with valid token and sets authType to token', async () => {
      const db = new MockD1Database()
      db.onQuery('SELECT id FROM sessions', { id: 1 })
      const { hub } = createHub(db)

      mockVerifyToken.mockResolvedValue({ userId: 1 })

      const { ws, sent } = createMockWebSocket({ authenticated: false, sessionId: '1' })

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'auth', token: 'valid-token' }))

      expect(ws.serializeAttachment).toHaveBeenCalledWith({ authenticated: true, authType: 'token', userId: 1, sessionId: '1' })
      expect(sent).toHaveLength(1)
      expect(JSON.parse(sent[0])).toEqual({ type: 'auth', status: 'ok' })
    })

    test('rejects invalid token', async () => {
      const { hub } = createHub()
      mockVerifyToken.mockResolvedValue(null)

      const { ws, sent, closed } = createMockWebSocket({ authenticated: false, sessionId: '1' })

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'auth', token: 'bad-token' }))

      expect(JSON.parse(sent[0])).toEqual({ type: 'error', message: 'Invalid token' })
      expect(closed[0]).toEqual({ code: 4003, reason: 'Invalid token' })
    })

    test('rejects token for wrong session', async () => {
      const db = new MockD1Database()
      const { hub } = createHub(db)

      mockVerifyToken.mockResolvedValue({ userId: 1 })

      const { ws, sent, closed } = createMockWebSocket({ authenticated: false, sessionId: '999' })

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'auth', token: 'valid-token' }))

      expect(JSON.parse(sent[0])).toEqual({ type: 'error', message: 'Forbidden' })
      expect(closed[0]).toEqual({ code: 4003, reason: 'Forbidden' })
    })
  })

  describe('message sending', () => {
    test('token-auth client inserts message with assistant role', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 42, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)

      const { ws: sender, sent: senderSent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '5' })
      const { ws: receiver, sent: receiverSent } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '5' })

      websockets.push(sender, receiver)

      await hub.webSocketMessage(sender, JSON.stringify({ type: 'message', content: 'hello world' }))

      const insertCall = db.calls.find((c: any) => c.sql.includes('INSERT INTO messages'))
      expect(insertCall).toBeTruthy()
      if (insertCall == null) return
      expect(insertCall.bindings[0]).toBe('5')
      expect(insertCall.bindings[1]).toBe('assistant')
      expect(insertCall.bindings[2]).toBe('hello world')

      // Verify broadcast to both clients on same session
      expect(senderSent).toHaveLength(1)
      expect(receiverSent).toHaveLength(1)

      const broadcasted = JSON.parse(senderSent[0])
      expect(broadcasted.type).toBe('message')
      expect(broadcasted.message.id).toBe(42)
      expect(broadcasted.message.session_id).toBe(5)
      expect(broadcasted.message.role).toBe('assistant')
      expect(broadcasted.message.content).toBe('hello world')
    })

    test('cookie-auth client inserts message with user role', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 10, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)

      const { ws, sent } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '3' })
      websockets.push(ws)

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'message', content: 'user message' }))

      const insertCall = db.calls.find((c: any) => c.sql.includes('INSERT INTO messages'))
      expect(insertCall).toBeTruthy()
      if (insertCall == null) return
      expect(insertCall.bindings[1]).toBe('user')

      const broadcasted = JSON.parse(sent[0])
      expect(broadcasted.message.role).toBe('user')
    })

    test('does not broadcast to clients on different sessions', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 1, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)

      const { ws: sender, sent: senderSent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '1' })
      const { ws: other, sent: otherSent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '2' })

      websockets.push(sender, other)

      await hub.webSocketMessage(sender, JSON.stringify({ type: 'message', content: 'test' }))

      expect(senderSent).toHaveLength(1)
      expect(otherSent).toHaveLength(0)
    })

    test('does not broadcast to unauthenticated clients', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 1, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)

      const { ws: sender, sent: senderSent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '1' })
      const { ws: unauthed, sent: unauthedSent } = createMockWebSocket({ authenticated: false })

      websockets.push(sender, unauthed)

      await hub.webSocketMessage(sender, JSON.stringify({ type: 'message', content: 'test' }))

      expect(senderSent).toHaveLength(1)
      expect(unauthedSent).toHaveLength(0)
    })

    test('rejects message from unauthenticated client', async () => {
      const { hub } = createHub()
      const { ws, sent } = createMockWebSocket({ authenticated: false, sessionId: '1' })

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'message', content: 'test' }))

      expect(JSON.parse(sent[0])).toEqual({ type: 'error', message: 'Not authenticated' })
    })

    test('rejects message from client with no sessionId', async () => {
      const { hub } = createHub()
      const { ws, sent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1 })

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'message', content: 'test' }))

      expect(JSON.parse(sent[0])).toEqual({ type: 'error', message: 'Not authenticated' })
    })

    test('ignores empty content', async () => {
      const { hub } = createHub()
      const { ws, sent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '1' })

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'message', content: '' }))
      expect(sent).toHaveLength(0)
    })

    test('ignores missing content', async () => {
      const { hub } = createHub()
      const { ws, sent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '1' })

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'message' }))
      expect(sent).toHaveLength(0)
    })

    test('updates session updated_at', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 1, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)
      const { ws } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '7' })
      websockets.push(ws)

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'message', content: 'test' }))

      const updateCall = db.calls.find((c: any) => c.sql.includes('UPDATE sessions'))
      expect(updateCall).toBeTruthy()
      if (updateCall == null) return
      expect(updateCall.bindings[0]).toBe('7')
    })

    test('triggers push notifications', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 1, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)
      const { ws } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '3' })
      websockets.push(ws)

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'message', content: 'push me' }))

      expect(hub.ctx.waitUntil).toHaveBeenCalled()
    })

    test('skips push when VAPID keys are empty', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 1, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)
      hub.env.VAPID_PUBLIC_KEY = ''

      const { ws } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '1' })
      websockets.push(ws)

      await hub.webSocketMessage(ws, JSON.stringify({ type: 'message', content: 'test' }))

      expect(hub.ctx.waitUntil).not.toHaveBeenCalled()
    })
  })

  describe('permission requests', () => {
    test('relays permission_request from token client to cookie clients', async () => {
      const { hub, websockets } = createHub()

      const { ws: sender } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '5' })
      const { ws: browser, sent: browserSent } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '5' })
      const { ws: otherToken, sent: otherTokenSent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '5' })

      websockets.push(sender, browser, otherToken)

      await hub.webSocketMessage(sender, JSON.stringify({
        type: 'permission_request',
        request_id: 'req-1',
        tool_name: 'Bash',
        description: 'Run command: ls',
        input_preview: '{"command":"ls"}'
      }))

      expect(browserSent).toHaveLength(1)
      const relayed = JSON.parse(browserSent[0])
      expect(relayed.type).toBe('permission_request')
      expect(relayed.request_id).toBe('req-1')
      expect(relayed.tool_name).toBe('Bash')
      expect(relayed.description).toBe('Run command: ls')
      expect(relayed.input_preview).toBe('{"command":"ls"}')

      // Should not relay to other token clients
      expect(otherTokenSent).toHaveLength(0)
    })

    test('does not relay permission_request from cookie client', async () => {
      const { hub, websockets } = createHub()

      const { ws: browser } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '5' })
      const { ws: tokenClient, sent: tokenSent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '5' })

      websockets.push(browser, tokenClient)

      await hub.webSocketMessage(browser, JSON.stringify({
        type: 'permission_request',
        request_id: 'req-1',
        tool_name: 'Bash',
        description: 'test',
        input_preview: '{}'
      }))

      expect(tokenSent).toHaveLength(0)
    })

    test('does not relay permission_request to cookie clients on different session', async () => {
      const { hub, websockets } = createHub()

      const { ws: sender } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '5' })
      const { ws: otherSession, sent: otherSent } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '6' })

      websockets.push(sender, otherSession)

      await hub.webSocketMessage(sender, JSON.stringify({
        type: 'permission_request',
        request_id: 'req-1',
        tool_name: 'Bash',
        description: 'test',
        input_preview: '{}'
      }))

      expect(otherSent).toHaveLength(0)
    })
  })

  describe('permission responses', () => {
    test('relays permission_response from cookie client to token clients and stores message', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 99, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)

      const { ws: browser } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '5' })
      const { ws: tokenClient, sent: tokenSent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '5' })
      const { ws: browserReceiver } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '5' })

      websockets.push(browser, tokenClient, browserReceiver)

      await hub.webSocketMessage(browser, JSON.stringify({
        type: 'permission_response',
        request_id: 'req-1',
        behavior: 'allow',
        tool_name: 'Bash',
        description: 'Run command: ls'
      }))

      // Token client receives contract-compliant response (no tool_name/description)
      expect(tokenSent).toHaveLength(2) // permission_response + broadcast message
      const response = JSON.parse(tokenSent[0])
      expect(response).toEqual({
        type: 'permission_response',
        request_id: 'req-1',
        behavior: 'allow'
      })
      expect(response.tool_name).toBeUndefined()
      expect(response.description).toBeUndefined()

      // Assistant message is stored
      const insertCall = db.calls.find((c: any) => c.sql.includes('INSERT INTO messages'))
      expect(insertCall).toBeTruthy()
      if (insertCall == null) return
      expect(insertCall.bindings[1]).toBe('assistant')
      expect(insertCall.bindings[2]).toContain('### Permission request')
      expect(insertCall.bindings[2]).toContain('**Bash**')
      expect(insertCall.bindings[2]).toContain('Run command: ls')
      expect(insertCall.bindings[2]).toContain('\u2705 Allowed')

      // Broadcast message sent to all clients on session
      const broadcastMsg = JSON.parse(tokenSent[1])
      expect(broadcastMsg.type).toBe('message')
      expect(broadcastMsg.message.role).toBe('assistant')
      expect(broadcastMsg.message.id).toBe(99)
    })

    test('stores denied permission with correct emoji', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 100, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)

      const { ws: browser } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '5' })
      websockets.push(browser)

      await hub.webSocketMessage(browser, JSON.stringify({
        type: 'permission_response',
        request_id: 'req-2',
        behavior: 'deny',
        tool_name: 'Bash',
        description: 'Run command: rm -rf /'
      }))

      const insertCall = db.calls.find((c: any) => c.sql.includes('INSERT INTO messages'))
      expect(insertCall).toBeTruthy()
      if (insertCall == null) return
      expect(insertCall.bindings[2]).toContain('\u274c Denied')
    })

    test('does not relay permission_response from token client', async () => {
      const { hub, websockets } = createHub()

      const { ws: tokenSender } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '5' })
      const { ws: browser, sent: browserSent } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '5' })

      websockets.push(tokenSender, browser)

      await hub.webSocketMessage(tokenSender, JSON.stringify({
        type: 'permission_response',
        request_id: 'req-1',
        behavior: 'allow'
      }))

      expect(browserSent).toHaveLength(0)
    })

    test('does not relay permission_response from unauthenticated client', async () => {
      const { hub, websockets } = createHub()

      const { ws: unauthed } = createMockWebSocket({ authenticated: false, sessionId: '5' })
      const { ws: tokenClient, sent: tokenSent } = createMockWebSocket({ authenticated: true, authType: 'token', userId: 1, sessionId: '5' })

      websockets.push(unauthed, tokenClient)

      await hub.webSocketMessage(unauthed, JSON.stringify({
        type: 'permission_response',
        request_id: 'req-1',
        behavior: 'allow'
      }))

      expect(tokenSent).toHaveLength(0)
    })

    test('uses fallback values when tool_name and description are missing', async () => {
      const db = new MockD1Database()
      db.onQuery('INSERT INTO messages', { meta: { last_row_id: 101, changes: 1 } })
      db.onQuery('UPDATE sessions', { meta: { last_row_id: 0, changes: 1 } })

      const { hub, websockets } = createHub(db)

      const { ws: browser } = createMockWebSocket({ authenticated: true, authType: 'cookie', userId: 1, sessionId: '5' })
      websockets.push(browser)

      await hub.webSocketMessage(browser, JSON.stringify({
        type: 'permission_response',
        request_id: 'req-3',
        behavior: 'allow'
      }))

      const insertCall = db.calls.find((c: any) => c.sql.includes('INSERT INTO messages'))
      expect(insertCall).toBeTruthy()
      if (insertCall == null) return
      expect(insertCall.bindings[2]).toContain('**Unknown tool**')
    })
  })
})

describe('SessionHub.handleBroadcast', () => {
  test('broadcasts to authenticated sockets only', async () => {
    const { hub, websockets } = createHub()

    const { ws: authed, sent: authedSent } = createMockWebSocket({ authenticated: true })
    const { ws: unauthed, sent: unauthedSent } = createMockWebSocket({ authenticated: false })

    websockets.push(authed, unauthed)

    const message = { id: 1, session_id: 1, role: 'user', content: 'hi', created_at: '2025-01-01T00:00:00Z' }
    const request = new Request('https://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify(message)
    })

    const response = await hub.handleBroadcast(request)
    expect(response.status).toBe(200)

    expect(authedSent).toHaveLength(1)
    expect(JSON.parse(authedSent[0])).toEqual({ type: 'message', message })
    expect(unauthedSent).toHaveLength(0)
  })
})
