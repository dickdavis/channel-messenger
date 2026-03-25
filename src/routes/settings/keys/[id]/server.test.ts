import '../../../../tests/use-native-fetch'
import { describe, expect, test } from 'bun:test'
import { DELETE } from './+server'
import { mockRequestEvent, mockUser, expectHttpError } from '../../../../tests/mock-event'
import { MockD1Database } from '../../../../tests/mock-d1'

describe('DELETE /settings/keys/:id', () => {
  test('throws 401 when user not authenticated', async () => {
    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/keys/1',
      params: { id: '1' }
    })

    await expectHttpError(async () => await DELETE(event as any), 401)
  })

  test('throws 404 when key not found or already revoked', async () => {
    const db = new MockD1Database()
    db.onQuery('UPDATE api_keys', { meta: { last_row_id: 0, changes: 0 } })

    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/keys/99',
      params: { id: '99' },
      locals: { user: mockUser() },
      db
    })

    await expectHttpError(async () => await DELETE(event as any), 404)
  })

  test('returns { ok: true } on successful revocation', async () => {
    const db = new MockD1Database()
    db.onQuery('UPDATE api_keys', { meta: { last_row_id: 0, changes: 1 } })

    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/keys/5',
      params: { id: '5' },
      locals: { user: mockUser() },
      db
    })

    const response = await DELETE(event as any)
    const data = await response.json() as any
    expect(data).toEqual({ ok: true })
  })

  test('binds correct id and user_id to query', async () => {
    const db = new MockD1Database()
    db.onQuery('UPDATE api_keys', { meta: { last_row_id: 0, changes: 1 } })

    const user = mockUser({ id: 42 })
    const event = mockRequestEvent({
      method: 'DELETE',
      url: 'http://localhost/settings/keys/7',
      params: { id: '7' },
      locals: { user },
      db
    })

    await DELETE(event as any)
    expect(db.calls[0].bindings).toEqual(['7', 42])
  })
})
