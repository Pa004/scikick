import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface SegmentedGroupProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function SegmentedGroup({ label, children, className }: SegmentedGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-alt p-0.5',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface SegmentedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean
}

export function SegmentedButton({ active, className, ...props }: SegmentedButtonProps) {
  return (
      <button
      type="button"
      aria-pressed={active}
      className={cn(
        'min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150',
        active
          ? 'bg-primary text-primary-fg shadow-sm'
          : 'text-muted hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
