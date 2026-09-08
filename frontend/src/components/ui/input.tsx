import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground',
        'placeholder:text-faint hover:border-border-strong focus:border-primary-strong',
        className,
      )}
      {...props}
    />
  )
}
