import { describe, it, expect } from 'vitest'
import { probToDecimal, formatDecimal } from './odds'

describe('probToDecimal', () => {
  it('converts common probabilities', () => {
    expect(probToDecimal(0.5)).toBeCloseTo(2)
    expect(probToDecimal(0.25)).toBeCloseTo(4)
  })

  it('returns null for non-positive or non-finite input', () => {
    expect(probToDecimal(0)).toBeNull()
    expect(probToDecimal(-0.1)).toBeNull()
    expect(probToDecimal(NaN)).toBeNull()
    expect(probToDecimal(Infinity)).toBeNull()
  })
})

describe('formatDecimal', () => {
  it('formats with two decimals', () => {
    expect(formatDecimal(0.5)).toBe('2.00')
    expect(formatDecimal(0.25)).toBe('4.00')
  })

  it('shows dash for invalid input', () => {
    expect(formatDecimal(0)).toBe('—')
    expect(formatDecimal(NaN)).toBe('—')
  })

  it('caps extreme longshots', () => {
    expect(formatDecimal(0.0005)).toBe('999.00')
  })
})
