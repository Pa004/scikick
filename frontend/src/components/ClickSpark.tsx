import type { MouseEvent, ReactNode } from 'react'

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

const COLORS = ['#3b82f6', '#8b5cf6', '#60a5fa']
const SIZE = 120
const COUNT = 8
const DURATION = 450

function prefersReduced(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function burst(clientX: number, clientY: number): void {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = SIZE
  canvas.height = SIZE
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = `position:fixed;left:${clientX - SIZE / 2}px;top:${clientY - SIZE / 2}px;pointer-events:none;z-index:50;`
  document.body.appendChild(canvas)

  const sparks: Spark[] = Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5
    const speed = 1.5 + Math.random() * 2
    return {
      x: SIZE / 2, y: SIZE / 2,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
      life: 1, color: COLORS[i % COLORS.length],
    }
  })

  const start = performance.now()
  const tick = (now: number) => {
    const t = Math.min((now - start) / DURATION, 1)
    ctx.clearRect(0, 0, SIZE, SIZE)
    for (const s of sparks) {
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.15
      s.life = 1 - t
      ctx.globalAlpha = Math.max(s.life, 0)
      ctx.fillStyle = s.color
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3)
    }
    if (t < 1) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}

// ReactBits ClickSpark pattern, dependency-free. display:contents keeps the
// wrapper out of parent grids; the canvas is viewport-fixed and self-removing.
export default function ClickSpark({ children }: { children: ReactNode }) {
  const onClick = (e: MouseEvent) => {
    if (prefersReduced()) return
    burst(e.clientX, e.clientY)
  }
  return (
    <span onClick={onClick} style={{ display: 'contents' }}>
      {children}
    </span>
  )
}
