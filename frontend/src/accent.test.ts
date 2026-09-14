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

  it('exposes pine as the single accent', () => {
    expect([...ACCENTS]).toEqual(['pino'])
  })

  it('applies the accent to the document root', () => {
    applyAccent('pino')
    expect(document.documentElement.dataset.accent).toBe('pino')
  })

  it('falls back to pine for any stored value', () => {
    localStorage.setItem('scikick.accent', 'iris')
    expect(readStoredAccent()).toBe('pino')
    localStorage.setItem('scikick.accent', 'electric')
    expect(readStoredAccent()).toBe('pino')
  })
})
