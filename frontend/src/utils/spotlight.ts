import type { MouseEvent } from 'react'

// Direct-DOM mousemove handler: sets spotlight coordinates without
// React state, so hovering never triggers re-renders.
export function handleSpotlightMove(e: MouseEvent<HTMLElement>): void {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
  el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
}
