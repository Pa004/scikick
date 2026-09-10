import { describe, it, expect, beforeEach } from 'vitest'
import { ACCENTS, DEFAULT_ACCENT, applyAccent, readStoredAccent } from './theme/accent'

describe('accent', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.accent
  })

  it('defaults to electric without stored value', () => {
    expect(readStoredAccent()).toBe(DEFAULT_ACCENT)
    expect(DEFAULT_ACCENT).toBe('electric')
  })

  it('exposes the two accents', () => {
    expect([...ACCENTS]).toEqual(['iris', 'electric'])
  })

  it('applies the accent to the document root', () => {
    applyAccent('iris')
    expect(document.documentElement.dataset.accent).toBe('iris')
  })

  it('reads back a stored accent and rejects unknown values', () => {
    localStorage.setItem('scikick.accent', 'electric')
    expect(readStoredAccent()).toBe('electric')
    localStorage.setItem('scikick.accent', 'ember')
    expect(readStoredAccent()).toBe('electric')
  })
})
