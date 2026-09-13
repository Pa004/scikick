import { describe, it, expect, beforeEach } from 'vitest'
import { ACCENTS, DEFAULT_ACCENT, applyAccent, readStoredAccent } from './theme/accent'

describe('accent', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.accent
  })

  it('defaults to iris without stored value', () => {
    expect(readStoredAccent()).toBe(DEFAULT_ACCENT)
    expect(DEFAULT_ACCENT).toBe('iris')
  })

  it('exposes the three prototype accents', () => {
    expect([...ACCENTS]).toEqual(['iris', 'ember', 'electric'])
  })

  it('applies the accent to the document root', () => {
    applyAccent('ember')
    expect(document.documentElement.dataset.accent).toBe('ember')
  })

  it('reads back a stored accent and rejects unknown values', () => {
    localStorage.setItem('scikick.accent', 'electric')
    expect(readStoredAccent()).toBe('electric')
    localStorage.setItem('scikick.accent', 'lime')
    expect(readStoredAccent()).toBe('iris')
  })
})
