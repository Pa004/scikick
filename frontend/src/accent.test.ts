import { describe, it, expect, beforeEach } from 'vitest'
import { ACCENTS, DEFAULT_ACCENT, applyAccent, readStoredAccent } from './theme/accent'

describe('accent', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.accent
  })

  it('defaults to pino without stored value', () => {
    expect(readStoredAccent()).toBe(DEFAULT_ACCENT)
    expect(DEFAULT_ACCENT).toBe('pino')
  })

  it('exposes the three accents', () => {
    expect([...ACCENTS]).toEqual(['pino', 'tierra', 'iris'])
  })

  it('applies the accent to the document root', () => {
    applyAccent('pino')
    expect(document.documentElement.dataset.accent).toBe('pino')
  })

  it('reads back a stored accent and rejects unknown values', () => {
    localStorage.setItem('scikick.accent', 'iris')
    expect(readStoredAccent()).toBe('iris')
    localStorage.setItem('scikick.accent', 'electric')
    expect(readStoredAccent()).toBe('pino')
  })
})
