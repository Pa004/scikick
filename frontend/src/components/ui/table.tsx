import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function TableRegion({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('overflow-x-auto rounded-xl border border-border bg-surface', className)}
      {...props}
    />
  )
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('w-full border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0', className)}
      {...props}
    />
  )
}

export function Th({
  className,
  align = 'left',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-border px-3 py-2 font-medium text-muted',
        align === 'left' && 'text-left',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  align = 'left',
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }) {
  return (
    <td
      className={cn(
        'border-b border-border/60 px-3 py-2 text-foreground tabular-nums',
        align === 'left' && 'text-left',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    />
  )
}
