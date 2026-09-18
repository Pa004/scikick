import { describe, it, expect, beforeEach } from 'vitest'
import { readJSON, writeJSON, readString, writeString } from './storage'

beforeEach(() => {
  localStorage.clear()
})

describe('storage', () => {
  it('reads guarded JSON with fallback on missing or invalid data', () => {
    const isList = (v: unknown): v is string[] => Array.isArray(v)
    expect(readJSON('k', isList, ['dflt'])).toEqual(['dflt'])
    localStorage.setItem('k', 'not-json')
    expect(readJSON('k', isList, ['dflt'])).toEqual(['dflt'])
    localStorage.setItem('k', JSON.stringify({ a: 1 }))
    expect(readJSON('k', isList, ['dflt'])).toEqual(['dflt'])
    writeJSON('k', ['a'])
    expect(readJSON('k', isList, ['dflt'])).toEqual(['a'])
  })

  it('reads and writes plain strings', () => {
    expect(readString('s', 'fb')).toBe('fb')
    writeString('s', 'v')
    expect(readString('s', 'fb')).toBe('v')
  })
})
