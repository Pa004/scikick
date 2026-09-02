import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders SciKick heading', () => {
    render(<App />)
    expect(screen.getByText('SciKick')).toBeDefined()
  })

  it('shows loading state', () => {
    render(<App />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })
})
