import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

export function Menu({ ...props }: ComponentProps<typeof DropdownPrimitive.Root>) {
  return <DropdownPrimitive.Root {...props} />
}

export function MenuTrigger({ ...props }: ComponentProps<typeof DropdownPrimitive.Trigger>) {
  return <DropdownPrimitive.Trigger {...props} />
}

export function MenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={8}
        className={cn(
          'animate-pop z-50 min-w-56 rounded-[10px] border border-border bg-surface p-1.5 shadow-lg',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  )
}

const itemClasses =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2'

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Item>) {
  return <DropdownPrimitive.Item className={cn(itemClasses, className)} {...props} />
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownPrimitive.CheckboxItem>) {
  return (
    <DropdownPrimitive.CheckboxItem className={cn(itemClasses, className)} {...props}>
      <span className="flex w-4 shrink-0 items-center justify-center">
        <DropdownPrimitive.ItemIndicator>
          <Check aria-hidden="true" className="size-4 text-primary-strong" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  )
}

export function MenuRadioGroup({ ...props }: ComponentProps<typeof DropdownPrimitive.RadioGroup>) {
  return <DropdownPrimitive.RadioGroup {...props} />
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownPrimitive.RadioItem>) {
  return (
    <DropdownPrimitive.RadioItem className={cn(itemClasses, className)} {...props}>
      <span className="flex w-4 shrink-0 items-center justify-center">
        <DropdownPrimitive.ItemIndicator>
          <Check aria-hidden="true" className="size-4 text-primary-strong" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.RadioItem>
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn('px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-faint uppercase', className)}
      {...props}
    />
  )
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator className={cn('my-1.5 h-px bg-border', className)} {...props} />
  )
}
