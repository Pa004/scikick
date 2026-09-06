import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ClickSpark from './ClickSpark'

let rafCb: FrameRequestCallback | null = null

const ctxStub = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  globalAlpha: 1,
  fillStyle: '',
}

function stubEnv(reduced: boolean) {
  rafCb = null
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCb = cb
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub as unknown as CanvasRenderingContext2D)
}

beforeEach(() => {
  stubEnv(false)
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ClickSpark', () => {
  it('bursts particles on click and removes the canvas when done', () => {
    render(
      <ClickSpark>
        <button type="button">Spark me</button>
      </ClickSpark>,
    )
    fireEvent.click(screen.getByText('Spark me'))
    expect(document.querySelector('canvas')).not.toBeNull()
    const t0 = performance.now()
    act(() => {
      rafCb?.(t0 + 10000)
    })
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('does nothing with reduced motion', () => {
    stubEnv(true)
    render(
      <ClickSpark>
        <button type="button">Quiet</button>
      </ClickSpark>,
    )
    fireEvent.click(screen.getByText('Quiet'))
    expect(document.querySelector('canvas')).toBeNull()
  })
})
