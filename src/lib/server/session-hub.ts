import { DurableObject } from 'cloudflare:workers'
import { verifyToken } from '../auth'
import { verifySession } from '../session'
import { sendPushForSession } from './push-notify'

interface Env {
  DB: D1Database
  HMAC_SECRET: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

interface BroadcastPayload {
  id: number
  session_id: number
  role: string
  content: string
  created_at: string
}

interface SocketAttachment {
  authenticated: boolean
  authType?: 'cookie' | 'token'
  userId?: number
  sessionId?: string
}

const AUTH_TIMEOUT_MS = 5000

function parseSessionId (url: string): string | null {
  const match = url.match(/\/api\/ws\/sessions\/(\d+)$/)
  return match != null ? match[1] : null
}

export class SessionHub extends DurableObject<Env> {
  async fetch (request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return await this.handleBroadcast(request)
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      return await this.handleWebSocketUpgrade(request)
    }

    return new Response('Not found', { status: 404 })
  }

  async handleWebSocketUpgrade (request: Request): Promise<Response> {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    const sessionId = parseSessionId(request.url)

    // Try cookie auth first (browser clients)
    const cookieHeader = request.headers.get('Cookie')
    const user = await verifySession(this.env.HMAC_SECRET, cookieHeader)

    if (user != null) {
      const owns = sessionId != null && await this.verifyOwnership(sessionId, user.id)
      if (owns) {
        server.serializeAttachment({ authenticated: true, authType: 'cookie', userId: user.id, sessionId })
        server.send(JSON.stringify({ type: 'auth', status: 'ok' }))
        return new Response(null, { status: 101, webSocket: client })
      }
      // Valid cookie but wrong session — reject immediately
      server.send(JSON.stringify({ type: 'error', message: 'Forbidden' }))
      server.close(4003, 'Forbidden')
      return new Response(null, { status: 101, webSocket: client })
    }

    // Fall back to token auth message flow
    server.serializeAttachment({ authenticated: false, sessionId })
    this.ctx.waitUntil(this.enforceAuthTimeout(server))

    return new Response(null, { status: 101, webSocket: client })
  }

  async enforceAuthTimeout (ws: WebSocket): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, AUTH_TIMEOUT_MS))
    const attachment: SocketAttachment | null = ws.deserializeAttachment()
    if (attachment?.authenticated !== true) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout' }))
      ws.close(4001, 'Authentication timeout')
    }
  }

  async handleBroadcast (request: Request): Promise<Response> {
    const message: BroadcastPayload = await request.json()
    const payload = JSON.stringify({ type: 'message', message })

    // getWebSockets() returns all live sockets — survives hibernation
    for (const ws of this.ctx.getWebSockets()) {
      const attachment: SocketAttachment | null = ws.deserializeAttachment()
      if (attachment?.authenticated === true) {
        ws.send(payload)
      }
    }

    return new Response('ok')
  }

  async verifyOwnership (sessionId: string, userId: number): Promise<boolean> {
    const row = await this.env.DB
      .prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, userId)
      .first()
    return row != null
  }

  async webSocketMessage (ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string') return

    let parsed: { type: string, token?: string, content?: string, request_id?: string, tool_name?: string, description?: string, input_preview?: string, behavior?: string }
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }

    if (parsed.type === 'auth' && typeof parsed.token === 'string') {
      const result = await verifyToken(this.env.DB, this.env.HMAC_SECRET, parsed.token)
      if (result == null) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }))
        ws.close(4003, 'Invalid token')
        return
      }

      const attachment: SocketAttachment | null = ws.deserializeAttachment()
      const sessionId = attachment?.sessionId
      if (sessionId != null) {
        const owns = await this.verifyOwnership(sessionId, result.userId)
        if (!owns) {
          ws.send(JSON.stringify({ type: 'error', message: 'Forbidden' }))
          ws.close(4003, 'Forbidden')
          return
        }
      }

      ws.serializeAttachment({ authenticated: true, authType: 'token', userId: result.userId, sessionId })
      ws.send(JSON.stringify({ type: 'auth', status: 'ok' }))
      return
    }

    if (parsed.type === 'message' && typeof parsed.content === 'string' && parsed.content !== '') {
      try {
        await this.handleIncomingMessage(ws, parsed.content)
      } catch (err) {
        console.error('[session-hub] handleIncomingMessage error:', err)
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }))
      }
    }

    if (parsed.type === 'permission_request' && typeof parsed.request_id === 'string') {
      await this.handlePermissionRequest(ws, parsed)
    }

    if (parsed.type === 'permission_response' && typeof parsed.request_id === 'string' && typeof parsed.behavior === 'string') {
      await this.handlePermissionResponse(ws, parsed as { type: string, request_id: string, behavior: string, tool_name?: string, description?: string })
    }
  }

  async handleIncomingMessage (ws: WebSocket, content: string): Promise<void> {
    const attachment: SocketAttachment | null = ws.deserializeAttachment()
    if (attachment?.authenticated !== true || attachment.sessionId == null) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
      return
    }

    const sessionId = attachment.sessionId
    const role = attachment.authType === 'cookie' ? 'user' : 'assistant'
    const db = this.env.DB

    console.log(`[session-hub] Incoming WS message: session=${sessionId} role=${role} len=${content.length}`)

    const result = await db
      .prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
      .bind(sessionId, role, content)
      .run()

    await db
      .prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?")
      .bind(sessionId)
      .run()

    const message: BroadcastPayload = {
      id: result.meta.last_row_id,
      session_id: Number(sessionId),
      role,
      content,
      created_at: new Date().toISOString()
    }

    // Broadcast to all connected clients on this session
    const sockets = this.ctx.getWebSockets()
    const payload = JSON.stringify({ type: 'message', message })
    let broadcastCount = 0
    for (const client of sockets) {
      const clientAttachment: SocketAttachment | null = client.deserializeAttachment()
      if (clientAttachment?.authenticated === true && clientAttachment.sessionId === sessionId) {
        client.send(payload)
        broadcastCount++
      }
    }
    console.log(`[session-hub] Broadcast message ${message.id} to ${broadcastCount}/${sockets.length} clients`)

    // Send push notifications only for assistant messages
    if (role === 'assistant' && this.env.VAPID_PUBLIC_KEY !== '' && this.env.VAPID_PRIVATE_KEY !== '' && this.env.VAPID_SUBJECT !== '') {
      this.ctx.waitUntil(sendPushForSession(db, this.env, sessionId, message))
    }
  }

  async handlePermissionRequest (ws: WebSocket, parsed: { request_id?: string, tool_name?: string, description?: string, input_preview?: string }): Promise<void> {
    const attachment: SocketAttachment | null = ws.deserializeAttachment()
    if (attachment?.authenticated !== true || attachment.authType !== 'token') return

    const payload = JSON.stringify({
      type: 'permission_request',
      request_id: parsed.request_id,
      tool_name: parsed.tool_name,
      description: parsed.description,
      input_preview: parsed.input_preview
    })

    for (const client of this.ctx.getWebSockets()) {
      const clientAttachment: SocketAttachment | null = client.deserializeAttachment()
      if (clientAttachment?.authenticated === true &&
          clientAttachment.authType === 'cookie' &&
          clientAttachment.sessionId === attachment.sessionId) {
        client.send(payload)
      }
    }
  }

  async handlePermissionResponse (ws: WebSocket, parsed: { request_id: string, behavior: string, tool_name?: string, description?: string }): Promise<void> {
    const attachment: SocketAttachment | null = ws.deserializeAttachment()
    if (attachment?.authenticated !== true || attachment.authType !== 'cookie' || attachment.sessionId == null) return

    const sessionId = attachment.sessionId

    // Relay to token clients (only type/request_id/behavior per data contract)
    const responsePayload = JSON.stringify({
      type: 'permission_response',
      request_id: parsed.request_id,
      behavior: parsed.behavior
    })

    for (const client of this.ctx.getWebSockets()) {
      const clientAttachment: SocketAttachment | null = client.deserializeAttachment()
      if (clientAttachment?.authenticated === true &&
          clientAttachment.authType === 'token' &&
          clientAttachment.sessionId === sessionId) {
        client.send(responsePayload)
      }
    }

    // Store decision as assistant message
    const toolName = parsed.tool_name ?? 'Unknown tool'
    const description = parsed.description ?? ''
    const statusLine = parsed.behavior === 'allow' ? '\u2705 Allowed' : '\u274c Denied'
    const content = `### Permission request\n**${toolName}**\n\n${description}\n\n${statusLine}`

    const db = this.env.DB
    const result = await db
      .prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
      .bind(sessionId, 'assistant', content)
      .run()

    await db
      .prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?")
      .bind(sessionId)
      .run()

    const message: BroadcastPayload = {
      id: result.meta.last_row_id,
      session_id: Number(sessionId),
      role: 'assistant',
      content,
      created_at: new Date().toISOString()
    }

    const msgPayload = JSON.stringify({ type: 'message', message })
    for (const client of this.ctx.getWebSockets()) {
      const clientAttachment: SocketAttachment | null = client.deserializeAttachment()
      if (clientAttachment?.authenticated === true && clientAttachment.sessionId === sessionId) {
        client.send(msgPayload)
      }
    }
  }

  async webSocketClose (): Promise<void> {
    // No cleanup needed — hibernation API manages the socket set
  }

  async webSocketError (ws: WebSocket): Promise<void> {
    ws.close(1011, 'Unexpected error')
  }
}
