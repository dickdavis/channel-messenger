import { describe, expect, test } from 'bun:test'
import { hmacSign, generateToken, hashToken, verifyToken } from './auth'
import { MockD1Database } from '../tests/mock-d1'

describe('hmacSign', () => {
  test('produces deterministic output for same inputs', async () => {
    const a = await hmacSign('secret', 'data')
    const b = await hmacSign('secret', 'data')
    expect(a).toBe(b)
  })

  test('produces a 64-char hex string', async () => {
    const result = await hmacSign('secret', 'data')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  test('different data produces different signatures', async () => {
    const a = await hmacSign('secret', 'data1')
    const b = await hmacSign('secret', 'data2')
    expect(a).not.toBe(b)
  })

  test('different secrets produce different signatures', async () => {
    const a = await hmacSign('secret1', 'data')
    const b = await hmacSign('secret2', 'data')
    expect(a).not.toBe(b)
  })
})

describe('generateToken', () => {
  test('returns a 64-char hex string', async () => {
    const token = await generateToken()
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  test('produces unique tokens across calls', async () => {
    const tokens = await Promise.all(Array.from({ length: 10 }, async () => await generateToken()))
    const unique = new Set(tokens)
    expect(unique.size).toBe(10)
  })
})

describe('verifyToken', () => {
  test('returns userId when token hash matches in DB', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id FROM api_keys', { user_id: 42 })

    const result = await verifyToken(db as unknown as D1Database, 'secret', 'mytoken')
    expect(result).toEqual({ userId: 42 })
  })

  test('returns null when token hash not found', async () => {
    const db = new MockD1Database()
    // No onQuery registered — default returns null

    const result = await verifyToken(db as unknown as D1Database, 'secret', 'badtoken')
    expect(result).toBeNull()
  })

  test('hashes the token before looking it up', async () => {
    const db = new MockD1Database()
    db.onQuery('SELECT user_id FROM api_keys', { user_id: 1 })

    await verifyToken(db as unknown as D1Database, 'secret', 'mytoken')

    const expectedHash = await hashToken('secret', 'mytoken')
    expect(db.calls[0].bindings[0]).toBe(expectedHash)
  })
})
