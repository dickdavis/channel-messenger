import { describe, expect, test } from 'bun:test'
import { urlBase64ToUint8Array } from './push-utils'

describe('urlBase64ToUint8Array', () => {
  test('converts a base64url string to Uint8Array', () => {
    // "hello" in base64url is "aGVsbG8"
    const result = urlBase64ToUint8Array('aGVsbG8')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(result)).toBe('hello')
  })

  test('handles base64url characters (- and _)', () => {
    // Standard base64 uses + and /, base64url uses - and _
    // Base64 "a+b/c==" -> base64url "a-b_c"
    const result = urlBase64ToUint8Array('a-b_c')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(3)
  })

  test('pads correctly when length % 4 === 2', () => {
    // "ab" needs "==" padding
    const result = urlBase64ToUint8Array('YWI')
    expect(new TextDecoder().decode(result)).toBe('ab')
  })

  test('pads correctly when length % 4 === 3', () => {
    // "abc" needs "=" padding
    const result = urlBase64ToUint8Array('YWJj')
    expect(new TextDecoder().decode(result)).toBe('abc')
  })

  test('handles already-padded input', () => {
    const result = urlBase64ToUint8Array('aGVsbG8=')
    expect(new TextDecoder().decode(result)).toBe('hello')
  })

  test('returns empty array for empty string', () => {
    const result = urlBase64ToUint8Array('')
    expect(result.length).toBe(0)
  })

  test('produces correct byte values for known VAPID key fragment', () => {
    // A short base64url string with known bytes
    const result = urlBase64ToUint8Array('AQID')
    expect(result[0]).toBe(1)
    expect(result[1]).toBe(2)
    expect(result[2]).toBe(3)
  })
})
