import { useState } from 'react'
import { cn } from '../../lib/cn'

function initials(team: string): string {
  const words = team.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function hueFor(team: string): number {
  let hash = 0
  for (let i = 0; i < team.length; i++) hash = (hash * 31 + team.charCodeAt(i)) % 360
  return hash
}

interface TeamAvatarProps {
  team: string
  crest?: string | null
  className?: string
}

// Fixed-size crest with graceful fallback: a failed or missing image
// swaps to team initials on a stable hue, never shifting layout.
export function TeamAvatar({ team, crest, className }: TeamAvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImg = crest != null && crest !== '' && !failed
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full',
        !showImg && 'text-xs font-bold text-white',
        className,
      )}
      style={
        !showImg
          ? { backgroundColor: `hsl(${hueFor(team)} 45% 38%)` }
          : { backgroundColor: 'var(--surface-alt)' }
      }
    >
      {showImg ? (
        <img
          src={crest as string}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-contain p-[18%]"
        />
      ) : (
        initials(team)
      )}
    </span>
  )
}
