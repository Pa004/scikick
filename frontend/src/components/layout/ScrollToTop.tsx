import { useEffect } from 'react'
import { useLocation } from 'react-router'

export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' })
    } catch {
      // Non-visual env
    }
  }, [pathname])
  return null
}
