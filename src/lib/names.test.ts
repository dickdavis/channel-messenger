import { describe, expect, test } from 'bun:test'
import { generateName } from './names'

describe('generateName', () => {
  test('returns a string in adjective-noun format', () => {
    const name = generateName()
    expect(name).toMatch(/^[a-z]+-[a-z]+$/)
  })

  test('produces varied results across multiple calls', () => {
    const names = new Set(Array.from({ length: 20 }, () => generateName()))
    expect(names.size).toBeGreaterThan(1)
  })
})
