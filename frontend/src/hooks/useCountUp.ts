import { useEffect, useMemo, useRef, useState } from 'react'

function prefersReduced(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canAnimate(): boolean {
  return typeof window !== 'undefined'
    && typeof window.requestAnimationFrame === 'function'
    && !prefersReduced()
}

// ReactBits CountUp pattern reimplemented natively: ease-out number
// transition via rAF. Renders the final value immediately when animation
// is unavailable (reduced motion, test envs) so content never depends on frames.
export function useCountUp(target: number, duration = 600): number {
  const animated = useMemo(() => canAnimate(), [])
  const [value, setValue] = useState(() => (animated ? 0 : target))
  const fromRef = useRef(0)

  useEffect(() => {
    if (!animated) return
    if (fromRef.current === target) return
    const from = fromRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (target - from) * eased
      fromRef.current = current
      setValue(current)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animated, target, duration])

  return animated ? value : target
}
