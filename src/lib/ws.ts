export interface Message {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface PermissionRequest {
  request_id: string
  tool_name: string
  description: string
  input_preview: string
}

interface WSCallbacks {
  onMessage: (msg: Message) => void
  onConnect: (isReconnect: boolean) => void
  onPermissionRequest?: (req: PermissionRequest) => void
}

const MAX_BACKOFF_MS = 30000

export function createSessionSocket (
  sessionId: number,
  callbacks: WSCallbacks
): { close: () => void, send: (data: unknown) => void } {
  let disposed = false
  let ws: WebSocket | null = null
  let backoff = 1000
  let hasConnectedBefore = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function connect (): void {
    if (disposed) return

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${location.host}/api/ws/sessions/${sessionId}`)

    ws.addEventListener('message', (event) => {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(event.data)
      } catch {
        return
      }

      if (parsed.type === 'auth' && parsed.status === 'ok') {
        const isReconnect = hasConnectedBefore
        hasConnectedBefore = true
        backoff = 1000
        callbacks.onConnect(isReconnect)
        return
      }

      if (parsed.type === 'message' && parsed.message != null) {
        callbacks.onMessage(parsed.message as Message)
      }

      if (parsed.type === 'permission_request' && callbacks.onPermissionRequest != null) {
        callbacks.onPermissionRequest(parsed as unknown as PermissionRequest)
      }
    })

    ws.addEventListener('close', () => {
      if (disposed) return
      scheduleReconnect()
    })

    ws.addEventListener('error', () => {
      // The close event will fire after this, triggering reconnect
    })
  }

  function scheduleReconnect (): void {
    if (disposed) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, backoff)
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  }

  function send (data: unknown): void {
    if (ws != null && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }

  function close (): void {
    disposed = true
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws != null) {
      ws.close()
      ws = null
    }
  }

  connect()

  return { close, send }
}
