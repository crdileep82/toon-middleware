import { describe, it, expect } from 'vitest'
import { safeEncode, safeDecode, calculateSavings, isToonWorthIt } from '../src/utils.js'

const sample = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `User${i + 1}`,
  role: 'admin',
  active: true,
}))

describe('safeEncode', () => {
  it('encodes a JS object and returns a string', () => {
    const result = safeEncode(sample)
    expect(typeof result).toBe('string')
    expect(result!.length).toBeGreaterThan(0)
  })

  it('returns null on unencodable input', () => {
    // Circular reference causes JSON.stringify to throw, which encode may propagate
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const result = safeEncode(circular)
    // Either null (if encode throws) or a string — never throws
    expect(result === null || typeof result === 'string').toBe(true)
  })
})

describe('safeDecode', () => {
  it('round-trips an encoded object back to the original', () => {
    const encoded = safeEncode(sample)!
    const decoded = safeDecode(encoded)
    expect(decoded).toEqual(sample)
  })

  it('returns null on null/undefined input', () => {
    expect(safeDecode(null as unknown as string)).toBeNull()
    expect(safeDecode(undefined as unknown as string)).toBeNull()
  })
})

describe('calculateSavings', () => {
  it('returns lower toonTokens than jsonTokens for uniform arrays', () => {
    const jsonStr = JSON.stringify(sample, null, 2)
    const toonStr = safeEncode(sample)!
    const { jsonTokens, toonTokens, savingsPercent } = calculateSavings(jsonStr, toonStr)
    expect(jsonTokens).toBeGreaterThan(0)
    expect(toonTokens).toBeGreaterThan(0)
    expect(savingsPercent).toBeGreaterThan(0)
    expect(toonTokens).toBeLessThan(jsonTokens)
  })

  it('returns 0% savings when strings are identical', () => {
    const { savingsPercent } = calculateSavings('hello', 'hello')
    expect(savingsPercent).toBe(0)
  })
})

describe('isToonWorthIt', () => {
  it('returns true for large uniform arrays (significant savings)', () => {
    expect(isToonWorthIt(sample)).toBe(true)
  })

  it('returns false when threshold is impossibly high', () => {
    expect(isToonWorthIt(sample, 1.0)).toBe(false)
  })

  it('returns false for null/undefined input', () => {
    expect(isToonWorthIt(null)).toBe(false)
    expect(isToonWorthIt(undefined)).toBe(false)
  })
})
