import { describe, expect, test, mock } from 'bun:test'

void mock.module('$app/environment', () => ({ dev: false }))

const { notifySessionHub } = await import('./notify')

const MESSAGE = {
  id: 1,
  session_id: 1,
  role: 'user',
  content: 'hello',
  created_at: '2025-01-01T00:00:00Z'
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStubHub () {
  const mockFetch = mock(() => new Response('ok'))
  return {
    mockFetch,
    stubHub: {
      idFromName: mock(() => 'do-id'),
      get: mock(() => ({ fetch: mockFetch }))
    }
  }
}

describe('notifySessionHub (production mode)', () => {
  test('calls idFromName with session-{id}', async () => {
    const { stubHub } = makeStubHub()
    await notifySessionHub(stubHub as any, '42', MESSAGE)
    expect(stubHub.idFromName).toHaveBeenCalledWith('session-42')
  })

  test('fetches /broadcast on the DO stub with POST', async () => {
    const { mockFetch, stubHub } = makeStubHub()
    await notifySessionHub(stubHub as any, '1', MESSAGE)

    expect(mockFetch).toHaveBeenCalled()
    const call = (mockFetch.mock.calls as any[][])[0]
    expect(call[0]).toBe('https://internal/broadcast')
    expect(call[1].method).toBe('POST')
  })

  test('sends message as JSON body', async () => {
    const { mockFetch, stubHub } = makeStubHub()
    await notifySessionHub(stubHub as any, '1', MESSAGE)

    const call = (mockFetch.mock.calls as any[][])[0]
    const body = JSON.parse(call[1].body)
    expect(body).toEqual(MESSAGE)
  })
})
