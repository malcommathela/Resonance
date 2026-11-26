import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full',
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md', footer = null }) => (
  <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 flex max-h-[90vh] w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border bg-background shadow-lg duration-200 sm:w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          sizes[size] || sizes.md
        )}
      >
        {title ? (
          <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
            <DialogPrimitive.Title asChild>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        ) : (
          <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="shrink-0 border-t px-6 py-4">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
)
