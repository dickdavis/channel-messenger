import { DurableObject } from 'cloudflare:workers'
import { verifyToken } from '../auth'
import { verifySession } from '../session'

interface Env {
  DB: D1Database
  HMAC_SECRET: string
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
        server.serializeAttachment({ authenticated: true, userId: user.id, sessionId })
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

    let parsed: { type: string, token?: string }
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

      ws.serializeAttachment({ authenticated: true, userId: result.userId, sessionId })
      ws.send(JSON.stringify({ type: 'auth', status: 'ok' }))
    }
  }

  async webSocketClose (): Promise<void> {
    // No cleanup needed — hibernation API manages the socket set
  }

  async webSocketError (ws: WebSocket): Promise<void> {
    ws.close(1011, 'Unexpected error')
  }
}
