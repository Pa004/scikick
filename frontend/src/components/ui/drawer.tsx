import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

export function Drawer({ ...props }: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

export function DrawerTrigger({ ...props }: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />
}

export function DrawerOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('animate-fade fixed inset-0 z-50 bg-black/50', className)}
      {...props}
    />
  )
}

export function DrawerContent({
  className,
  title,
  description,
  closeLabel = 'Close',
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string; closeLabel?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        className={cn(
          'animate-rise fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-2xl border border-border bg-background shadow-lg',
          'sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px] sm:max-h-none sm:rounded-t-none sm:rounded-l-2xl sm:animate-fade',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <DialogPrimitive.Title className="font-display text-lg font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            title={closeLabel}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
