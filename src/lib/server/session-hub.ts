import { DurableObject } from 'cloudflare:workers'
import { verifyToken } from '../auth'

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

const AUTH_TIMEOUT_MS = 5000

export class SessionHub extends DurableObject<Env> {
  private readonly authenticated: Set<WebSocket> = new Set()

  async fetch (request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return await this.handleBroadcast(request)
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      return await this.handleWebSocketUpgrade()
    }

    return new Response('Not found', { status: 404 })
  }

  async handleWebSocketUpgrade (): Promise<Response> {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    // Schedule auth timeout — close if not authenticated within 5s
    this.ctx.waitUntil(this.enforceAuthTimeout(server))

    return new Response(null, { status: 101, webSocket: client })
  }

  async enforceAuthTimeout (ws: WebSocket): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, AUTH_TIMEOUT_MS))
    if (!this.authenticated.has(ws)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout' }))
      ws.close(4001, 'Authentication timeout')
    }
  }

  async handleBroadcast (request: Request): Promise<Response> {
    const message: BroadcastPayload = await request.json()
    const payload = JSON.stringify({ type: 'message', message })

    for (const ws of this.authenticated) {
      ws.send(payload)
    }

    return new Response('ok')
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
      if (result != null) {
        this.authenticated.add(ws)
        ws.send(JSON.stringify({ type: 'auth', status: 'ok' }))
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }))
        ws.close(4003, 'Invalid token')
      }
    }
  }

  async webSocketClose (): Promise<void> {
    // Rebuild authenticated set from live sockets
    const live = new Set(this.ctx.getWebSockets())
    for (const ws of this.authenticated) {
      if (!live.has(ws)) {
        this.authenticated.delete(ws)
      }
    }
  }

  async webSocketError (ws: WebSocket): Promise<void> {
    this.authenticated.delete(ws)
    ws.close(1011, 'Unexpected error')
  }
}
