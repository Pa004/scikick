import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-alt)_25%,var(--surface-hover)_50%,var(--surface-alt)_75%)] bg-[length:400px_100%]',
        className,
      )}
      {...props}
    />
  )
}
