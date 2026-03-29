import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test'
import { createSessionSocket, type Message, type PermissionRequest } from './ws'

// Mock WebSocket
let mockInstances: MockWebSocket[] = []

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  listeners: Record<string, Array<(event: any) => void>> = {}
  sent: string[] = []

  constructor (public url: string) {
    mockInstances.push(this)
  }

  addEventListener (event: string, handler: (event: any) => void): void {
    if (this.listeners[event] == null) this.listeners[event] = []
    this.listeners[event].push(handler)
  }

  send (data: string): void {
    this.sent.push(data)
  }

  close (): void {
    this.readyState = MockWebSocket.CLOSED
  }

  // Test helpers
  emit (event: string, data?: any): void {
    for (const handler of this.listeners[event] ?? []) {
      handler(data)
    }
  }

  receiveMessage (payload: unknown): void {
    this.emit('message', { data: JSON.stringify(payload) })
  }
}

beforeEach(() => {
  mockInstances = []
  ;(globalThis as any).WebSocket = MockWebSocket
})

afterEach(() => {
  delete (globalThis as any).WebSocket
})

describe('createSessionSocket', () => {
  test('returns close and send functions', () => {
    const result = createSessionSocket(1, {
      onMessage: mock(),
      onConnect: mock()
    })
    expect(typeof result.close).toBe('function')
    expect(typeof result.send).toBe('function')
    result.close()
  })

  test('calls onConnect when auth succeeds', () => {
    const onConnect = mock()
    const socket = createSessionSocket(1, {
      onMessage: mock(),
      onConnect
    })

    mockInstances[0].receiveMessage({ type: 'auth', status: 'ok' })

    expect(onConnect).toHaveBeenCalledWith(false)
    socket.close()
  })

  test('calls onMessage for message events', () => {
    const onMessage = mock()
    const socket = createSessionSocket(1, {
      onMessage,
      onConnect: mock()
    })

    const msg: Message = { id: 1, session_id: 1, role: 'user', content: 'hello', created_at: '2026-01-01T00:00:00Z' }
    mockInstances[0].receiveMessage({ type: 'message', message: msg })

    expect(onMessage).toHaveBeenCalledWith(msg)
    socket.close()
  })

  test('calls onPermissionRequest for permission_request events', () => {
    const onPermissionRequest = mock()
    const socket = createSessionSocket(1, {
      onMessage: mock(),
      onConnect: mock(),
      onPermissionRequest
    })

    const req = {
      type: 'permission_request',
      request_id: 'req-1',
      tool_name: 'Bash',
      description: 'Run command: ls',
      input_preview: '{"command":"ls"}'
    }
    mockInstances[0].receiveMessage(req)

    expect(onPermissionRequest).toHaveBeenCalledTimes(1)
    const called = onPermissionRequest.mock.calls[0][0] as PermissionRequest
    expect(called.request_id).toBe('req-1')
    expect(called.tool_name).toBe('Bash')
    expect(called.description).toBe('Run command: ls')
    expect(called.input_preview).toBe('{"command":"ls"}')
    socket.close()
  })

  test('does not crash when onPermissionRequest is not provided', () => {
    const socket = createSessionSocket(1, {
      onMessage: mock(),
      onConnect: mock()
    })

    mockInstances[0].receiveMessage({
      type: 'permission_request',
      request_id: 'req-1',
      tool_name: 'Bash',
      description: 'test',
      input_preview: '{}'
    })

    // No error thrown
    socket.close()
  })

  test('send() sends JSON through the WebSocket', () => {
    const socket = createSessionSocket(1, {
      onMessage: mock(),
      onConnect: mock()
    })

    socket.send({ type: 'permission_response', request_id: 'req-1', behavior: 'allow' })

    expect(mockInstances[0].sent).toHaveLength(1)
    expect(JSON.parse(mockInstances[0].sent[0])).toEqual({
      type: 'permission_response',
      request_id: 'req-1',
      behavior: 'allow'
    })
    socket.close()
  })

  test('send() does nothing when WebSocket is not open', () => {
    const socket = createSessionSocket(1, {
      onMessage: mock(),
      onConnect: mock()
    })

    mockInstances[0].readyState = MockWebSocket.CLOSED
    socket.send({ type: 'test' })

    expect(mockInstances[0].sent).toHaveLength(0)
    socket.close()
  })

  test('ignores invalid JSON messages', () => {
    const onMessage = mock()
    const socket = createSessionSocket(1, {
      onMessage,
      onConnect: mock()
    })

    mockInstances[0].emit('message', { data: 'not json' })

    expect(onMessage).not.toHaveBeenCalled()
    socket.close()
  })
})
