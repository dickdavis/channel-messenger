import '../../../tests/use-native-fetch'
import { describe, expect, test } from 'bun:test'
import { POST } from './+server'
import { mockRequestEvent } from '../../../tests/mock-event'

describe('POST /auth/logout', () => {
  test('returns 302 redirect to /', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/auth/logout'
    })

    const response = await POST(event as any)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/')
  })

  test('sets cleared session cookie', async () => {
    const event = mockRequestEvent({
      method: 'POST',
      url: 'http://localhost/auth/logout'
    })

    const response = await POST(event as any)
    const setCookie = response.headers.get('Set-Cookie') ?? ''

    expect(setCookie).toContain('session=;')
    expect(setCookie).toContain('Max-Age=0')
  })
})
