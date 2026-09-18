import { describe, it, expect } from 'vitest'
import { formLetter } from './form'

describe('formLetter', () => {
  it('keeps English letters in English', () => {
    expect(formLetter('W', 'en')).toBe('W')
    expect(formLetter('D', 'en')).toBe('D')
    expect(formLetter('L', 'en')).toBe('L')
  })

  it('localizes to V/E/D in Spanish', () => {
    expect(formLetter('W', 'es')).toBe('V')
    expect(formLetter('D', 'es')).toBe('E')
    expect(formLetter('L', 'es')).toBe('D')
  })
})
