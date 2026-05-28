import { encode, decode } from '@toon-format/toon'
import { countTokens } from 'gpt-tokenizer'

export function safeEncode(data: unknown): string | null {
  try {
    return encode(data)
  } catch {
    return null
  }
}

export function safeDecode(toon: string): unknown | null {
  try {
    return decode(toon)
  } catch {
    return null
  }
}

export function calculateSavings(
  jsonStr: string,
  toonStr: string
): { jsonTokens: number; toonTokens: number; savingsPercent: number } {
  const jsonTokens = countTokens(jsonStr)
  const toonTokens = countTokens(toonStr)
  const savingsPercent =
    jsonTokens > 0 ? ((jsonTokens - toonTokens) / jsonTokens) * 100 : 0
  return { jsonTokens, toonTokens, savingsPercent }
}

export function isToonWorthIt(data: unknown, threshold = 0.1): boolean {
  try {
    const jsonStr = JSON.stringify(data, null, 2)
    const toonStr = safeEncode(data)
    if (!toonStr) return false
    const { savingsPercent } = calculateSavings(jsonStr, toonStr)
    return savingsPercent > threshold * 100
  } catch {
    return false
  }
}
