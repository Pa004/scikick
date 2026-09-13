import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface shadow-sm', className)}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-display text-base font-semibold text-foreground', className)} {...props} />
  )
}

export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'text-xs font-semibold tracking-[0.08em] text-faint uppercase',
        className,
      )}
      {...props}
    />
  )
}

// Section titles that belong in the heading outline (h3 under card h2s).
export function SectionHeading({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'mb-2 text-xs font-semibold tracking-[0.08em] text-faint uppercase',
        className,
      )}
      {...props}
    />
  )
}
